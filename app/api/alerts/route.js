/**
 * VEMIO™ — Alerts API
 * GET  /api/alerts  — List alerts with filters
 * PATCH /api/alerts — Acknowledge (creates GLPI ticket) or Resolve (closes ticket)
 *
 * Query params:
 *   ?state=active|acknowledged|resolved|suppressed
 *   ?severity=critical|high|medium|low
 *   ?type=device_down|sla_breach|bcs_drop
 *   ?category=network|all (default: network)
 *   ?limit=50&offset=0
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { createGLPITicket, addGLPIFollowup, closeGLPITicket } from '@/lib/glpi';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const state    = searchParams.get('state');
  const severity = searchParams.get('severity');
  const type     = searchParams.get('type');
  const category = searchParams.get('category') || 'network';
  const limit    = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset   = parseInt(searchParams.get('offset') || '0', 10);

  try {
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

    if (category !== 'all') {
      conditions.push(`(d.device_type = ANY($${paramIdx}) OR d.device_type IS NULL)`);
      params.push(NETWORK_TYPES);
      paramIdx++;
    }

    conditions.push(`(d.is_retired = false OR d.id IS NULL)`);

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total FROM alerts a LEFT JOIN devices d ON d.id = a.device_id ${whereClause}`, params
    );

    const alerts = await queryWithTenant(tenantId, `
      SELECT
        a.id, a.alert_type, a.severity, a.state,
        a.title, a.description, a.source_type,
        a.notification_sent, a.notification_channel,
        a.triggered_at, a.acknowledged_at, a.resolved_at,
        a.glpi_ticket_id,
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
    const summaryConditions = [];
    const summaryParams = [];
    let summaryIdx = 1;

    if (category !== 'all') {
      summaryConditions.push(`(d.device_type = ANY($${summaryIdx}) OR d.device_type IS NULL)`);
      summaryParams.push(NETWORK_TYPES);
      summaryIdx++;
    }
    summaryConditions.push(`(d.is_retired = false OR d.id IS NULL)`);
    const summaryWhere = summaryConditions.length > 0 ? 'WHERE ' + summaryConditions.join(' AND ') : '';

    const summary = await queryWithTenant(tenantId, `
      SELECT
        COUNT(*) FILTER (WHERE a.state = 'active')       AS active,
        COUNT(*) FILTER (WHERE a.state = 'acknowledged')  AS acknowledged,
        COUNT(*) FILTER (WHERE a.state = 'resolved' AND a.resolved_at > NOW() - INTERVAL '24 hours') AS resolved_24h,
        COUNT(*) FILTER (WHERE a.state = 'suppressed')    AS suppressed,
        COUNT(*) FILTER (WHERE a.severity = 'critical' AND a.state = 'active') AS critical_active
      FROM alerts a
      LEFT JOIN devices d ON d.id = a.device_id
      ${summaryWhere}
    `, summaryParams);

    return Response.json({
      alerts: alerts.rows,
      category,
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
  const tenantSlug = session.user.tenantSlug;
  const userName = session.user.name || session.user.email || 'Unknown';

  try {
    const body = await req.json();
    const { alertId, action } = body;

    if (!alertId || !['acknowledge', 'resolve'].includes(action)) {
      return Response.json({ error: 'Invalid request — need alertId and action (acknowledge|resolve)' }, { status: 400 });
    }

    // ── ACKNOWLEDGE ──
    // 1. Set state to acknowledged
    // 2. Create GLPI ticket (if none exists)
    // 3. Store ticket ID on the alert
    if (action === 'acknowledge') {
      // Get alert details for ticket creation
      const alertResult = await queryWithTenant(tenantId, `
        SELECT a.id, a.title, a.description, a.severity, a.alert_type,
               a.state, a.glpi_ticket_id, a.triggered_at,
               d.name AS device_name, d.device_type, d.ip_address,
               s.name AS site_name
        FROM alerts a
        LEFT JOIN devices d ON d.id = a.device_id
        LEFT JOIN sites s ON s.id = a.site_id
        WHERE a.id = $1 AND a.state = 'active'
      `, [alertId]);

      if (alertResult.rows.length === 0) {
        return Response.json({ error: 'Alert not found or not active' }, { status: 404 });
      }

      const alert = alertResult.rows[0];

      // Update state to acknowledged
      await queryWithTenant(tenantId, `
        UPDATE alerts
        SET state = 'acknowledged',
            acknowledged_at = NOW()
        WHERE id = $1
      `, [alertId]);

      // Create GLPI ticket if none exists
      let glpiTicket = null;
      if (!alert.glpi_ticket_id) {
        const ticketDescription = [
          alert.description || '',
          '',
          `<p><strong>Alert Details:</strong></p>`,
          `<ul>`,
          `<li>Severity: <strong>${alert.severity?.toUpperCase()}</strong></li>`,
          `<li>Type: ${alert.alert_type?.replace(/_/g, ' ')}</li>`,
          alert.device_name ? `<li>Device: ${alert.device_name}${alert.ip_address ? ` (${alert.ip_address})` : ''}</li>` : '',
          alert.site_name ? `<li>Site: ${alert.site_name}</li>` : '',
          `<li>Triggered: ${new Date(alert.triggered_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>`,
          `<li>Acknowledged by: ${userName}</li>`,
          `</ul>`,
        ].filter(Boolean).join('\n');

        glpiTicket = await createGLPITicket({
          title: `[VEMIO] ${alert.title}`,
          description: ticketDescription,
          severity: alert.severity,
          tenantSlug,
          alertType: alert.alert_type,
          deviceName: alert.device_name,
          siteName: alert.site_name,
        });

        // Store GLPI ticket ID on the alert
        if (glpiTicket?.ticketId) {
          await queryWithTenant(tenantId, `
            UPDATE alerts SET glpi_ticket_id = $1 WHERE id = $2
          `, [glpiTicket.ticketId.toString(), alertId]);
        }
      }

      return Response.json({
        success: true,
        alert: { id: alertId, state: 'acknowledged' },
        glpiTicket: glpiTicket ? {
          id: glpiTicket.ticketId,
          url: glpiTicket.ticketUrl,
        } : alert.glpi_ticket_id ? {
          id: parseInt(alert.glpi_ticket_id),
          url: `https://techsupport.vinayenterprises.co.in/front/ticket.form.php?id=${alert.glpi_ticket_id}`,
          existing: true,
        } : null,
      });
    }

    // ── RESOLVE ──
    // 1. Set state to resolved
    // 2. Close GLPI ticket with downtime duration
    if (action === 'resolve') {
      // Get alert details for ticket closure
      const alertResult = await queryWithTenant(tenantId, `
        SELECT a.id, a.title, a.severity, a.state,
               a.triggered_at, a.acknowledged_at, a.glpi_ticket_id,
               d.name AS device_name,
               s.name AS site_name
        FROM alerts a
        LEFT JOIN devices d ON d.id = a.device_id
        LEFT JOIN sites s ON s.id = a.site_id
        WHERE a.id = $1 AND a.state IN ('active', 'acknowledged')
      `, [alertId]);

      if (alertResult.rows.length === 0) {
        return Response.json({ error: 'Alert not found or already resolved' }, { status: 404 });
      }

      const alert = alertResult.rows[0];
      const resolvedAt = new Date();
      const triggeredAt = new Date(alert.triggered_at);
      const downtimeMs = resolvedAt.getTime() - triggeredAt.getTime();

      // Format downtime
      const downtimeMin = Math.floor(downtimeMs / 60000);
      let downtimeStr;
      if (downtimeMin < 60) {
        downtimeStr = `${downtimeMin} minutes`;
      } else if (downtimeMin < 1440) {
        const h = Math.floor(downtimeMin / 60);
        const m = downtimeMin % 60;
        downtimeStr = `${h}h ${m}m`;
      } else {
        const d = Math.floor(downtimeMin / 1440);
        const h = Math.floor((downtimeMin % 1440) / 60);
        downtimeStr = `${d}d ${h}h`;
      }

      // Update state to resolved
      await queryWithTenant(tenantId, `
        UPDATE alerts
        SET state = 'resolved',
            resolved_at = NOW()
        WHERE id = $1
      `, [alertId]);

      // Close GLPI ticket if one exists
      let ticketClosed = false;
      if (alert.glpi_ticket_id) {
        const resolutionNote = [
          `<p><strong>Alert Resolved</strong></p>`,
          `<p>Resolved by: ${userName}</p>`,
          `<p>Total duration: <strong>${downtimeStr}</strong></p>`,
          `<ul>`,
          `<li>Triggered: ${triggeredAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>`,
          alert.acknowledged_at ? `<li>Acknowledged: ${new Date(alert.acknowledged_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>` : '',
          `<li>Resolved: ${resolvedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>`,
          `</ul>`,
          `<p style="color: #999; font-size: 11px;">Resolved via VEMIO™ Dashboard</p>`,
        ].filter(Boolean).join('\n');

        const result = await closeGLPITicket(parseInt(alert.glpi_ticket_id), resolutionNote);
        ticketClosed = !!result;
      }

      return Response.json({
        success: true,
        alert: { id: alertId, state: 'resolved' },
        downtime: downtimeStr,
        glpiTicketClosed: ticketClosed,
        glpiTicketId: alert.glpi_ticket_id ? parseInt(alert.glpi_ticket_id) : null,
      });
    }
  } catch (err) {
    console.error('[API /alerts PATCH] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});