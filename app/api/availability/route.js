/**
 * VEMIO™ — Availability API
 * GET /api/availability?days=7|30|90&tenantId=...
 *
 * Returns:
 *   - fleet_availability: overall % uptime across all monitored devices
 *   - devices: per-device uptime sorted by worst performers
 *   - outages: per-device outage intervals for Gantt timeline
 *   - summary: total devices, total downtime hours, worst device
 */

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant, queryAggregateForTenant } from '@/lib/tenant';

export async function GET(req) {
  return withAuth(req, async (session) => {
    try {
      const { searchParams } = new URL(req.url);
      const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7', 10), 1), 90);
      const target = await resolveTargetTenant(session, req);

      // ── 1. Per-device availability (uptime %) ──
      // Uses device_status_history to calculate time spent in each status.
      // The query pairs each status change with the next one (via LEAD),
      // then sums durations by status to compute uptime percentage.
      const deviceAvailSQL = `
        WITH history AS (
          SELECT
            dsh.device_id,
            d.name AS device_name,
            d.device_type,
            d.site_name,
            d.is_critical,
            dsh.status,
            dsh.changed_at,
            LEAD(dsh.changed_at) OVER (
              PARTITION BY dsh.device_id ORDER BY dsh.changed_at
            ) AS next_change
          FROM device_status_history dsh
          JOIN devices d ON d.id = dsh.device_id AND d.tenant_id = dsh.tenant_id
          WHERE dsh.tenant_id = $1
            AND dsh.changed_at >= NOW() - INTERVAL '1 day' * $2
            AND d.is_monitored = true
        ),
        durations AS (
          SELECT
            device_id,
            device_name,
            device_type,
            site_name,
            is_critical,
            status,
            EXTRACT(EPOCH FROM (
              COALESCE(next_change, NOW()) - changed_at
            )) AS duration_secs
          FROM history
        ),
        device_stats AS (
          SELECT
            device_id,
            device_name,
            device_type,
            site_name,
            is_critical,
            SUM(duration_secs) AS total_secs,
            SUM(CASE WHEN status = 'up' THEN duration_secs ELSE 0 END) AS up_secs,
            SUM(CASE WHEN status = 'down' THEN duration_secs ELSE 0 END) AS down_secs,
            SUM(CASE WHEN status = 'degraded' THEN duration_secs ELSE 0 END) AS degraded_secs
          FROM durations
          GROUP BY device_id, device_name, device_type, site_name, is_critical
        )
        SELECT
          device_id,
          device_name,
          device_type,
          site_name,
          is_critical,
          total_secs,
          up_secs,
          down_secs,
          degraded_secs,
          CASE WHEN total_secs > 0
            THEN ROUND((up_secs / total_secs) * 100, 2)
            ELSE 100
          END AS uptime_pct
        FROM device_stats
        ORDER BY uptime_pct ASC, down_secs DESC
      `;

      const deviceRows = await queryForTenant(target, deviceAvailSQL, ['{TENANT_ID}', days]);

      // ── 2. Outage intervals for Gantt chart (down + degraded periods) ──
      // Gets the worst 20 devices by downtime and their outage windows
      const outageSQL = `
        WITH history AS (
          SELECT
            dsh.device_id,
            d.name AS device_name,
            dsh.status,
            dsh.changed_at,
            LEAD(dsh.changed_at) OVER (
              PARTITION BY dsh.device_id ORDER BY dsh.changed_at
            ) AS next_change
          FROM device_status_history dsh
          JOIN devices d ON d.id = dsh.device_id AND d.tenant_id = dsh.tenant_id
          WHERE dsh.tenant_id = $1
            AND dsh.changed_at >= NOW() - INTERVAL '1 day' * $2
            AND d.is_monitored = true
            AND dsh.status IN ('down', 'degraded')
        )
        SELECT
          device_id,
          device_name,
          status,
          changed_at AS start_time,
          COALESCE(next_change, NOW()) AS end_time
        FROM history
        ORDER BY changed_at DESC
        LIMIT 500
      `;

      const outageRows = await queryForTenant(target, outageSQL, ['{TENANT_ID}', days]);

      // ── 3. Compute fleet-level stats ──
      const totalDevices = deviceRows.length;
      const totalUpSecs = deviceRows.reduce((sum, d) => sum + parseFloat(d.up_secs || 0), 0);
      const totalSecs = deviceRows.reduce((sum, d) => sum + parseFloat(d.total_secs || 0), 0);
      const fleetAvailability = totalSecs > 0
        ? Math.round((totalUpSecs / totalSecs) * 10000) / 100
        : 100;

      const totalDownHours = deviceRows.reduce(
        (sum, d) => sum + parseFloat(d.down_secs || 0), 0
      ) / 3600;

      const worstDevice = deviceRows.length > 0 ? deviceRows[0] : null;

      // Count devices below 99% uptime
      const devicesBelow99 = deviceRows.filter(d => parseFloat(d.uptime_pct) < 99).length;
      const devicesBelow95 = deviceRows.filter(d => parseFloat(d.uptime_pct) < 95).length;

      return NextResponse.json({
        days,
        fleet_availability: fleetAvailability,
        summary: {
          total_devices: totalDevices,
          total_down_hours: Math.round(totalDownHours * 10) / 10,
          devices_below_99: devicesBelow99,
          devices_below_95: devicesBelow95,
          worst_device: worstDevice ? {
            name: worstDevice.device_name,
            uptime_pct: parseFloat(worstDevice.uptime_pct),
            down_hours: Math.round((parseFloat(worstDevice.down_secs || 0) / 3600) * 10) / 10,
          } : null,
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
}