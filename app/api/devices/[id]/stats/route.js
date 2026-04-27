/**
 * VEMIO™ — Interface Bandwidth Statistics API
 * app/api/devices/[id]/interfaces/stats/route.js
 *
 * GET /api/devices/:id/interfaces/stats?period=24h|7d&interfaces=wan|all
 *
 * Returns bandwidth time-series for a device's interfaces.
 * Default: WAN-flagged interfaces only. Use ?interfaces=all for everything.
 *
 * Uses MSP-aware resolveTargetTenant/queryForTenant pattern.
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

const PERIOD_MAP = {
  '24h': '24 hours',
  '7d':  '7 days',
};

export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const deviceId = segments[segments.indexOf('devices') + 1];

  if (!deviceId) {
    return Response.json({ error: 'Device ID required' }, { status: 400 });
  }

  const period = url.searchParams.get('period') || '24h';
  const interfaceFilter = url.searchParams.get('interfaces') || 'wan'; // 'wan' or 'all'

  const interval = PERIOD_MAP[period];
  if (!interval) {
    return Response.json({ error: 'Invalid period. Use: 24h, 7d' }, { status: 400 });
  }

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Verify device belongs to tenant
    const deviceCheck = await queryForTenant(target,
      'SELECT id, name FROM devices WHERE id = $1',
      [deviceId]
    );
    if (!deviceCheck.rows.length) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    // Build WAN filter clause
    let wanFilter = '';
    if (interfaceFilter === 'wan') {
      wanFilter = `
        AND ist.interface_vemio_id IN (
          SELECT dp.interface_vemio_id FROM device_ports dp
          WHERE dp.device_id = $1 AND dp.is_wan = true
        )
      `;
    }

    // Fetch time-series
    const statsResult = await queryForTenant(target,
      `SELECT
         ist.interface_vemio_id,
         ist.interface_name,
         ist.tx_bps,
         ist.rx_bps,
         ist.total_bandwidth_bps,
         ist.utilization_pct,
         ist.recorded_at
       FROM interface_statistics ist
       WHERE ist.device_id = $1
         AND ist.recorded_at >= NOW() - INTERVAL '${interval}'
         ${wanFilter}
       ORDER BY ist.interface_vemio_id, ist.recorded_at ASC`,
      [deviceId]
    );

    // Group by interface
    const interfaces = {};
    for (const row of statsResult.rows) {
      const key = row.interface_vemio_id;
      if (!interfaces[key]) {
        interfaces[key] = {
          interfaceVemioId: row.interface_vemio_id,
          interfaceName: row.interface_name,
          data: [],
        };
      }
      interfaces[key].data.push({
        txBps: parseInt(row.tx_bps),
        rxBps: parseInt(row.rx_bps),
        totalBandwidthBps: parseInt(row.total_bandwidth_bps),
        utilizationPct: row.utilization_pct ? parseFloat(row.utilization_pct) : null,
        recordedAt: row.recorded_at,
      });
    }

    // Get current values (latest per interface)
    const currentResult = await queryForTenant(target,
      `SELECT DISTINCT ON (interface_vemio_id)
         interface_vemio_id,
         interface_name,
         tx_bps,
         rx_bps,
         utilization_pct,
         recorded_at
       FROM interface_statistics
       WHERE device_id = $1
         AND recorded_at >= NOW() - INTERVAL '10 minutes'
         ${wanFilter}
       ORDER BY interface_vemio_id, recorded_at DESC`,
      [deviceId]
    );

    const current = currentResult.rows.map(row => ({
      interfaceVemioId: row.interface_vemio_id,
      interfaceName: row.interface_name,
      txBps: parseInt(row.tx_bps),
      rxBps: parseInt(row.rx_bps),
      utilizationPct: row.utilization_pct ? parseFloat(row.utilization_pct) : null,
      at: row.recorded_at,
    }));

    // Get WAN port metadata
    const wanPorts = await queryForTenant(target,
      `SELECT dp.interface_vemio_id, dp.interface_name, dp.negotiated_speed, dp.is_wan
       FROM device_ports dp
       WHERE dp.device_id = $1 AND dp.is_wan = true`,
      [deviceId]
    );

    return Response.json({
      interfaces: Object.values(interfaces),
      current,
      wanPorts: wanPorts.rows.map(p => ({
        interfaceVemioId: p.interface_vemio_id,
        interfaceName: p.interface_name,
        negotiatedSpeed: parseInt(p.negotiated_speed),
      })),
      period,
      deviceId,
    });
  } catch (err) {
    console.error('[VEMIO API] Interface stats error:', err.message);
    return Response.json({ error: 'Failed to fetch interface statistics' }, { status: 500 });
  }
});