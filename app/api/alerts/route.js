/**
 * VEMIO™ — Alerts API
 * GET  /api/alerts  — List alerts with filters
 * PATCH /api/alerts — Acknowledge or resolve an alert
 *
 * PHASE 6.1: Cross-tenant MSP support.
 *   GET: MSP users can view alerts across all managed tenants.
 *   PATCH: MSP users can manage alerts for any managed tenant.
 *
 * ACCESS CONTROL:
 *   MSP tenant users → acknowledge + resolve (admin) / acknowledge only (viewer)
 *   Client tenant users → read-only for alert management
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant, queryAggregateForTenant } from '@/lib/tenant';
import { createGLPITicket, closeGLPITicket } from '@/lib/glpi';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

function isMSPUser(session) {
  return session.user.isMSP === true;
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
  const { searchParams } = new URL(req.url);
  const state    = searchParams.get('state');
  const severity = searchParams.get('severity');
  const type     = searchParams.get('type');
  const category = searchParams.get('category') || 'all';
  const limit    = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset   = parseInt(searchParams.get('offset') || '0', 10);

  // ── Phase 6.1: Resolve target tenant(s) ──
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  const isAllMode = target.mode === 'all';

  try {
    const conditions = [];
    const params = [];
    let idx = 1;

    if (state) {
  const stateArr = state.split(',').map(s => s.trim()).filter(Boolean);
  if (stateArr.length === 1) {
    conditions.push(`a.state = $${idx}`);
    params.push(stateArr[0]);
  } else {
    conditions.push(`a.state = ANY($${idx}::alert_state[])`);
    params.push(stateArr);
  }
  idx++;
}
    if (severity) {
  const sevArr = severity.split(',').map(s => s.trim()).filter(Boolean);
  if (sevArr.length === 1) {
    conditions.push(`a.severity = $${idx}`);
    params.push(sevArr[0]);
  } else {
    conditions.push(`a.severity = ANY($${idx}::alert_severity[])`);
    params.push(sevArr);
  }
  idx++;
}
    if (type)     { conditions.push(`a.alert_type = $${idx}`); params.push(type);   idx++; }

    if (category !== 'all') {
      conditions.push(`(d.device_type = ANY($${idx}) OR d.device_type IS NULL)`);
      params.push(NETWORK_TYPES); idx++;
    }
    conditions.push(`(d.is_retired = false OR d.id IS NULL)`);

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Fetch alerts (across tenants if MSP all mode)
    const alertsResult = await queryForTenant(target, `
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
        a.triggered_at DESC`,
      params,
      { addTenantInfo: isAllMode }
    );

    // Apply pagination on merged results
    let allAlerts = alertsResult.rows;
    if (isAllMode) {
      // Re-sort merged results (state priority → severity priority → time)
      const stateOrder = { active: 0, acknowledged: 1, resolved: 2, suppressed: 3 };
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      allAlerts.sort((a, b) => {
        const sd = (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9);
        if (sd !== 0) return sd;
        const svd = (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9);
        if (svd !== 0) return svd;
        return new Date(b.triggered_at) - new Date(a.triggered_at);
      });
    }

    const total = allAlerts.length;
    const paginatedAlerts = allAlerts.slice(offset, offset + limit);

    // Summary (aggregated across tenants)
    const sConds = [];
    const sParams = [];
    let sIdx = 1;
    if (category !== 'all') {
      sConds.push(`(d.device_type = ANY($${sIdx}) OR d.device_type IS NULL)`);
      sParams.push(NETWORK_TYPES); sIdx++;
    }
    sConds.push(`(d.is_retired = false OR d.id IS NULL)`);
    const sWhere = sConds.length > 0 ? 'WHERE ' + sConds.join(' AND ') : '';

    const summaryAgg = await queryAggregateForTenant(target, `
      SELECT
        COUNT(*) FILTER (WHERE a.state = 'active')       AS active,
        COUNT(*) FILTER (WHERE a.state = 'acknowledged')  AS acknowledged,
        COUNT(*) FILTER (WHERE a.state = 'resolved' AND a.resolved_at > NOW() - INTERVAL '24 hours') AS resolved_24h,
        COUNT(*) FILTER (WHERE a.state = 'suppressed')    AS suppressed,
        COUNT(*) FILTER (WHERE a.severity = 'critical' AND a.state = 'active') AS critical_active
      FROM alerts a LEFT JOIN devices d ON d.id = a.device_id ${sWhere}
    `, sParams);

    return Response.json({
      alerts: paginatedAlerts.map(a => ({
        ...a,
        // Phase 6.1: include tenant info in all-tenants mode
        ...(a._tenant_name && {
          tenant_name: a._tenant_name,
          tenant_slug: a._tenant_slug,
          tenant_id: a._tenant_id,
        }),
        // Clean internal fields
        _tenant_name: undefined,
        _tenant_slug: undefined,
        _tenant_id: undefined,
      })),
      isAllTenants: isAllMode,
      category,
      canManage: isMSPUser(session),
      canResolve: isMSPAdmin(session),
      summary: {
        active:          parseInt(summaryAgg.active || 0),
        acknowledged:    parseInt(summaryAgg.acknowledged || 0),
        resolved_24h:    parseInt(summaryAgg.resolved_24h || 0),
        suppressed:      parseInt(summaryAgg.suppressed || 0),
        critical_active: parseInt(summaryAgg.critical_active || 0),
      },
      pagination: { total, limit, offset },
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

  // ── Access control: only MSP users can manage alerts ──
  if (!isMSPUser(session)) {
    return Response.json(
      { error: 'Alert management is restricted to MSP operations team' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { alertId, action, alertTenantId } = body;

    if (!alertId || !['acknowledge', 'resolve'].includes(action)) {
      return Response.json({ error: 'Invalid request — need alertId and action (acknowledge|resolve)' }, { status: 400 });
    }

    // Determine which tenant's alert we're acting on
    // The alertTenantId comes from the frontend (set in all-tenants mode)
    // We validate MSP has access to this tenant
    const targetTenantId = alertTenantId || tenantId;

    // For MSP users operating on a different tenant's alert,
    // validate access via msp_tenant_access
    if (alertTenantId && alertTenantId !== tenantId) {
      const accessCheck = await queryWithTenant(tenantId,
        `SELECT 1 FROM msp_tenant_access
         WHERE msp_tenant_id = $1 AND managed_tenant_id = $2`,
        [tenantId, alertTenantId]
      );
      if (accessCheck.rows.length === 0) {
        return Response.json({ error: 'Access denied to this tenant' }, { status: 403 });
      }
    }

    // ── ACKNOWLEDGE ──
    if (action === 'acknowledge') {
      const alertResult = await queryWithTenant(targetTenantId, `
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

      await queryWithTenant(targetTenantId, `
        UPDATE alerts
        SET state = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1
        WHERE id = $2
      `, [userName, alertId]);

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
          try {
            await queryWithTenant(targetTenantId, `
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
      if (!isMSPAdmin(session)) {
        return Response.json(
          { error: 'Only administrators can resolve alerts. Please escalate to an admin.' },
          { status: 403 }
        );
      }

      const alertResult = await queryWithTenant(targetTenantId, `
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

      await queryWithTenant(targetTenantId, `
        UPDATE alerts
        SET state = 'resolved', resolved_at = NOW(), resolved_by = $1
        WHERE id = $2
      `, [userName, alertId]);

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
