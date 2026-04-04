/**
 * VEMIO™ | Topology Endpoints Overlay API
 * GET /api/topology/endpoints
 *
 * Returns endpoints grouped by their connected switch/AP for
 * overlay on the topology visualization.
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    const result = await queryForTenant(target,
      `SELECT
         cpc.mac_address,
         cpc.ip_address,
         cpc.connection_type,
         cpc.manufacturer,
         cpc.connected_ap_name,
         cpc.connected_switch_name,
         cpc.port_index,
         cd.ip_address AS switch_ip,
         d.id AS device_uuid
       FROM collector_port_clients cpc
       LEFT JOIN collector_devices cd ON cd.id = cpc.device_id
       LEFT JOIN devices d ON d.ip_address = cd.ip_address::inet AND d.tenant_id = cpc.tenant_id
       WHERE cpc.status = 'active'
         AND cpc.last_seen > NOW() - INTERVAL '24 hours'
       ORDER BY cpc.connection_type, cpc.mac_address`
    );

    // Group by connected device (switch UUID for topology node matching)
    const byDevice = {};
    const endpoints = [];

    for (const row of result.rows) {
      const ep = {
        mac: row.mac_address,
        ip: row.ip_address || null,
        connectionType: row.connection_type || 'wired',
        manufacturer: row.manufacturer || 'Unknown',
        apName: row.connected_ap_name || null,
        switchName: row.connected_switch_name || null,
        parentDeviceId: row.device_uuid || null,
        port: row.port_index,
      };
      endpoints.push(ep);

      if (ep.parentDeviceId) {
        if (!byDevice[ep.parentDeviceId]) {
          byDevice[ep.parentDeviceId] = { wired: 0, wireless: 0, endpoints: [] };
        }
        byDevice[ep.parentDeviceId][ep.connectionType === 'wireless' ? 'wireless' : 'wired']++;
        byDevice[ep.parentDeviceId].endpoints.push(ep);
      }
    }

    return Response.json({
      endpoints,
      byDevice,
      summary: {
        total: endpoints.length,
        wired: endpoints.filter(e => e.connectionType === 'wired').length,
        wireless: endpoints.filter(e => e.connectionType === 'wireless').length,
      },
    });
  } catch (err) {
    console.error('[VEMIO API] Topology endpoints error:', err.message);
    return Response.json({ error: 'Failed to fetch topology endpoints' }, { status: 500 });
  }
});
