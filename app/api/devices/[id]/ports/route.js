/**
 * VEMIO™ — Device Ports API
 * GET /api/devices/[id]/ports
 *
 * Returns unified port manifest for a single device:
 *  - Physical ports (from device_ports)
 *  - VLAN IPs (from device_interfaces)
 *  - Connected neighbors (from device_neighbors + device_ports.connected_to_interface_id)
 *
 * Used by the Device Stencil / Port Details view.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const tenantId = session.user.tenantId;
  const { id: deviceId } = await params;

  try {
    // 1. Get the device (need auvik_device_id, make, model, device_type)
    const deviceResult = await queryWithTenant(tenantId,
      `SELECT d.id, d.auvik_device_id, d.name, d.device_type, d.make, d.model,
              d.ip_address, d.current_status
       FROM devices d
       WHERE d.id = $1`,
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    const device = deviceResult.rows[0];
    const auvikId = device.auvik_device_id;

    // 2. Get physical ports from device_ports
    const portsResult = await queryWithTenant(tenantId,
      `SELECT dp.interface_auvik_id, dp.interface_name, dp.interface_type,
              dp.negotiated_speed, dp.operational_status,
              dp.connected_to_interface_id, dp.media_type
       FROM device_ports dp
       WHERE dp.device_auvik_id = $1
       ORDER BY dp.interface_name ASC`,
      [auvikId]
    );

    // 3. Get VLAN IPs from device_interfaces
    const interfacesResult = await queryWithTenant(tenantId,
      `SELECT ip_address, interface_name, vlan_id, is_primary
       FROM device_interfaces
       WHERE device_id = $1
       ORDER BY is_primary DESC, ip_address ASC`,
      [deviceId]
    );

    // 4. Get neighbors from device_neighbors (this device as source or target)
    const neighborsResult = await queryWithTenant(tenantId,
      `SELECT
         dn.device_id AS source_auvik_id,
         dn.neighbor_device_id AS target_auvik_id,
         dn.interface_name AS local_interface,
         dn.neighbor_interface AS remote_interface,
         dn.relationship_type,
         -- Resolve neighbor device details
         CASE
           WHEN dn.device_id = $1 THEN nd.name
           ELSE sd.name
         END AS neighbor_name,
         CASE
           WHEN dn.device_id = $1 THEN nd.device_type
           ELSE sd.device_type
         END AS neighbor_type,
         CASE
           WHEN dn.device_id = $1 THEN nd.make
           ELSE sd.make
         END AS neighbor_make,
         CASE
           WHEN dn.device_id = $1 THEN nd.current_status
           ELSE sd.current_status
         END AS neighbor_status,
         CASE
           WHEN dn.device_id = $1 THEN nd.ip_address
           ELSE sd.ip_address
         END AS neighbor_ip,
         CASE
           WHEN dn.device_id = $1 THEN nd.id
           ELSE sd.id
         END AS neighbor_device_uuid
       FROM device_neighbors dn
       LEFT JOIN devices sd ON sd.auvik_device_id = dn.device_id AND sd.auvik_device_id != $1
       LEFT JOIN devices nd ON nd.auvik_device_id = dn.neighbor_device_id AND dn.device_id = $1
       WHERE dn.device_id = $1 OR dn.neighbor_device_id = $1`,
      [auvikId]
    );

    // 5. Build connected_to map: interface_auvik_id → remote interface info
    // Also build a reverse map from remote interface_id to local port
    const remoteInterfaceToDevice = new Map();
    for (const port of portsResult.rows) {
      if (port.connected_to_interface_id) {
        remoteInterfaceToDevice.set(port.interface_auvik_id, port.connected_to_interface_id);
      }
    }

    // 6. Map VLAN IPs by interface name for correlation
    const vlanByInterface = new Map();
    for (const iface of interfacesResult.rows) {
      const key = (iface.interface_name || '').toLowerCase();
      if (!vlanByInterface.has(key)) vlanByInterface.set(key, []);
      vlanByInterface.get(key).push({
        ipAddress: iface.ip_address,
        vlanId: iface.vlan_id,
        isPrimary: iface.is_primary,
      });
    }

    // 7. Map neighbors by local interface name
    const neighborsByInterface = new Map();
    for (const n of neighborsResult.rows) {
      const isSource = n.source_auvik_id === auvikId;
      const localIface = isSource ? n.local_interface : n.remote_interface;
      const remoteIface = isSource ? n.remote_interface : n.local_interface;

      if (localIface) {
        const key = localIface.toLowerCase();
        if (!neighborsByInterface.has(key)) neighborsByInterface.set(key, []);
        neighborsByInterface.get(key).push({
          name: n.neighbor_name || 'Unknown',
          type: n.neighbor_type,
          make: n.neighbor_make,
          status: n.neighbor_status,
          ipAddress: n.neighbor_ip,
          remoteInterface: remoteIface,
          deviceId: n.neighbor_device_uuid,
        });
      }
    }

    // 8. Build unified port manifest
    const ports = portsResult.rows.map(port => {
      const ifaceLower = (port.interface_name || '').toLowerCase();
      const vlans = vlanByInterface.get(ifaceLower) || [];
      const neighbors = neighborsByInterface.get(ifaceLower) || [];

      return {
        interfaceId: port.interface_auvik_id,
        name: port.interface_name,
        type: port.interface_type,
        speed: port.negotiated_speed,
        status: port.operational_status,
        connectedToInterfaceId: port.connected_to_interface_id,
        mediaType: port.media_type,
        vlans,
        neighbors,
        hasConnection: neighbors.length > 0 || !!port.connected_to_interface_id,
      };
    });

    // 9. Summary stats
    const summary = {
      totalPorts: ports.length,
      up: ports.filter(p => p.status === 'online').length,
      down: ports.filter(p => p.status === 'offline' || p.status === 'disabled').length,
      other: ports.filter(p => !['online', 'offline', 'disabled'].includes(p.status)).length,
      withConnection: ports.filter(p => p.hasConnection).length,
      fiber: ports.filter(p => p.mediaType === 'fiber').length,
      copper: ports.filter(p => p.mediaType === 'copper').length,
      wireless: ports.filter(p => p.mediaType === 'wireless').length,
    };

    return Response.json({
      device: {
        id: device.id,
        auvikDeviceId: device.auvik_device_id,
        name: device.name,
        type: device.device_type,
        make: device.make,
        model: device.model,
        ipAddress: device.ip_address,
        status: device.current_status,
      },
      ports,
      interfaces: interfacesResult.rows.map(r => ({
        ipAddress: r.ip_address,
        interfaceName: r.interface_name,
        vlanId: r.vlan_id,
        isPrimary: r.is_primary,
      })),
      summary,
    });
  } catch (err) {
    console.error('[VEMIO API] Device ports error:', err.message);
    return Response.json({ error: 'Failed to fetch device ports' }, { status: 500 });
  }
});