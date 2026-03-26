/**
 * VEMIO™ — RCA Reports API
 * GET  /api/rca  — List RCA reports
 * POST /api/rca  — Create new RCA (admin only)
 *
 * Query params:
 *   ?status=pending|completed|overdue
 *   ?limit=20&offset=0
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status');

  try {
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (status) {
      conditions.push(`r.followup_status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total FROM rca_reports r ${whereClause}`, params
    );

    const rcas = await queryWithTenant(tenantId, `
      SELECT
        r.id, r.site_id,
        r.incident_title, r.incident_start_at, r.incident_end_at,
        r.cause_category, r.root_cause,
        r.immediate_action, r.preventive_action,
        r.timeline, r.impact_description,
        r.followup_status, r.followup_due_date, r.followup_notes,
        r.linked_ticket_ids,
        r.created_by, r.created_at, r.updated_at,
        s.name AS site_name,
        COALESCE(array_length(r.linked_ticket_ids, 1), 0) AS linked_tickets_count
      FROM rca_reports r
      LEFT JOIN sites s ON s.id = r.site_id
      ${whereClause}
      ORDER BY r.incident_start_at DESC NULLS LAST
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset]);

    return Response.json({
      rca_reports: rcas.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('[API /rca] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const {
      site_id, incident_title, incident_start_at, incident_end_at,
      cause_category, root_cause, immediate_action, preventive_action,
      timeline, impact_description, linked_ticket_ids, followup_due_date,
    } = body;

    if (!incident_title || !root_cause || !cause_category) {
      return Response.json({
        error: 'incident_title, root_cause, and cause_category are required'
      }, { status: 400 });
    }

    const result = await queryWithTenant(tenantId, `
      INSERT INTO rca_reports (
        tenant_id, site_id, incident_title, incident_start_at, incident_end_at,
        cause_category, root_cause, immediate_action, preventive_action,
        timeline, impact_description, linked_ticket_ids,
        followup_status, followup_due_date, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, $14
      ) RETURNING id, incident_title, created_at
    `, [
      tenantId, site_id || null,
      incident_title, incident_start_at || null, incident_end_at || null,
      cause_category, root_cause, immediate_action || null, preventive_action || null,
      timeline ? JSON.stringify(timeline) : null, impact_description || null,
      linked_ticket_ids || '{}', followup_due_date || null,
      session.user.name || session.user.email,
    ]);

    return Response.json({ success: true, rca: result.rows[0] }, { status: 201 });
} catch (err) {
  console.error('RCA error:', err);
  return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
}
});