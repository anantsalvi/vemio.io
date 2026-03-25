/**
 * VEMIO™ — Overview API
 * GET /api/overview
 * 
 * Returns dashboard overview data: BCS score, device summary,
 * alert count, SLA gauge, uptime trend.
 * 
 * Phase 1: Returns demo data alongside any real data from the DB.
 * Phase 2: Fully live data from Auvik sync.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;

  // Attempt to fetch real data; fall back to demo if tables are empty
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
       FROM devices`
    );

    // Latest BCS score
     const bcsResult = await queryWithTenant(tenantId,
      `SELECT score, visibility_coverage, redundancy_readiness, alerting_maturity, response_discipline, computed_at
       FROM bcs_scores
       ORDER BY computed_at DESC
       LIMIT 1`
    );

    // Active alerts (critical/high in last 24h)
    const alertResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS count
       FROM webhook_events
       WHERE event_type IN ('alert.triggered')
         AND processed = TRUE
         AND received_at > NOW() - INTERVAL '24 hours'`
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

      // Recent events from webhook_events
      try {
        const eventsResult = await queryWithTenant(tenantId,
          `SELECT 
             we.event_type, we.received_at, we.raw_payload,
             d.name AS device_name, s.name AS site_name
           FROM webhook_events we
           LEFT JOIN devices d ON d.auvik_device_id = we.auvik_device_id
           LEFT JOIN sites s ON s.id = we.site_id
           WHERE we.received_at > NOW() - INTERVAL '24 hours'
           ORDER BY we.received_at DESC
           LIMIT 10`
        );

        if (eventsResult.rows.length > 0) {
          overview.recentEvents = eventsResult.rows.map(r => ({
            time: new Date(r.received_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }),
            type: r.event_type.includes('alert') ? 'alert' : r.event_type.includes('resolved') ? 'resolved' : 'report',
            message: r.device_name || r.event_type,
            severity: 'info',
            site: r.site_name || 'Unknown',
          }));
        }
      } catch (err) {
        console.error('[VEMIO API] Recent events query error:', err.message);
      }
    } else {
      // Demo data — realistic for a mid-size textile company
      overview = getDemoOverview();
    }
  } catch (err) {
    console.error('[VEMIO API] Overview query failed, using demo data:', err.message);
    overview = getDemoOverview();
  }

  return Response.json(overview);
});


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
      { date: '2026-03-18', uptime: 99.2 },
      { date: '2026-03-19', uptime: 99.8 },
      { date: '2026-03-20', uptime: 98.4 },
      { date: '2026-03-21', uptime: 99.9 },
      { date: '2026-03-22', uptime: 99.7 },
      { date: '2026-03-23', uptime: 99.5 },
      { date: '2026-03-24', uptime: 99.8 },
    ],
    recentEvents: [
      { time: '14:32', type: 'alert', message: 'Core Switch SW-01 port 24 flapping', severity: 'high', site: 'HQ - Naroda' },
      { time: '13:15', type: 'resolved', message: 'AP-CONF-07 back online', severity: 'info', site: 'Warehouse - Narol' },
      { time: '11:48', type: 'alert', message: 'Firewall FW-02 CPU > 85%', severity: 'medium', site: 'Branch - Vatva' },
      { time: '09:22', type: 'maintenance', message: 'Scheduled firmware update: AP-series', severity: 'info', site: 'All sites' },
      { time: '08:00', type: 'report', message: 'Daily BCS recalculated: 87.4', severity: 'info', site: 'System' },
    ],
  };
}
