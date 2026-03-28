/**
 * VEMIO™ — Alerts API
 * GET  /api/alerts  — List alerts with filters
 * PATCH /api/alerts — Acknowledge or resolve an alert
 *
 * ACCESS CONTROL:
 *   Only MSP tenant (VE HQ) users can acknowledge/resolve.
 *   Client tenant users are read-only for alert management.
 *   VE HQ admins → acknowledge + resolve
 *   VE HQ viewers → acknowledge only (escalate resolve to admin)
 *
 * GLPI INTEGRATION:
 *   Acknowledge → creates GLPI ticket (best-effort, state change always succeeds)
 *   Resolve → closes GLPI ticket with downtime duration
 *
 * AUDIT TRAIL:
 *   acknowledged_by / resolved_by stored on the alert row
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { createGLPITicket, closeGLPITicket } from '@/lib/glpi';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

// MSP tenant ID — Vinay Enterprises HQ
// Only users on this tenant can manage alerts across all tenants
const MSP_TENANT_ID = '0a3de3a4-1f08-422d-bdb2-03e98344ceff';

function isMSPUser(session) {
  return session.user.tenantId === MSP_TENANT_ID;
}

function isMSPAdmin(session) {
  return isMSPUser(session) && session.user.role === 'admin';
}

function formatDowntime(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} minutes`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}


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
    let idx = 1;

    if (state)    { conditions.push(`a.state = $${idx}`);    params.push(state);    idx++; }
    if (severity) { conditions.push(`a.severity = $${idx}`); params.push(severity); idx++; }
    if (type)     { conditions.push(`a.alert_type = $${idx}`); params.push(type);   idx++; }

    if (category !== 'all') {
      conditions.push(`(d.device_type = ANY($${idx}) OR d.device_type IS NULL)`);
      params.push(NETWORK_TYPES); idx++;
    }
    conditions.push(`(d.is_retired = false OR d.id IS NULL)`);

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total FROM alerts a LEFT JOIN devices d ON d.id = a.device_id ${where}`, params);

    const alerts = await queryWithTenant(tenantId, `
      SELECT
        a.id, a.alert_type, a.severity, a.state,
        a.title, a.description, a.source_type,
        a.notification_sent, a.notification_channel,
        a.triggered_at, a.acknowledged_at, a.resolved_at,
        a.acknowledged_by, a.resolved_by,
        a.glpi_ticket_id,
        d.name AS device_name, d.device_type,
        s.name AS site_name
      FROM alerts a
      LEFT JOIN devices d ON d.id = a.device_id
      LEFT JOIN sites s ON s.id = a.site_id
      ${where}
      ORDER BY
        CASE a.state WHEN 'active' THEN 0 WHEN 'acknowledged' THEN 1 ELSE 2 END,
        CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        a.triggered_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    // Summary
    const sConds = [];
    const sParams = [];
    let sIdx = 1;
    if (category !== 'all') {
      sConds.push(`(d.device_type = ANY($${sIdx}) OR d.device_type IS NULL)`);
      sParams.push(NETWORK_TYPES); sIdx++;
    }
    sConds.push(`(d.is_retired = false OR d.id IS NULL)`);
    const sWhere = sConds.length > 0 ? 'WHERE ' + sConds.join(' AND ') : '';

    const summary = await queryWithTenant(tenantId, `
      SELECT
        COUNT(*) FILTER (WHERE a.state = 'active')       AS active,
        COUNT(*) FILTER (WHERE a.state = 'acknowledged')  AS acknowledged,
        COUNT(*) FILTER (WHERE a.state = 'resolved' AND a.resolved_at > NOW() - INTERVAL '24 hours') AS resolved_24h,
        COUNT(*) FILTER (WHERE a.state = 'suppressed')    AS suppressed,
        COUNT(*) FILTER (WHERE a.severity = 'critical' AND a.state = 'active') AS critical_active
      FROM alerts a LEFT JOIN devices d ON d.id = a.device_id ${sWhere}
    `, sParams);

    return Response.json({
      alerts: alerts.rows,
      category,
      // Tell the frontend whether this user can manage alerts
      canManage: isMSPUser(session),
      canResolve: isMSPAdmin(session),
      summary: {
        active:          parseInt(summary.rows[0].active),
        acknowledged:    parseInt(summary.rows[0].acknowledged),
        resolved_24h:    parseInt(summary.rows[0].resolved_24h),
        suppressed:      parseInt(summary.rows[0].suppressed),
        critical_active: parseInt(summary.rows[0].critical_active),
      },
      pagination: { total: parseInt(countResult.rows[0].total), limit, offset },
    });
  } catch (err) {
    console.error('[API /alerts GET] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});


export const PATCH = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const tenantSlug = session.user.tenantSlug;
  const userName = session.user.name || session.user.email || 'Unknown';

  // ── Access control: only MSP (VE HQ) users can manage alerts ──
  if (!isMSPUser(session)) {
    return Response.json(
      { error: 'Alert management is restricted to Vinay Enterprises operations team' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { alertId, action } = body;

    if (!alertId || !['acknowledge', 'resolve'].includes(action)) {
      return Response.json({ error: 'Invalid request — need alertId and action (acknowledge|resolve)' }, { status: 400 });
    }

    // ── ACKNOWLEDGE ──
    if (action === 'acknowledge') {
      // Get alert details
      const alertResult = await queryWithTenant(tenantId, `
        SELECT a.id, a.title, a.description, a.severity, a.alert_type,
               a.state, a.glpi_ticket_id, a.triggered_at,
               d.name AS device_name, d.device_type, d.ip_address,
               s.name AS site_name,
               t.slug AS alert_tenant_slug
        FROM alerts a
        LEFT JOIN devices d ON d.id = a.device_id
        LEFT JOIN sites s ON s.id = a.site_id
        LEFT JOIN tenants t ON t.id = a.tenant_id
        WHERE a.id = $1 AND a.state = 'active'
      `, [alertId]);

      if (alertResult.rows.length === 0) {
        return Response.json({ error: 'Alert not found or not in active state' }, { status: 404 });
      }

      const alert = alertResult.rows[0];

      // Update state + audit trail
      await queryWithTenant(tenantId, `
        UPDATE alerts
        SET state = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1
        WHERE id = $2
      `, [userName, alertId]);

      // Create GLPI ticket (best-effort — never blocks state change)
      let glpiTicket = null;
      if (!alert.glpi_ticket_id) {
        const desc = [
          alert.description || '',
          `<p><strong>Alert Details:</strong></p><ul>`,
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
          description: desc,
          severity: alert.severity,
          tenantSlug: alert.alert_tenant_slug || tenantSlug,
          alertType: alert.alert_type,
          deviceName: alert.device_name,
          siteName: alert.site_name,
        });

        if (glpiTicket?.ticketId) {
          // Store ticket ID — best effort, don't fail if this UPDATE fails
          try {
            await queryWithTenant(tenantId, `
              UPDATE alerts SET glpi_ticket_id = $1 WHERE id = $2
            `, [glpiTicket.ticketId.toString(), alertId]);
          } catch (e) {
            console.error('[Alerts] Failed to store GLPI ticket ID:', e.message);
          }
        }
      }

      return Response.json({
        success: true,
        alert: { id: alertId, state: 'acknowledged', acknowledged_by: userName },
        glpiTicket: glpiTicket
          ? { id: glpiTicket.ticketId, url: glpiTicket.ticketUrl }
          : alert.glpi_ticket_id
            ? { id: parseInt(alert.glpi_ticket_id), url: `https://techsupport.vinayenterprises.co.in/front/ticket.form.php?id=${alert.glpi_ticket_id}`, existing: true }
            : null,
      });
    }

    // ── RESOLVE ──
    if (action === 'resolve') {
      // Only MSP admins can resolve
      if (!isMSPAdmin(session)) {
        return Response.json(
          { error: 'Only administrators can resolve alerts. Please escalate to an admin.' },
          { status: 403 }
        );
      }

      const alertResult = await queryWithTenant(tenantId, `
        SELECT a.id, a.title, a.severity, a.state,
               a.triggered_at, a.acknowledged_at, a.acknowledged_by, a.glpi_ticket_id,
               d.name AS device_name, s.name AS site_name
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
      const downtimeStr = formatDowntime(resolvedAt.getTime() - triggeredAt.getTime());

      // Update state + audit trail
      await queryWithTenant(tenantId, `
        UPDATE alerts
        SET state = 'resolved', resolved_at = NOW(), resolved_by = $1
        WHERE id = $2
      `, [userName, alertId]);

      // Close GLPI ticket (best-effort)
      let ticketClosed = false;
      if (alert.glpi_ticket_id) {
        const note = [
          `<p><strong>Alert Resolved</strong></p>`,
          `<p>Resolved by: ${userName}</p>`,
          `<p>Total duration: <strong>${downtimeStr}</strong></p>`,
          `<ul>`,
          `<li>Triggered: ${triggeredAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>`,
          alert.acknowledged_by ? `<li>Acknowledged by: ${alert.acknowledged_by} at ${new Date(alert.acknowledged_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>` : '',
          `<li>Resolved: ${resolvedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</li>`,
          `</ul>`,
          `<p style="color:#999;font-size:11px;">Resolved via VEMIO™ Dashboard</p>`,
        ].filter(Boolean).join('\n');

        ticketClosed = !!(await closeGLPITicket(parseInt(alert.glpi_ticket_id), note));
      }

      return Response.json({
        success: true,
        alert: { id: alertId, state: 'resolved', resolved_by: userName },
        downtime: downtimeStr,
        glpiTicketClosed: ticketClosed,
      });
    }
  } catch (err) {
    console.error('[API /alerts PATCH] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});