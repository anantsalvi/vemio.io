/**
 * VEMIO™ — Single RCA Report API
 * GET   /api/rca/[id]  — Full RCA detail with linked tickets + related alerts
 * PATCH /api/rca/[id]  — Update followup status (admin only)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const tenantId = session.user.tenantId;
  const { id }   = await params;

  try {
    // No site_id FK — resolve first affected site via subquery
    const result = await queryWithTenant(tenantId, `
      SELECT
        r.*,
        (
          SELECT s.name
          FROM sites s
          WHERE s.id = r.affected_sites[1]
          LIMIT 1
        ) AS site_name,
        (
          SELECT s.city
          FROM sites s
          WHERE s.id = r.affected_sites[1]
          LIMIT 1
        ) AS site_city
      FROM rca_reports r
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'RCA report not found' }, { status: 404 });
    }

    const rca = result.rows[0];

    // Normalise column name differences for the frontend
    // (frontend expects these keys based on the RCAPage component)
    rca.cause_category    = rca.root_cause_category;
    rca.followup_due_date = rca.followup_date;
    rca.created_by        = rca.owner;
    rca.linked_ticket_ids = rca.related_ticket_ids;
    rca.incident_start_at = rca.incident_date;
    rca.incident_end_at   = null;   // single date in schema, no end

    // Linked tickets via junction table rca_report_tickets
    let linked_tickets = [];
    const tkJunction = await queryWithTenant(tenantId, `
      SELECT t.id, t.glpi_ticket_id, t.title, t.priority, t.status, t.created_at
      FROM rca_report_tickets rt
      JOIN tickets t ON t.id = rt.ticket_id
      WHERE rt.rca_id = $1
    `, [id]);
    linked_tickets = tkJunction.rows;

    // Fallback: also check related_ticket_ids array if junction table is empty
    if (linked_tickets.length === 0 && rca.related_ticket_ids?.length > 0) {
      const tkResult = await queryWithTenant(tenantId, `
        SELECT id, glpi_ticket_id, title, priority, status, created_at
        FROM tickets WHERE id = ANY($1)
      `, [rca.related_ticket_ids]);
      linked_tickets = tkResult.rows;
    }

    // Related alerts — use incident_date window (same day)
    let related_alerts = [];
    if (rca.incident_date) {
      const alResult = await queryWithTenant(tenantId, `
        SELECT id, alert_type, severity, title, triggered_at, resolved_at
        FROM alerts
        WHERE triggered_at::date = $1::date
        ORDER BY triggered_at ASC
        LIMIT 20
      `, [rca.incident_date]);
      related_alerts = alResult.rows;
    }

    return Response.json({ rca, linked_tickets, related_alerts });

  } catch (err) {
    console.error('RCA detail error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req, session, { params }) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const { id }   = await params;

  try {
    const body = await req.json();
    // Accept both old field names (from frontend) and actual schema names
    const followup_status    = body.followup_status;
    const followup_notes     = body.followup_notes;
    const preventive_action  = body.preventive_action;
    // followup_due_date from frontend maps to followup_date in schema
    const followup_date      = body.followup_date ?? body.followup_due_date;

    const updates  = [];
    const values   = [];
    let paramIdx   = 2; // $1 = id

    if (followup_status !== undefined) {
      updates.push(`followup_status = $${paramIdx}`);
      values.push(followup_status);
      paramIdx++;
    }
    if (followup_notes !== undefined) {
      updates.push(`followup_notes = $${paramIdx}`);
      values.push(followup_notes);
      paramIdx++;
    }
    if (preventive_action !== undefined) {
      updates.push(`preventive_action = $${paramIdx}`);
      values.push(preventive_action);
      paramIdx++;
    }
    if (followup_date !== undefined) {
      updates.push(`followup_date = $${paramIdx}`);
      values.push(followup_date);
      paramIdx++;
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.push('updated_at = NOW()');

    const result = await queryWithTenant(tenantId, `
      UPDATE rca_reports SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, followup_status, followup_date AS followup_due_date, updated_at
    `, [id, ...values]);

    if (result.rowCount === 0) {
      return Response.json({ error: 'RCA report not found' }, { status: 404 });
    }

    return Response.json({ success: true, rca: result.rows[0] });

  } catch (err) {
    console.error('RCA patch error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});