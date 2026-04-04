/**
 * VEMIO™ | Topology Endpoints Overlay API
 * GET /api/topology/endpoints
 *
 * Returns endpoints grouped by their ACTUAL parent:
 *   - Wired endpoints → grouped by connected switch
 *   - Wireless endpoints → grouped by connected AP
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Get all endpoints
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
         d.id AS switch_device_uuid
       FROM collector_port_clients cpc
       LEFT JOIN collector_devices cd ON cd.id = cpc.device_id
       LEFT JOIN devices d ON d.ip_address = cd.ip_address::inet AND d.tenant_id = cpc.tenant_id
       WHERE cpc.status = 'active'
         AND cpc.last_seen > NOW() - INTERVAL '24 hours'
       ORDER BY cpc.connection_type, cpc.mac_address`
    );

    // Get all AP devices for name matching
    const apResult = await queryForTenant(target,
      `SELECT id, name FROM devices WHERE device_type = 'access_point'`
    );
    
    // Build AP name → UUID lookup (handle "516 AP (access_point)" → "516 AP" matching)
    const apNameToId = {};
    for (const ap of apResult.rows) {
      apNameToId[ap.name] = ap.id;
      apNameToId[ap.name + ' (access_point)'] = ap.id;
    }

    const byDevice = {};
    const endpoints = [];

    for (const row of result.rows) {
      const isWireless = row.connection_type === 'wireless';
      
      // Determine the parent device UUID
      let parentDeviceId = null;
      if (isWireless && row.connected_ap_name) {
        // Wireless → connect to AP
        parentDeviceId = apNameToId[row.connected_ap_name] || null;
        // Fallback: try matching without suffix
        if (!parentDeviceId) {
          const cleanName = row.connected_ap_name.replace(/\s*\(.*\)$/, '');
          parentDeviceId = apNameToId[cleanName] || null;
        }
      }
      
      // Wired or wireless without AP match → connect to switch
      if (!parentDeviceId) {
        parentDeviceId = row.switch_device_uuid || null;
      }

      const ep = {
        mac: row.mac_address,
        ip: row.ip_address || null,
        connectionType: row.connection_type || 'wired',
        manufacturer: row.manufacturer || 'Unknown',
        apName: row.connected_ap_name || null,
        switchName: row.connected_switch_name || null,
        parentDeviceId,
        port: row.port_index,
      };
      endpoints.push(ep);

      if (parentDeviceId) {
        if (!byDevice[parentDeviceId]) {
          byDevice[parentDeviceId] = { wired: 0, wireless: 0, endpoints: [] };
        }
        byDevice[parentDeviceId][isWireless ? 'wireless' : 'wired']++;
        byDevice[parentDeviceId].endpoints.push(ep);
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
