/**
 * VEMIO™ — Device Statistics API
 * GET /api/devices/[id]/stats
 *
 * Query params:
 *   ?period=24h|7d|30d|90d  (default: 24h)
 *   ?type=cpu,memory         (default: all)
 *
 * Returns time-series data for Recharts:
 *   { stats: { cpu: [...], memory: [...] }, current: { cpu: N, memory: N } }
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

const PERIOD_MAP = {
  '24h': { interval: '24 hours', resolution: null },         // full resolution (~288 points at 5min)
  '7d':  { interval: '7 days',   resolution: null },         // full resolution (~2016 points)
  '30d': { interval: '30 days',  resolution: 'hourly' },     // hourly averages
  '90d': { interval: '90 days',  resolution: 'hourly' },     // hourly averages
};

export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const deviceId = segments[segments.indexOf('devices') + 1];

  if (!deviceId) {
    return Response.json({ error: 'Device ID required' }, { status: 400 });
  }

  const period = url.searchParams.get('period') || '24h';
  const typeFilter = url.searchParams.get('type')?.split(',').filter(Boolean) || ['cpu', 'memory'];

  const periodConfig = PERIOD_MAP[period];
  if (!periodConfig) {
    return Response.json({ error: 'Invalid period. Use: 24h, 7d, 30d, 90d' }, { status: 400 });
  }

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Build stat_type filter
    const statTypes = [];
    for (const t of typeFilter) {
      if (periodConfig.resolution === 'hourly') {
        statTypes.push(`${t}_hourly`);
      } else {
        statTypes.push(t);
      }
    }

    // Fetch time-series
    const result = await queryForTenant(target, `
      SELECT stat_type, value, recorded_at
      FROM device_statistics
      WHERE device_id = $1
        AND stat_type = ANY($2)
        AND recorded_at >= NOW() - INTERVAL '${periodConfig.interval}'
      ORDER BY recorded_at ASC
    `, [deviceId, statTypes]);

    // Group by stat type
    const stats = {};
    for (const t of typeFilter) {
      stats[t] = [];
    }

    for (const row of result.rows) {
      // Strip _hourly suffix for consistent key names
      const baseType = row.stat_type.replace('_hourly', '');
      if (stats[baseType]) {
        stats[baseType].push({
          time: row.recorded_at,
          value: parseFloat(row.value),
        });
      }
    }

    // Fetch current (most recent) values
    const currentResult = await queryForTenant(target, `
      SELECT DISTINCT ON (stat_type) stat_type, value, recorded_at
      FROM device_statistics
      WHERE device_id = $1
        AND stat_type IN ('cpu', 'memory')
      ORDER BY stat_type, recorded_at DESC
    `, [deviceId]);

    const current = {};
    for (const row of currentResult.rows) {
      current[row.stat_type] = {
        value: parseFloat(row.value),
        at: row.recorded_at,
      };
    }

    return Response.json({ stats, current, period, deviceId });
  } catch (err) {
    console.error(`[VEMIO API] Device stats error:`, err.message);
    return Response.json({ error: 'Failed to fetch device statistics' }, { status: 500 });
  }
});
