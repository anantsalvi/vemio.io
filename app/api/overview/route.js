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
      `SELECT overall_score, device_health_score, ticket_health_score, sla_score, calculated_at
       FROM bcs_scores
       ORDER BY calculated_at DESC
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
          overall: parseFloat(bcs.overall_score),
          deviceHealth: parseFloat(bcs.device_health_score),
          ticketHealth: parseFloat(bcs.ticket_health_score),
          sla: parseFloat(bcs.sla_score),
          calculatedAt: bcs.calculated_at,
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
