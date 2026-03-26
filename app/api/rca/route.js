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
  const limit  = Math.min(parseInt(searchParams.get('limit')  || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status');

  try {
    const conditions = [];
    const params     = [];
    let paramIdx     = 1;

    if (status) {
      conditions.push(`r.followup_status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total FROM rca_reports r ${whereClause}`,
      params
    );

    const rcas = await queryWithTenant(tenantId, `
      SELECT
        r.id,
        r.incident_title,
        -- Schema has incident_date (single date), no start/end columns
        r.incident_date            AS incident_start_at,
        NULL::date                 AS incident_end_at,
        -- cause_category column is named root_cause_category
        r.root_cause_category      AS cause_category,
        r.root_cause,
        r.immediate_action,
        r.preventive_action,
        r.timeline,
        -- No impact_description column in schema, return null
        NULL::text                 AS impact_description,
        r.followup_status,
        -- followup_due_date column is named followup_date
        r.followup_date            AS followup_due_date,
        r.followup_notes,
        -- linked_ticket_ids column is named related_ticket_ids
        r.related_ticket_ids       AS linked_ticket_ids,
        -- created_by column is named owner
        r.owner                    AS created_by,
        r.created_at,
        r.updated_at,
        -- No site_id FK — sites stored as affected_sites uuid[]
        -- Resolve first affected site name via subquery
        (
          SELECT s.name
          FROM sites s
          WHERE s.id = r.affected_sites[1]
          LIMIT 1
        )                          AS site_name,
        -- linked_tickets_count from junction table rca_report_tickets
        (
          SELECT COUNT(*)::int
          FROM rca_report_tickets rt
          WHERE rt.rca_id = r.id
        )                          AS linked_tickets_count
      FROM rca_reports r
      ${whereClause}
      ORDER BY r.incident_date DESC NULLS LAST
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset]);

    return Response.json({
      rca_reports: rcas.rows,
      pagination: {
        total:  parseInt(countResult.rows[0].total),
        limit,
        offset,
      },
    });

  } catch (err) {
    console.error('RCA list error:', err);
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
      affected_sites,        // was site_id — now uuid[]
      incident_title,
      incident_date,         // was incident_start_at/end_at — single date
      root_cause_category,   // was cause_category
      root_cause,
      immediate_action,
      preventive_action,
      timeline,
      related_ticket_ids,    // was linked_ticket_ids
      followup_date,         // was followup_due_date
      followup_notes,
      title,                 // required by schema NOT NULL
    } = body;

    // title is NOT NULL in schema — fall back to incident_title
    const reportTitle = title || incident_title;

    if (!reportTitle || !root_cause || !root_cause_category) {
      return Response.json({
        error: 'title, root_cause, and root_cause_category are required',
      }, { status: 400 });
    }

    const result = await queryWithTenant(tenantId, `
      INSERT INTO rca_reports (
        tenant_id,
        title,
        incident_title,
        incident_date,
        affected_sites,
        root_cause_category,
        root_cause,
        immediate_action,
        preventive_action,
        timeline,
        related_ticket_ids,
        followup_status,
        followup_date,
        followup_notes,
        owner,
        is_published
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        'pending', $12, $13, $14, false
      )
      RETURNING id, title, incident_title, created_at
    `, [
      tenantId,
      reportTitle,
      incident_title || null,
      incident_date  || null,
      affected_sites ? `{${affected_sites.join(',')}}` : '{}',
      root_cause_category,
      root_cause,
      immediate_action  || null,
      preventive_action || null,
      timeline ? JSON.stringify(timeline) : '[]',
      related_ticket_ids ? `{${related_ticket_ids.join(',')}}` : '{}',
      followup_date  || null,
      followup_notes || null,
      session.user.name || session.user.email,
    ]);

    return Response.json({ success: true, rca: result.rows[0] }, { status: 201 });

  } catch (err) {
    console.error('RCA create error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});