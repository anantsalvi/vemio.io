/**
 * VEMIO™ — Single RCA Report API
 * GET   /api/rca/[id]  — Full RCA detail with linked tickets + related alerts
 * PATCH /api/rca/[id]  — Update followup status (admin only)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const tenantId = session.user.tenantId;
  const { id } = await params;

  try {
    const result = await queryWithTenant(tenantId, `
      SELECT r.*, s.name AS site_name, s.city AS site_city
      FROM rca_reports r
      LEFT JOIN sites s ON s.id = r.site_id
      WHERE r.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return Response.json({ error: 'RCA report not found' }, { status: 404 });
    }

    const rca = result.rows[0];

    // Linked tickets
    let linked_tickets = [];
    if (rca.linked_ticket_ids && rca.linked_ticket_ids.length > 0) {
      const tkResult = await queryWithTenant(tenantId, `
        SELECT id, glpi_ticket_id, title, priority, status, created_at
        FROM tickets WHERE id = ANY($1)
      `, [rca.linked_ticket_ids]);
      linked_tickets = tkResult.rows;
    }

    // Related alerts during incident window
    let related_alerts = [];
    if (rca.incident_start_at && rca.incident_end_at) {
      const alResult = await queryWithTenant(tenantId, `
        SELECT id, alert_type, severity, title, triggered_at, resolved_at
        FROM alerts
        WHERE triggered_at BETWEEN $1 AND $2
        ORDER BY triggered_at ASC LIMIT 20
      `, [rca.incident_start_at, rca.incident_end_at]);
      related_alerts = alResult.rows;
    }

    return Response.json({ rca, linked_tickets, related_alerts });
} catch (err) {
  console.error('RCA error:', err);
  return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
}
});

export const PATCH = withAuth(async (req, session, { params }) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const { id } = await params;

  try {
    const body = await req.json();
    const { followup_status, followup_notes, preventive_action } = body;

    const updates = [];
    const values = [];
    let paramIdx = 2; // $1 = id

    if (followup_status) {
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

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.push('updated_at = NOW()');

    const result = await queryWithTenant(tenantId, `
      UPDATE rca_reports SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, followup_status, updated_at
    `, [id, ...values]);

    if (result.rowCount === 0) {
      return Response.json({ error: 'RCA report not found' }, { status: 404 });
    }
    return Response.json({ success: true, rca: result.rows[0] });
} catch (err) {
  console.error('RCA error:', err);
  return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
}
});