/**
 * VEMIO™ — Availability API
 * GET /api/availability?days=7|30|90&category=network|all&tenantId=...
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

export const GET = withAuth(async (req, session) => {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 90);
    const category = searchParams.get('category') || 'network';
    const target = await resolveTargetTenant(session, req);

    if (target.error) {
      return NextResponse.json({ error: target.error }, { status: 403 });
    }

    const deviceTypeFilter = category !== 'all'
      ? 'AND d.device_type = ANY($2)'
      : '';
    const baseParams = category !== 'all' ? [days, NETWORK_TYPES] : [days];

    // ── 1. Per-device availability (uptime %) ──
    const deviceAvailSQL = `
      WITH history AS (
        SELECT
          dsh.device_id,
          d.name AS device_name,
          d.device_type,
          COALESCE(s.name, 'Unknown') AS site_name,
          COALESCE(d.is_critical, false) AS is_critical,
          dsh.status,
          dsh.changed_at,
          LEAD(dsh.changed_at) OVER (
            PARTITION BY dsh.device_id ORDER BY dsh.changed_at
          ) AS next_change
        FROM device_status_history dsh
        JOIN devices d ON d.id = dsh.device_id AND d.tenant_id = dsh.tenant_id
        LEFT JOIN sites s ON s.id = d.site_id AND s.tenant_id = d.tenant_id
        WHERE dsh.changed_at >= NOW() - make_interval(days => $1::int)
          AND d.is_monitored = true
          AND d.is_retired = false
          ${deviceTypeFilter}
      ),
      durations AS (
        SELECT
          device_id, device_name, device_type, site_name, is_critical, status,
          EXTRACT(EPOCH FROM (COALESCE(next_change, NOW()) - changed_at)) AS duration_secs
        FROM history
      ),
      device_stats AS (
        SELECT
          device_id, device_name, device_type, site_name, is_critical,
          SUM(duration_secs) AS total_secs,
          SUM(CASE WHEN status = 'up' THEN duration_secs ELSE 0 END) AS up_secs,
          SUM(CASE WHEN status = 'down' THEN duration_secs ELSE 0 END) AS down_secs,
          SUM(CASE WHEN status = 'degraded' THEN duration_secs ELSE 0 END) AS degraded_secs
        FROM durations
        GROUP BY device_id, device_name, device_type, site_name, is_critical
      )
      SELECT
        device_id, device_name, device_type, site_name, is_critical,
        total_secs, up_secs, down_secs, degraded_secs,
        CASE WHEN total_secs > 0
          THEN ROUND((up_secs / total_secs) * 100, 2) ELSE 100
        END AS uptime_pct
      FROM device_stats
      ORDER BY uptime_pct ASC, down_secs DESC
    `;

    const deviceResult = await queryForTenant(target, deviceAvailSQL, baseParams);
    const deviceRows = deviceResult.rows || deviceResult;

    // ── 2. Outage intervals for Gantt chart ──
    const outageSQL = `
      WITH history AS (
        SELECT
          dsh.device_id, d.name AS device_name, dsh.status, dsh.changed_at,
          LEAD(dsh.changed_at) OVER (PARTITION BY dsh.device_id ORDER BY dsh.changed_at) AS next_change
        FROM device_status_history dsh
        JOIN devices d ON d.id = dsh.device_id AND d.tenant_id = dsh.tenant_id
        WHERE dsh.changed_at >= NOW() - make_interval(days => $1::int)
          AND d.is_monitored = true AND d.is_retired = false
          AND dsh.status IN ('down', 'degraded')
          ${deviceTypeFilter}
      )
      SELECT device_id, device_name, status, changed_at AS start_time, COALESCE(next_change, NOW()) AS end_time
      FROM history ORDER BY changed_at DESC LIMIT 500
    `;

    const outageResult = await queryForTenant(target, outageSQL, baseParams);
    const outageRows = outageResult.rows || outageResult;

    // ── 3. Fleet-level stats ──
    const totalDevices = deviceRows.length;

    // Compute fleet availability (weighted by tracked time)
    const totalUpSecs = deviceRows.reduce((sum, d) => sum + parseFloat(d.up_secs || 0), 0);
    const totalSecs = deviceRows.reduce((sum, d) => sum + parseFloat(d.total_secs || 0), 0);
    const fleetAvailability = totalSecs > 0
      ? Math.round((totalUpSecs / totalSecs) * 10000) / 100 : 100;

    const totalDownHours = deviceRows.reduce((sum, d) => sum + parseFloat(d.down_secs || 0), 0) / 3600;
    const avgDownHoursPerDevice = totalDevices > 0
      ? Math.round((totalDownHours / totalDevices) * 10) / 10 : 0;

    const worstDevice = deviceRows.length > 0 ? deviceRows[0] : null;

    // Count devices at each threshold
    const devicesAt100 = deviceRows.filter(d => parseFloat(d.uptime_pct) >= 100).length;
    const devicesBelow9999 = deviceRows.filter(d => parseFloat(d.uptime_pct) < 99.9).length;
    const devicesBelow99 = deviceRows.filter(d => parseFloat(d.uptime_pct) < 99).length;
    const devicesBelow95 = deviceRows.filter(d => parseFloat(d.uptime_pct) < 95).length;
    const devicesBelow90 = deviceRows.filter(d => parseFloat(d.uptime_pct) < 90).length;

    // Target analysis: what fleet score would be if worst N devices were fixed
    const sortedByUptime = [...deviceRows].sort((a, b) => parseFloat(a.uptime_pct) - parseFloat(b.uptime_pct));
    const targetIfWorst5Fixed = computeFleetWithout(deviceRows, sortedByUptime.slice(0, 5));
    const targetIfWorst10Fixed = computeFleetWithout(deviceRows, sortedByUptime.slice(0, 10));
    const targetIfAllAbove95 = computeFleetIfMinimum(deviceRows, 95);

    return NextResponse.json({
      days,
      category,
      fleet_availability: fleetAvailability,
      summary: {
        total_devices: totalDevices,
        total_down_hours: Math.round(totalDownHours * 10) / 10,
        avg_down_hours: avgDownHoursPerDevice,
        devices_at_100: devicesAt100,
        devices_below_99: devicesBelow99,
        devices_below_95: devicesBelow95,
        devices_below_90: devicesBelow90,
        worst_device: worstDevice ? {
          name: worstDevice.device_name,
          uptime_pct: parseFloat(worstDevice.uptime_pct),
          down_hours: Math.round((parseFloat(worstDevice.down_secs || 0) / 3600) * 10) / 10,
        } : null,
      },
      targets: {
        if_worst_5_fixed: targetIfWorst5Fixed,
        if_worst_10_fixed: targetIfWorst10Fixed,
        if_all_above_95: targetIfAllAbove95,
      },
      devices: deviceRows.map(d => ({
        device_id: d.device_id,
        name: d.device_name,
        device_type: d.device_type,
        site_name: d.site_name,
        is_critical: d.is_critical,
        uptime_pct: parseFloat(d.uptime_pct),
        down_hours: Math.round((parseFloat(d.down_secs || 0) / 3600) * 10) / 10,
        degraded_hours: Math.round((parseFloat(d.degraded_secs || 0) / 3600) * 10) / 10,
      })),
      outages: outageRows.map(o => ({
        device_id: o.device_id,
        device_name: o.device_name,
        status: o.status,
        start_time: o.start_time,
        end_time: o.end_time,
      })),
    });
  } catch (err) {
    console.error('[availability] Error:', err);
    return NextResponse.json({ error: 'Failed to compute availability' }, { status: 500 });
  }
});

/**
 * Compute what fleet availability would be if we excluded certain devices.
 */
function computeFleetWithout(allDevices, excludeDevices) {
  const excludeIds = new Set(excludeDevices.map(d => d.device_id));
  const remaining = allDevices.filter(d => !excludeIds.has(d.device_id));
  if (remaining.length === 0) return 100;
  const totalUp = remaining.reduce((s, d) => s + parseFloat(d.up_secs || 0), 0);
  const totalAll = remaining.reduce((s, d) => s + parseFloat(d.total_secs || 0), 0);
  return totalAll > 0 ? Math.round((totalUp / totalAll) * 10000) / 100 : 100;
}

/**
 * Compute what fleet availability would be if every device had at least `minPct`% uptime.
 */
function computeFleetIfMinimum(allDevices, minPct) {
  if (allDevices.length === 0) return 100;
  const adjustedPcts = allDevices.map(d => {
    const pct = parseFloat(d.uptime_pct);
    return pct < minPct ? minPct : pct;
  });
  const avg = adjustedPcts.reduce((s, p) => s + p, 0) / adjustedPcts.length;
  return Math.round(avg * 100) / 100;
}