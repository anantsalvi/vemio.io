/**
 * VEMIO™ — Overview API
 * GET /api/overview
 * 
 * Returns dashboard overview data: BCS score, device summary,
 * alert count, SLA gauge, uptime trend, recent events.
 * 
 * Query params:
 *   category — 'network' (default) or 'all'
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);
  const category = url.searchParams.get('category') || 'network';

  // Build device type filter
  const deviceTypeFilter = category !== 'all'
    ? 'AND device_type = ANY($1)'
    : '';
  const typeParams = category !== 'all' ? [NETWORK_TYPES] : [];

  let overview;

  try {
    // Device summary
    const deviceSummary = await queryWithTenant(tenantId,
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE current_status = 'up') AS up,
         COUNT(*) FILTER (WHERE current_status = 'down') AS down,
         COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded,
         COUNT(*) FILTER (WHERE current_status = 'unknown') AS unknown
       FROM devices
       WHERE is_retired = false ${deviceTypeFilter}`,
      typeParams
    );

    // Latest BCS score (filtered by category)
    const bcsResult = await queryWithTenant(tenantId,
      `SELECT score, visibility_coverage, redundancy_readiness, alerting_maturity, response_discipline, computed_at
       FROM bcs_scores
       WHERE category = $1
       ORDER BY computed_at DESC
       LIMIT 1`,
      [category]
    );

    // Active alerts count
    const alertResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS count
       FROM alerts
       WHERE state = 'active'`
    );

    // Site count
    const siteResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS count FROM sites WHERE is_active = TRUE`
    );

    const devices = deviceSummary.rows[0];
    const hasRealData = parseInt(devices.total) > 0;

    if (hasRealData) {
      const bcs = bcsResult.rows[0] || null;
      overview = {
        source: 'live',
        category,
        bcs: bcs ? {
          overall: parseFloat(bcs.score),
          deviceHealth: parseFloat(bcs.visibility_coverage),
          ticketHealth: parseFloat(bcs.alerting_maturity),
          sla: parseFloat(bcs.response_discipline),
          calculatedAt: bcs.computed_at,
        } : null,
        devices: {
          total: parseInt(devices.total),
          up: parseInt(devices.up),
          down: parseInt(devices.down),
          degraded: parseInt(devices.degraded),
          unknown: parseInt(devices.unknown),
        },
        alerts: { active: parseInt(alertResult.rows[0].count) },
        sites: { total: parseInt(siteResult.rows[0].count) },
      };

      // Uptime trend — daily average from device_status_history
      try {
        const trendResult = await queryWithTenant(tenantId,
          `WITH daily AS (
             SELECT 
               DATE(changed_at) AS day,
               COUNT(*) FILTER (WHERE status = 'up') AS up_events,
               COUNT(*) AS total_events
             FROM device_status_history
             WHERE changed_at > NOW() - INTERVAL '7 days'
             GROUP BY DATE(changed_at)
             ORDER BY day
           )
           SELECT day, 
             CASE WHEN total_events > 0 
               THEN ROUND((up_events::numeric / total_events) * 100, 1)
               ELSE NULL END AS uptime
           FROM daily`
        );

        if (trendResult.rows.length > 0) {
          overview.uptimeTrend = trendResult.rows.map(r => ({
            date: r.day.toISOString().split('T')[0],
            uptime: r.uptime ? parseFloat(r.uptime) : null,
          }));
        }
      } catch (err) {
        console.error('[VEMIO API] Uptime trend query error:', err.message);
      }

      // Recent events from device_status_history
      try {
        const eventsParams = category !== 'all' ? [NETWORK_TYPES] : [];
        const eventsTypeFilter = category !== 'all'
          ? 'AND d.device_type = ANY($1)'
          : '';

        const eventsResult = await queryWithTenant(tenantId,
          `SELECT 
             dsh.status,
             dsh.changed_at,
             dsh.source AS event_source,
             d.id AS device_id,
             d.name AS device_name,
             d.device_type,
             d.ip_address,
             s.name AS site_name
           FROM device_status_history dsh
           JOIN devices d ON d.id = dsh.device_id
           LEFT JOIN sites s ON s.id = d.site_id
           WHERE dsh.changed_at > NOW() - INTERVAL '24 hours'
             AND d.is_retired = false
             ${eventsTypeFilter}
           ORDER BY dsh.changed_at DESC
           LIMIT 20`,
          eventsParams
        );

        if (eventsResult.rows.length > 0) {
          overview.recentEvents = eventsResult.rows.map(r => {
            const name = r.device_name || 'Unknown device';
            const type = formatDeviceType(r.device_type);
            let message, eventType, severity;

            switch (r.status) {
              case 'down':
                message = `${name} went offline`;
                eventType = 'alert';
                severity = 'high';
                break;
              case 'degraded':
                message = `${name} degraded`;
                eventType = 'alert';
                severity = 'medium';
                break;
              case 'up':
                message = `${name} back online`;
                eventType = 'resolved';
                severity = 'info';
                break;
              default:
                message = `${name} status: ${r.status}`;
                eventType = 'report';
                severity = 'info';
            }

            return {
              time: new Date(r.changed_at).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
              }),
              timestamp: r.changed_at,
              type: eventType,
              message,
              severity,
              site: r.site_name || 'Unknown',
              deviceType: type,
              device_name: r.device_name,
              device_id: r.device_id,
              ip_address: r.ip_address,
            };
          });
        }
      } catch (err) {
        console.error('[VEMIO API] Recent events query error:', err.message);
      }
    } else {
      overview = getDemoOverview();
    }
  } catch (err) {
    console.error('[VEMIO API] Overview query failed, using demo data:', err.message);
    overview = getDemoOverview();
  }

  return Response.json(overview);
});


function formatDeviceType(type) {
  const map = {
    firewall: 'Firewall',
    core_switch: 'Core Switch',
    access_switch: 'Access Switch',
    router: 'Router',
    access_point: 'AP',
    server: 'Server',
    nas: 'NAS',
    ups: 'UPS',
    printer: 'Printer',
    other: 'Device',
  };
  return map[type] || 'Device';
}


function getDemoOverview() {
  return {
    source: 'demo',
    bcs: {
      overall: 87.4,
      deviceHealth: 91.2,
      ticketHealth: 78.5,
      sla: 92.6,
      calculatedAt: new Date().toISOString(),
    },
    devices: {
      total: 142,
      up: 134,
      down: 3,
      degraded: 2,
      unknown: 3,
    },
    alerts: { active: 5 },
    sites: { total: 4 },
    uptimeTrend: [
      { date: '2026-03-23', uptime: 99.2 },
      { date: '2026-03-24', uptime: 99.8 },
      { date: '2026-03-25', uptime: 98.4 },
      { date: '2026-03-26', uptime: 99.9 },
      { date: '2026-03-27', uptime: 99.7 },
      { date: '2026-03-28', uptime: 99.5 },
      { date: '2026-03-29', uptime: 99.8 },
    ],
    recentEvents: [
      { time: '14:32', type: 'alert', message: 'Core Switch SW-01 went offline', severity: 'high', site: 'HQ - Ahmedabad', deviceType: 'Core Switch' },
      { time: '13:15', type: 'resolved', message: 'AP-CONF-07 back online', severity: 'info', site: 'Warehouse', deviceType: 'AP' },
      { time: '11:48', type: 'alert', message: 'Firewall FW-02 degraded', severity: 'medium', site: 'Branch Office', deviceType: 'Firewall' },
      { time: '09:22', type: 'resolved', message: 'Server SRV-03 back online', severity: 'info', site: 'Data Center', deviceType: 'Server' },
      { time: '08:00', type: 'report', message: 'Daily BCS recalculated: 87.4', severity: 'info', site: 'System', deviceType: 'System' },
    ],
  };
}