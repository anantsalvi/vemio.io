/**
 * VEMIO™ — Alerts API
 * GET  /api/alerts  — List alerts with filters
 * PATCH /api/alerts — Acknowledge or resolve an alert
 *
 * Query params:
 *   ?state=active|acknowledged|resolved|suppressed
 *   ?severity=critical|high|medium|low
 *   ?type=device_down|sla_breach|bcs_drop
 *   ?limit=50&offset=0
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant, withTransaction } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const state    = searchParams.get('state');
  const severity = searchParams.get('severity');
  const type     = searchParams.get('type');
  const limit    = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset   = parseInt(searchParams.get('offset') || '0', 10);

  try {
    // Build dynamic WHERE (RLS handles tenant_id)
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (state) {
      conditions.push(`a.state = $${paramIdx}`);
      params.push(state);
      paramIdx++;
    }
    if (severity) {
      conditions.push(`a.severity = $${paramIdx}`);
      params.push(severity);
      paramIdx++;
    }
    if (type) {
      conditions.push(`a.alert_type = $${paramIdx}`);
      params.push(type);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count
    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total FROM alerts a ${whereClause}`, params
    );

    // Alerts with joins
    const alerts = await queryWithTenant(tenantId, `
      SELECT
        a.id, a.alert_type, a.severity, a.state,
        a.title, a.description, a.source_type,
        a.notification_sent, a.notification_channel,
        a.triggered_at, a.acknowledged_at, a.resolved_at,
        d.name AS device_name, d.device_type,
        s.name AS site_name
      FROM alerts a
      LEFT JOIN devices d ON d.id = a.device_id
      LEFT JOIN sites s ON s.id = a.site_id
      ${whereClause}
      ORDER BY
        CASE a.state WHEN 'active' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
        CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        a.triggered_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset]);

    // Summary counts
    const summary = await queryWithTenant(tenantId, `
      SELECT
        COUNT(*) FILTER (WHERE state = 'active')       AS active,
        COUNT(*) FILTER (WHERE state = 'acknowledged')  AS acknowledged,
        COUNT(*) FILTER (WHERE state = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours') AS resolved_24h,
        COUNT(*) FILTER (WHERE state = 'suppressed')    AS suppressed,
        COUNT(*) FILTER (WHERE severity = 'critical' AND state = 'active') AS critical_active
      FROM alerts
    `);

    return Response.json({
      alerts: alerts.rows,
      summary: {
        active:          parseInt(summary.rows[0].active),
        acknowledged:    parseInt(summary.rows[0].acknowledged),
        resolved_24h:    parseInt(summary.rows[0].resolved_24h),
        suppressed:      parseInt(summary.rows[0].suppressed),
        critical_active: parseInt(summary.rows[0].critical_active),
      },
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error('[API /alerts] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const { alertId, action } = body;

    if (!alertId || !['acknowledge', 'resolve'].includes(action)) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    if (action === 'acknowledge') {
      const result = await queryWithTenant(tenantId, `
        UPDATE alerts SET state = 'acknowledged', acknowledged_at = NOW()
        WHERE id = $1 AND state = 'active'
        RETURNING id, state
      `, [alertId]);
      if (result.rowCount === 0) return Response.json({ error: 'Not found or not active' }, { status: 404 });
      return Response.json({ success: true, alert: result.rows[0] });
    }

    if (action === 'resolve') {
      const result = await queryWithTenant(tenantId, `
        UPDATE alerts SET state = 'resolved', resolved_at = NOW()
        WHERE id = $1 AND state IN ('active', 'acknowledged')
        RETURNING id, state
      `, [alertId]);
      if (result.rowCount === 0) return Response.json({ error: 'Not found or already resolved' }, { status: 404 });
      return Response.json({ success: true, alert: result.rows[0] });
    }
  } catch (err) {
    console.error('[API /alerts PATCH] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
