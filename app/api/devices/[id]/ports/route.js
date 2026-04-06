/**
 * VEMIO™ — Device Ports API
 * GET /api/devices/[id]/ports
 *
 * DAY 4 FIX: Support both Auvik-sourced and Collector-sourced data.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant, queryRaw } from '@/lib/db';

async function resolveDeviceTenant(session, deviceId) {
  const isMSP = session.user.isMSP === true;
  const userTenantId = session.user.tenantId;
  if (!isMSP) return { tenantId: userTenantId };

  const managedResult = await queryWithTenant(userTenantId,
    `SELECT managed_tenant_id FROM msp_tenant_access WHERE msp_tenant_id = $1`,
    [userTenantId]
  );
  for (const row of managedResult.rows) {
    const tid = row.managed_tenant_id;
    const check = await queryWithTenant(tid, 'SELECT id FROM devices WHERE id = $1', [deviceId]);
    if (check.rows.length > 0) return { tenantId: tid };
  }
  return { error: 'Device not found', status: 404 };
}

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const resolved = await resolveDeviceTenant(session, deviceId);
  if (resolved.error) return Response.json({ error: resolved.error }, { status: resolved.status });
  const tenantId = resolved.tenantId;

  try {
    const deviceResult = await queryWithTenant(tenantId,
      `SELECT d.id, d.auvik_device_id, d.name, d.device_type, d.make, d.model,
              d.ip_address, d.current_status
       FROM devices d WHERE d.id = $1`,
      [deviceId]
    );
    if (deviceResult.rows.length === 0) return Response.json({ error: 'Device not found' }, { status: 404 });

    const device = deviceResult.rows[0];
    const auvikId = device.auvik_device_id;
    const deviceUUID = device.id;

    // 1. Try Auvik-sourced ports
    const portsResult = await queryWithTenant(tenantId,
      `SELECT dp.interface_auvik_id, dp.interface_name, dp.interface_type,
              dp.negotiated_speed, dp.operational_status,
              dp.connected_to_interface_id, dp.media_type
       FROM device_ports dp WHERE dp.device_auvik_id = $1
       ORDER BY dp.interface_name ASC`,
      [auvikId]
    );

    // 2. Get IP interfaces
    const interfacesResult = await queryWithTenant(tenantId,
      `SELECT ip_address, interface_name, vlan_id, is_primary
       FROM device_interfaces WHERE device_id = $1
       ORDER BY is_primary DESC, ip_address ASC`,
      [deviceUUID]
    );

    // 3. Get neighbors — try both auvik_device_id and UUID
    const neighborsResult = await queryWithTenant(tenantId,
      `SELECT
         dn.device_id AS source_id,
         dn.neighbor_device_id AS target_id,
         dn.interface_name AS local_interface,
         dn.neighbor_interface AS remote_interface,
         dn.relationship_type,
         COALESCE(nd.name, sd_rev.name) AS neighbor_name,
         COALESCE(nd.device_type, sd_rev.device_type) AS neighbor_type,
         COALESCE(nd.make, sd_rev.make) AS neighbor_make,
         COALESCE(nd.current_status, sd_rev.current_status) AS neighbor_status,
         COALESCE(nd.ip_address, sd_rev.ip_address) AS neighbor_ip,
         COALESCE(nd.id, sd_rev.id) AS neighbor_device_uuid
       FROM device_neighbors dn
       LEFT JOIN devices nd ON (
         nd.auvik_device_id = dn.neighbor_device_id
         AND (dn.device_id = $1 OR dn.device_id = $2)
       )
       LEFT JOIN devices sd_rev ON (
         sd_rev.auvik_device_id = dn.device_id
         AND (dn.neighbor_device_id = $1 OR dn.neighbor_device_id = $2)
       )
       WHERE dn.device_id = $1 OR dn.neighbor_device_id = $1
          OR dn.device_id = $2 OR dn.neighbor_device_id = $2`,
      [auvikId, deviceUUID]
    );

    let ports = [];

    if (portsResult.rows.length > 0) {
      // Auvik-sourced ports
      const vlanByInterface = new Map();
      for (const iface of interfacesResult.rows) {
        const key = (iface.interface_name || '').toLowerCase();
        if (!vlanByInterface.has(key)) vlanByInterface.set(key, []);
        vlanByInterface.get(key).push({
          ipAddress: iface.ip_address, vlanId: iface.vlan_id, isPrimary: iface.is_primary,
        });
      }

      const neighborsByInterface = new Map();
      for (const n of neighborsResult.rows) {
        const isSource = n.source_id === auvikId || n.source_id === deviceUUID;
        const localIface = isSource ? n.local_interface : n.remote_interface;
        const remoteIface = isSource ? n.remote_interface : n.local_interface;
        if (localIface) {
          const key = localIface.toLowerCase();
          if (!neighborsByInterface.has(key)) neighborsByInterface.set(key, []);
          neighborsByInterface.get(key).push({
            name: n.neighbor_name || 'Unknown', type: n.neighbor_type,
            make: n.neighbor_make, status: n.neighbor_status,
            ipAddress: n.neighbor_ip, remoteInterface: remoteIface,
            deviceId: n.neighbor_device_uuid,
          });
        }
      }

      ports = portsResult.rows.map(port => {
        const ifaceLower = (port.interface_name || '').toLowerCase();
        const vlans = vlanByInterface.get(ifaceLower) || [];
        const neighbors = neighborsByInterface.get(ifaceLower) || [];
        return {
          interfaceId: port.interface_auvik_id,
          name: port.interface_name, type: port.interface_type || 'ethernet',
          speed: port.negotiated_speed, status: port.operational_status || 'unknown',
          connectedToInterfaceId: port.connected_to_interface_id,
          mediaType: port.media_type || 'unknown', vlans, neighbors,
          hasConnection: neighbors.length > 0 || !!port.connected_to_interface_id,
        };
      });
    } else {
      // Collector-sourced: build synthetic ports from neighbor links
      const seenPorts = new Map();
      let portIdx = 0;

      for (const n of neighborsResult.rows) {
        const isSource = n.source_id === auvikId || n.source_id === deviceUUID;
        const localIface = isSource
          ? (n.local_interface || 'port' + (++portIdx))
          : (n.remote_interface || 'port' + (++portIdx));
        const remoteIface = isSource ? n.remote_interface : n.local_interface;
        const portKey = localIface.toLowerCase();

        if (!seenPorts.has(portKey)) {
          seenPorts.set(portKey, {
            interfaceId: 'collector-' + portKey,
            name: localIface, type: 'ethernet', speed: null,
            status: 'online', connectedToInterfaceId: null,
            mediaType: n.relationship_type === 'wireless' ? 'wireless' : 'copper',
            vlans: [], neighbors: [], hasConnection: true,
          });
        }

        seenPorts.get(portKey).neighbors.push({
          name: n.neighbor_name || 'Unknown', type: n.neighbor_type,
          make: n.neighbor_make, status: n.neighbor_status,
          ipAddress: n.neighbor_ip, remoteInterface: remoteIface,
          deviceId: n.neighbor_device_uuid,
        });
      }

      // Add management interface
      for (const iface of interfacesResult.rows) {
        const ifName = iface.interface_name || 'mgmt0';
        const key = ifName.toLowerCase();
        if (!seenPorts.has(key)) {
          seenPorts.set(key, {
            interfaceId: 'collector-' + key,
            name: ifName, type: 'ethernet', speed: null,
            status: 'online', connectedToInterfaceId: null,
            mediaType: 'copper',
            vlans: [{ ipAddress: iface.ip_address, vlanId: iface.vlan_id, isPrimary: iface.is_primary }],
            neighbors: [], hasConnection: false,
          });
        } else {
          seenPorts.get(key).vlans.push({
            ipAddress: iface.ip_address, vlanId: iface.vlan_id, isPrimary: iface.is_primary,
          });
        }
      }

      ports = Array.from(seenPorts.values());
    }

    const summary = {
      totalPorts: ports.length,
      up: ports.filter(p => p.status === 'online').length,
      down: ports.filter(p => p.status === 'offline' || p.status === 'disabled').length,
      other: ports.filter(p => !['online', 'offline', 'disabled'].includes(p.status || '')).length,
      withConnection: ports.filter(p => p.hasConnection).length,
      fiber: ports.filter(p => p.mediaType === 'fiber').length,
      copper: ports.filter(p => p.mediaType === 'copper').length,
      wireless: ports.filter(p => p.mediaType === 'wireless').length,
    };

    return Response.json({
      device: {
        id: device.id, auvikDeviceId: device.auvik_device_id,
        name: device.name, type: device.device_type,
        make: device.make, model: device.model,
        ipAddress: device.ip_address, status: device.current_status,
      },
      ports,
      interfaces: interfacesResult.rows.map(r => ({
        ipAddress: r.ip_address, interfaceName: r.interface_name,
        vlanId: r.vlan_id, isPrimary: r.is_primary,
      })),
      summary,
    });
  } catch (err) {
    console.error('[VEMIO API] Device ports error:', err.message);
    return Response.json({ error: 'Failed to fetch device ports' }, { status: 500 });
  }
});
