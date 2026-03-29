/**
 * VEMIO™ — RCA Reports API
 * GET  /api/rca  — List RCA reports
 * POST /api/rca  — Create new RCA (admin only)
 *
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get('limit')  || '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const status = searchParams.get('status');

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  const isAllMode = target.mode === 'all';

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

    const rcas = await queryForTenant(target, `
      SELECT
        r.id,
        r.incident_title,
        r.incident_date            AS incident_start_at,
        NULL::date                 AS incident_end_at,
        r.root_cause_category      AS cause_category,
        r.root_cause,
        r.immediate_action,
        r.preventive_action,
        r.timeline,
        NULL::text                 AS impact_description,
        r.followup_status,
        r.followup_date            AS followup_due_date,
        r.followup_notes,
        r.related_ticket_ids       AS linked_ticket_ids,
        r.owner                    AS created_by,
        r.created_at,
        r.updated_at,
        (
          SELECT s.name FROM sites s WHERE s.id = r.affected_sites[1] LIMIT 1
        ) AS site_name,
        (
          SELECT COUNT(*)::int FROM rca_report_tickets rt WHERE rt.rca_id = r.id
        ) AS linked_tickets_count
      FROM rca_reports r
      ${whereClause}
      ORDER BY r.incident_date DESC NULLS LAST`,
      params,
      { addTenantInfo: isAllMode }
    );

    // Paginate merged results
    const total = rcas.rows.length;
    const paginatedRcas = rcas.rows.slice(offset, offset + limit);

    return Response.json({
      rca_reports: paginatedRcas.map(r => ({
        ...r,
        ...(r._tenant_name && { tenant_name: r._tenant_name }),
        _tenant_name: undefined, _tenant_slug: undefined, _tenant_id: undefined,
      })),
      isAllTenants: isAllMode,
      pagination: { total, limit, offset },
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
      affected_sites, incident_title, incident_date,
      root_cause_category, root_cause, immediate_action,
      preventive_action, timeline, related_ticket_ids,
      followup_date, followup_notes, title,
    } = body;

    const reportTitle = title || incident_title;

    if (!reportTitle || !root_cause || !root_cause_category) {
      return Response.json({
        error: 'title, root_cause, and root_cause_category are required',
      }, { status: 400 });
    }

    const result = await queryWithTenant(tenantId, `
      INSERT INTO rca_reports (
        tenant_id, title, incident_title, incident_date, affected_sites,
        root_cause_category, root_cause, immediate_action, preventive_action,
        timeline, related_ticket_ids, followup_status, followup_date,
        followup_notes, owner, is_published
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        'pending', $12, $13, $14, false
      )
      RETURNING id, title, incident_title, created_at
    `, [
      tenantId, reportTitle, incident_title || null, incident_date || null,
      affected_sites ? `{${affected_sites.join(',')}}` : '{}',
      root_cause_category, root_cause, immediate_action || null,
      preventive_action || null, timeline ? JSON.stringify(timeline) : '[]',
      related_ticket_ids ? `{${related_ticket_ids.join(',')}}` : '{}',
      followup_date || null, followup_notes || null,
      session.user.name || session.user.email,
    ]);

    return Response.json({ success: true, rca: result.rows[0] }, { status: 201 });
  } catch (err) {
    console.error('RCA create error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
