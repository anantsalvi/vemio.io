/**
 * VEMIO™ — Overview API
 * GET /api/overview
 * 
 * Returns dashboard overview data: BCS score, device summary,
 * alert count, SLA gauge, uptime trend, recent events.
 * 
 * Query params:
 *   category — 'network' (default) or 'all'
 *   tenantId — UUID of target tenant, or 'all' (MSP only)
 * 
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant, queryAggregateForTenant } from '@/lib/tenant';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const category = url.searchParams.get('category') || 'network';

  // ── Phase 6.1: Resolve target tenant(s) ──
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  // Build device type filter
  const deviceTypeFilter = category !== 'all'
    ? 'AND device_type = ANY($1)'
    : '';
  const typeParams = category !== 'all' ? [NETWORK_TYPES] : [];

  let overview;

  try {
    // Device summary (aggregated across tenants if MSP "all" mode)
    const deviceSummary = await queryAggregateForTenant(target,
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

    // Latest BCS score — for "all" mode, average across tenants
    let bcs = null;
    if (target.mode === 'single') {
      const bcsResult = await queryWithTenant(target.tenantId,
        `SELECT score, visibility_coverage, redundancy_readiness, alerting_maturity, response_discipline, computed_at
         FROM bcs_scores
         WHERE category = $1
         ORDER BY computed_at DESC
         LIMIT 1`,
        [category]
      );
      bcs = bcsResult.rows[0] || null;
    } else {
      // All-tenants: fetch latest per tenant and average
      const bcsResult = await queryForTenant(target,
        `SELECT score, visibility_coverage, redundancy_readiness, alerting_maturity, response_discipline, computed_at
         FROM bcs_scores
         WHERE category = $1
         ORDER BY computed_at DESC
         LIMIT 1`,
        [category]
      );
      if (bcsResult.rows.length > 0) {
        const scores = bcsResult.rows;
        bcs = {
          score: (scores.reduce((s, r) => s + parseFloat(r.score), 0) / scores.length).toFixed(1),
          visibility_coverage: (scores.reduce((s, r) => s + parseFloat(r.visibility_coverage), 0) / scores.length).toFixed(2),
          alerting_maturity: (scores.reduce((s, r) => s + parseFloat(r.alerting_maturity), 0) / scores.length).toFixed(2),
          response_discipline: (scores.reduce((s, r) => s + parseFloat(r.response_discipline), 0) / scores.length).toFixed(2),
          computed_at: scores[0].computed_at,
        };
      }
    }

    // Active alerts count
    const alertAgg = await queryAggregateForTenant(target,
      `SELECT COUNT(*) AS count FROM alerts WHERE state = 'active'`
    );

    // Site count
    const siteAgg = await queryAggregateForTenant(target,
      `SELECT COUNT(*) AS count FROM sites WHERE is_active = TRUE`
    );

    const hasRealData = parseInt(deviceSummary.total || 0) > 0;

    if (hasRealData) {
      overview = {
        source: 'live',
        category,
        isAllTenants: target.mode === 'all',
        bcs: bcs ? {
          overall: parseFloat(bcs.score),
          deviceHealth: parseFloat(bcs.visibility_coverage),
          ticketHealth: parseFloat(bcs.alerting_maturity),
          sla: parseFloat(bcs.response_discipline),
          calculatedAt: bcs.computed_at,
        } : null,
        devices: {
          total: parseInt(deviceSummary.total || 0),
          up: parseInt(deviceSummary.up || 0),
          down: parseInt(deviceSummary.down || 0),
          degraded: parseInt(deviceSummary.degraded || 0),
          unknown: parseInt(deviceSummary.unknown || 0),
        },
        alerts: { active: parseInt(alertAgg.count || 0) },
        sites: { total: parseInt(siteAgg.count || 0) },
      };

      // Uptime trend
      try {
        const trendResult = await queryForTenant(target,
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
          // For all-tenants mode, group by day and average
          if (target.mode === 'all') {
            const byDay = {};
            for (const r of trendResult.rows) {
              const day = r.day.toISOString().split('T')[0];
              if (!byDay[day]) byDay[day] = [];
              if (r.uptime != null) byDay[day].push(parseFloat(r.uptime));
            }
            overview.uptimeTrend = Object.entries(byDay)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, values]) => ({
                date,
                uptime: values.length > 0
                  ? parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1))
                  : null,
              }));
          } else {
            overview.uptimeTrend = trendResult.rows.map(r => ({
              date: r.day.toISOString().split('T')[0],
              uptime: r.uptime ? parseFloat(r.uptime) : null,
            }));
          }
        }
      } catch (err) {
        console.error('[VEMIO API] Uptime trend query error:', err.message);
      }

      // Recent events
      try {
        const eventsParams = category !== 'all' ? [NETWORK_TYPES] : [];
        const eventsTypeFilter = category !== 'all'
          ? 'AND d.device_type = ANY($1)'
          : '';

        const eventsResult = await queryForTenant(target,
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
          eventsParams,
          { addTenantInfo: target.mode === 'all' }
        );

        if (eventsResult.rows.length > 0) {
          // Sort merged results by time (all-tenants may interleave)
          const sorted = eventsResult.rows.sort(
            (a, b) => new Date(b.changed_at) - new Date(a.changed_at)
          ).slice(0, 20);

          overview.recentEvents = sorted.map(r => {
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
              // Phase 6.1: Tenant info in all-tenants mode
              ...(r._tenant_name && {
                tenant_name: r._tenant_name,
                tenant_slug: r._tenant_slug,
              }),
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