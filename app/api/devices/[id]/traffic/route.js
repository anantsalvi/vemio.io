/**
 * VEMIO™ — Device Traffic Analysis API
 * GET /api/devices/[id]/traffic
 *
 * Returns per-port bandwidth data for a device from collector_port_traffic.
 *
 * Query params:
 *   - hours: time range (1, 4, 24, 168) — default 4
 *   - interface: filter by port_index (optional, as string)
 *
 * Day 21: Rewritten for VEMIO collector schema.
 *   - Source table: collector_port_traffic (populated every 180s by poll-traffic.js)
 *   - in_bps  → rx   (from the switch's POV, bytes coming IN to the port)
 *   - out_bps → tx   (bytes going OUT from the port)
 *   - Device must have rows in collector_port_traffic OR exist in collector_devices
 *     (switches/core_switches are currently the only traffic-collecting devices).
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session, { params }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const hours = Math.min(168, Math.max(1, parseInt(url.searchParams.get('hours') || '4', 10)));
  const ifaceFilter = url.searchParams.get('interface') || null;

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // 1. Look up device. We join through collector_devices by IP because
    //    collector_port_traffic.device_id references collector_devices.id,
    //    not devices.id.
    const deviceResult = await queryForTenant(target,
      `SELECT d.id, d.name, d.device_type, d.tenant_id,
              d.ip_address::text AS ip_address,
              d.make, d.model,
              cd.id AS collector_device_id
       FROM devices d
       LEFT JOIN collector_devices cd
         ON cd.tenant_id = d.tenant_id
        AND cd.ip_address = d.ip_address::text
       WHERE d.id = $1`,
      [id]
    );

    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    const device = deviceResult.rows[0];
    const collectorDeviceId = device.collector_device_id;

    // No collector-side mapping = no traffic data possible (e.g. firewalls,
    // APs, endpoints). Return empty shape rather than 400.
    if (!collectorDeviceId) {
      return Response.json({
        device: {
          id: device.id,
          name: device.name,
          type: device.device_type,
          ipAddress: device.ip_address,
          make: device.make,
          model: device.model,
        },
        hours,
        bucketInterval: hours <= 4 ? '5m' : hours <= 24 ? '15m' : '1h',
        interfaces: [],
        timeSeries: [],
        latest: [],
      });
    }

    // 2. Top ports by average throughput.
    //    Alias: in_bps (to switch) = rx ; out_bps (from switch) = tx
    const summaryResult = await queryForTenant(target,
      `SELECT
         port_index::text            AS interface_id,
         ('Port ' || port_index)     AS interface_name,
         ROUND(AVG(out_bps))         AS avg_tx_bps,
         ROUND(AVG(in_bps))          AS avg_rx_bps,
         ROUND(AVG(in_bps + out_bps))AS avg_total_bps,
         MAX(in_bps + out_bps)       AS peak_total_bps,
         NULL::numeric               AS avg_utilization,
         COUNT(*)                    AS sample_count
       FROM collector_port_traffic
       WHERE device_id = $1
         AND measured_at > NOW() - INTERVAL '1 hour' * $2
       GROUP BY port_index
       HAVING AVG(in_bps + out_bps) > 0
       ORDER BY avg_total_bps DESC
       LIMIT 20`,
      [collectorDeviceId, hours]
    );

    // 3. Time-series: bucket into 5m / 15m / 1h windows.
    //    Use date_bin (PG 14+) for clean interval bucketing.
    let bucketInterval, bucketLabel;
    if (hours <= 4) {
      bucketInterval = '5 minutes';
      bucketLabel = '5m';
    } else if (hours <= 24) {
      bucketInterval = '15 minutes';
      bucketLabel = '15m';
    } else {
      bucketInterval = '1 hour';
      bucketLabel = '1h';
    }

    const tsParams = [collectorDeviceId, hours];
    let ifaceWhere = '';
    if (ifaceFilter !== null) {
      tsParams.push(parseInt(ifaceFilter, 10));
      ifaceWhere = `AND port_index = $${tsParams.length}`;
    }

    const timeSeriesResult = await queryForTenant(target,
      `SELECT
         port_index::text            AS interface_id,
         ('Port ' || port_index)     AS interface_name,
         date_bin('${bucketInterval}', measured_at, TIMESTAMP '2020-01-01') AS bucket,
         ROUND(AVG(out_bps))         AS tx_bps,
         ROUND(AVG(in_bps))          AS rx_bps,
         ROUND(AVG(in_bps + out_bps))AS total_bps
       FROM collector_port_traffic
       WHERE device_id = $1
         AND measured_at > NOW() - INTERVAL '1 hour' * $2
         ${ifaceWhere}
       GROUP BY port_index, bucket
       ORDER BY bucket ASC, port_index`,
      tsParams
    );

    // 4. Latest sample per port (last 15 min).
    const latestResult = await queryForTenant(target,
      `SELECT DISTINCT ON (port_index)
         port_index::text            AS interface_id,
         ('Port ' || port_index)     AS interface_name,
         out_bps                     AS tx_bps,
         in_bps                      AS rx_bps,
         (in_bps + out_bps)          AS total_bps,
         NULL::numeric               AS utilization_pct,
         measured_at                 AS recorded_at
       FROM collector_port_traffic
       WHERE device_id = $1
         AND measured_at > NOW() - INTERVAL '15 minutes'
       ORDER BY port_index, measured_at DESC`,
      [collectorDeviceId]
    );

    // Format response — shape matches reference page.jsx expectations
    const interfaces = summaryResult.rows.map(row => ({
      id: row.interface_id,
      name: row.interface_name,
      avgTxBps: parseInt(row.avg_tx_bps) || 0,
      avgRxBps: parseInt(row.avg_rx_bps) || 0,
      avgTotalBps: parseInt(row.avg_total_bps) || 0,
      peakTotalBps: parseInt(row.peak_total_bps) || 0,
      avgUtilization: row.avg_utilization != null ? parseFloat(row.avg_utilization) : null,
      samples: parseInt(row.sample_count),
    }));

    const timeSeriesMap = {};
    for (const row of timeSeriesResult.rows) {
      const key = row.interface_id;
      if (!timeSeriesMap[key]) {
        timeSeriesMap[key] = { id: key, name: row.interface_name, data: [] };
      }
      timeSeriesMap[key].data.push({
        time: row.bucket,
        txBps: parseInt(row.tx_bps) || 0,
        rxBps: parseInt(row.rx_bps) || 0,
        totalBps: parseInt(row.total_bps) || 0,
      });
    }

    const latest = latestResult.rows.map(row => ({
      id: row.interface_id,
      name: row.interface_name,
      txBps: parseInt(row.tx_bps) || 0,
      rxBps: parseInt(row.rx_bps) || 0,
      totalBps: parseInt(row.total_bps) || 0,
      utilization: row.utilization_pct != null ? parseFloat(row.utilization_pct) : null,
      recordedAt: row.recorded_at,
    }));

    return Response.json({
      device: {
        id: device.id,
        name: device.name,
        type: device.device_type,
        ipAddress: device.ip_address,
        make: device.make,
        model: device.model,
      },
      hours,
      bucketInterval: bucketLabel,
      interfaces,
      timeSeries: Object.values(timeSeriesMap),
      latest,
    });
  } catch (err) {
    console.error('[VEMIO API] Traffic analysis error:', err.message);
    return Response.json({ error: 'Failed to fetch traffic data', detail: err.message }, { status: 500 });
  }
});
