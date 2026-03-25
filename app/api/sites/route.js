/**
 * VEMIO™ — Sites API
 * GET /api/sites — All sites with device health rollup
 * GET /api/sites?id=<uuid> — Single site detail with device breakdown
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get('id');

  try {
    // Single site detail
    if (siteId) {
      return await getSiteDetail(tenantId, siteId);
    }

    // All sites with rollup
    const sites = await queryWithTenant(tenantId, `
      SELECT
        s.id, s.name, s.address, s.city, s.state, s.site_type,
        COUNT(d.id) AS total_devices,
        COUNT(d.id) FILTER (WHERE d.current_status = 'up') AS devices_up,
        COUNT(d.id) FILTER (WHERE d.current_status = 'down') AS devices_down,
        COUNT(d.id) FILTER (WHERE d.current_status = 'degraded') AS devices_degraded,
        COUNT(d.id) FILTER (WHERE d.current_status = 'unknown') AS devices_unknown,
        COUNT(d.id) FILTER (WHERE d.is_critical = TRUE) AS critical_devices,
        COUNT(d.id) FILTER (WHERE d.is_critical = TRUE AND d.current_status = 'down') AS critical_down,
        ROUND(
          CASE WHEN COUNT(d.id) > 0
            THEN COUNT(d.id) FILTER (WHERE d.current_status = 'up')::numeric / COUNT(d.id) * 100
            ELSE 0 END, 1
        ) AS health_percent
      FROM sites s
      LEFT JOIN devices d ON d.site_id = s.id AND d.is_monitored = TRUE
      WHERE s.is_active = TRUE
      GROUP BY s.id
      ORDER BY s.name
    `);

    // Active alerts per site
    const alertCounts = await queryWithTenant(tenantId, `
      SELECT site_id, COUNT(*) AS active_alerts,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical_alerts
      FROM alerts
      WHERE state = 'active' AND site_id IS NOT NULL
      GROUP BY site_id
    `);

    const alertMap = {};
    alertCounts.rows.forEach(r => {
      alertMap[r.site_id] = {
        active: parseInt(r.active_alerts),
        critical: parseInt(r.critical_alerts),
      };
    });

    // Open tickets per site
    const ticketCounts = await queryWithTenant(tenantId, `
      SELECT site_id, COUNT(*) AS open_tickets
      FROM tickets
      WHERE status NOT IN ('resolved', 'closed') AND site_id IS NOT NULL
      GROUP BY site_id
    `);

    const ticketMap = {};
    ticketCounts.rows.forEach(r => {
      ticketMap[r.site_id] = parseInt(r.open_tickets);
    });

    return Response.json({
      sites: sites.rows.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        site_type: s.site_type,
        devices: {
          total: parseInt(s.total_devices),
          up: parseInt(s.devices_up),
          down: parseInt(s.devices_down),
          degraded: parseInt(s.devices_degraded),
          unknown: parseInt(s.devices_unknown),
          critical: parseInt(s.critical_devices),
          critical_down: parseInt(s.critical_down),
        },
        health_percent: parseFloat(s.health_percent),
        alerts: alertMap[s.id] || { active: 0, critical: 0 },
        open_tickets: ticketMap[s.id] || 0,
      })),
    });
  } catch (err) {
    console.error('[API /sites] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

async function getSiteDetail(tenantId, siteId) {
  try {
    // Site info
    const site = await queryWithTenant(tenantId, `
      SELECT id, name, address, city, state, site_type
      FROM sites WHERE id = $1
    `, [siteId]);

    if (site.rows.length === 0) {
      return Response.json({ error: 'Site not found' }, { status: 404 });
    }

    // Devices at this site grouped by type
    const devicesByType = await queryWithTenant(tenantId, `
      SELECT device_type,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE current_status = 'up') AS up,
        COUNT(*) FILTER (WHERE current_status = 'down') AS down,
        COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded
      FROM devices
      WHERE site_id = $1 AND is_monitored = TRUE
      GROUP BY device_type
      ORDER BY
        CASE device_type
          WHEN 'firewall' THEN 1 WHEN 'core_switch' THEN 2 WHEN 'router' THEN 3
          WHEN 'access_switch' THEN 4 WHEN 'access_point' THEN 5 WHEN 'server' THEN 6
          ELSE 10 END
    `, [siteId]);

    // Critical devices at this site
    const criticalDevices = await queryWithTenant(tenantId, `
      SELECT id, name, device_type, current_status, has_redundancy,
        firmware_version, firmware_is_current, last_seen_at
      FROM devices
      WHERE site_id = $1 AND is_critical = TRUE AND is_monitored = TRUE
      ORDER BY device_type, name
    `, [siteId]);

    // Down devices at this site
    const downDevices = await queryWithTenant(tenantId, `
      SELECT id, name, device_type, last_seen_at
      FROM devices
      WHERE site_id = $1 AND current_status = 'down' AND is_monitored = TRUE
      ORDER BY last_seen_at DESC NULLS LAST
      LIMIT 20
    `, [siteId]);

    // Active alerts at this site
    const alerts = await queryWithTenant(tenantId, `
      SELECT a.id, a.alert_type, a.severity, a.title, a.triggered_at,
        d.name AS device_name
      FROM alerts a
      LEFT JOIN devices d ON d.id = a.device_id
      WHERE a.site_id = $1 AND a.state = 'active'
      ORDER BY
        CASE a.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
        a.triggered_at DESC
      LIMIT 10
    `, [siteId]);

    // Recent tickets
    const tickets = await queryWithTenant(tenantId, `
      SELECT id, glpi_ticket_id, title, priority, status, created_at,
        sla_resolution_met
      FROM tickets
      WHERE site_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [siteId]);

    return Response.json({
      site: site.rows[0],
      devices_by_type: devicesByType.rows.map(r => ({
        device_type: r.device_type,
        total: parseInt(r.total),
        up: parseInt(r.up),
        down: parseInt(r.down),
        degraded: parseInt(r.degraded),
      })),
      critical_devices: criticalDevices.rows,
      down_devices: downDevices.rows,
      active_alerts: alerts.rows,
      recent_tickets: tickets.rows,
    });
  } catch (err) {
    console.error('[API /sites detail] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}