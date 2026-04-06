/**
 * VEMIO™ — Device Detail API (Collector-Native, Enhanced)
 * GET /api/devices/[id]/detail
 *
 * Returns: device info, ports, VLANs, neighbors, endpoints, uptime history
 * Join: devices.ip_address → collector_devices.ip_address via host() cast
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30')));

  try {
    /* ── 1. Device from main devices table ── */
    const deviceResult = await queryWithTenant(tenantId,
      `SELECT d.id, d.name, d.device_type, d.current_status, d.make, d.model,
              d.ip_address, d.mac_address, d.last_seen_at, d.auvik_device_id,
              d.serial_number, d.firmware_version, d.description,
              d.eol_date, d.warranty_expiry, d.uptime_seconds,
              d.is_critical, d.has_redundancy, d.is_retired,
              d.created_at, d.updated_at,
              s.name AS site_name
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       WHERE d.id = $1`,
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    const dev = deviceResult.rows[0];

    /* ── 2. Resolve collector_devices ID via IP match ── */
    /* Use host() on both sides to strip /32 suffix */
    const collectorDevResult = await queryWithTenant(tenantId,
      `SELECT cd.id AS collector_device_id, cd.sys_descr, cd.make_model,
              cd.cpu_percent, cd.memory_percent, cd.snmp_version,
              cd.uptime_seconds AS collector_uptime, cd.collector_site_id
       FROM collector_devices cd
       WHERE host(cd.ip_address) = host($1::inet)
         AND cd.tenant_id = $2
       ORDER BY cd.last_seen DESC
       LIMIT 1`,
      [dev.ip_address, tenantId]
    );

    const collectorDev = collectorDevResult.rows[0] || null;
    const collectorDeviceId = collectorDev?.collector_device_id;
    const collectorSiteId = collectorDev?.collector_site_id;

    /* ── 3. Switch Ports (collector_switch_ports) ── */
    let ports = [];
    if (collectorDeviceId) {
      const portsResult = await queryWithTenant(tenantId,
        `SELECT port_index, port_name, admin_status, oper_status,
                speed_mbps, duplex, in_octets, out_octets,
                in_errors, out_errors, connected_device,
                in_rate_mbps, out_rate_mbps, collected_at
         FROM collector_switch_ports
         WHERE device_id = $1
         ORDER BY port_index ASC`,
        [collectorDeviceId]
      );
      ports = portsResult.rows;
    }

    /* ── 4. VLAN Assignments ── */
    let vlans = [];
    if (collectorDeviceId) {
      const vlansResult = await queryWithTenant(tenantId,
        `SELECT vlan_id, vlan_name, tagged_ports, untagged_ports, collected_at
         FROM collector_vlan_assignments
         WHERE device_id = $1
         ORDER BY vlan_id ASC`,
        [collectorDeviceId]
      );
      vlans = vlansResult.rows;
    }

    /* ── 5. Neighbors (device_neighbors via auvik_device_id) ── */
    const neighborsResult = await queryWithTenant(tenantId,
      `SELECT
         dn.interface_name AS local_interface,
         dn.neighbor_interface AS remote_interface,
         dn.relationship_type,
         CASE WHEN dn.device_id = $1 THEN nd.name ELSE sd.name END AS neighbor_name,
         CASE WHEN dn.device_id = $1 THEN nd.device_type ELSE sd.device_type END AS neighbor_type,
         CASE WHEN dn.device_id = $1 THEN nd.make ELSE sd.make END AS neighbor_make,
         CASE WHEN dn.device_id = $1 THEN nd.model ELSE sd.model END AS neighbor_model,
         CASE WHEN dn.device_id = $1 THEN nd.current_status ELSE sd.current_status END AS neighbor_status,
         CASE WHEN dn.device_id = $1 THEN nd.ip_address ELSE sd.ip_address END AS neighbor_ip,
         CASE WHEN dn.device_id = $1 THEN nd.id ELSE sd.id END AS neighbor_device_id
       FROM device_neighbors dn
       LEFT JOIN devices sd ON sd.auvik_device_id = dn.device_id AND dn.device_id != $1 AND sd.tenant_id = $2
       LEFT JOIN devices nd ON nd.auvik_device_id = dn.neighbor_device_id AND dn.device_id = $1 AND nd.tenant_id = $2
       WHERE (dn.device_id = $1 OR dn.neighbor_device_id = $1)
         AND dn.tenant_id = $2`,
      [dev.auvik_device_id, tenantId]
    );

    /* ── 6. IP Interfaces (device_interfaces — may be empty) ── */
    let interfaces = [];
    try {
      const interfacesResult = await queryWithTenant(tenantId,
        `SELECT ip_address, interface_name, vlan_id, is_primary, source, updated_at
         FROM device_interfaces
         WHERE device_id = $1
         ORDER BY is_primary DESC, ip_address ASC`,
        [deviceId]
      );
      interfaces = interfacesResult.rows;
    } catch (e) {
      // device_interfaces table might not exist — that's fine
    }

    /* ── 7. Connected Endpoints ── */
    let endpoints = [];
    if (['core_switch', 'access_switch', 'access_point', 'firewall'].includes(dev.device_type)) {
      const cleanName = dev.name;
      const endpointsResult = await queryWithTenant(tenantId,
        `SELECT mac_address, ip_address, manufacturer, connection_type,
                port_index, port_name, hostname,
                connected_ap_name, connected_switch_name,
                vlan_id, vlan_name,
                status, first_seen, last_seen
         FROM collector_port_clients
         WHERE (connected_switch_name ILIKE $1 OR connected_ap_name ILIKE $2)
           AND tenant_id = $3
         ORDER BY last_seen DESC
         LIMIT 200`,
        ['%' + cleanName + '%', '%' + cleanName + '%', tenantId]
      );
      endpoints = endpointsResult.rows;
    }

    /* ── 8. Status History ── */
    let history = [];
    try {
      const historyResult = await queryWithTenant(tenantId,
        `SELECT status, changed_at, source
         FROM device_status_history
         WHERE device_id = $1
           AND changed_at > NOW() - make_interval(days => $2)
         ORDER BY changed_at ASC`,
        [deviceId, days]
      );
      history = historyResult.rows;
    } catch (e) {
      // table might not exist
    }

    /* ── 9. Uptime calculation ── */
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();
    let uptimePercent = null;

    if (history.length > 0) {
      let uptimeMs = 0;
      let lastStatus = history[0].status;
      let lastTime = periodStart;
      for (const entry of history) {
        const entryTime = new Date(entry.changed_at);
        if (lastStatus === 'up') uptimeMs += entryTime.getTime() - lastTime.getTime();
        lastStatus = entry.status;
        lastTime = entryTime;
      }
      if (lastStatus === 'up') uptimeMs += now.getTime() - lastTime.getTime();
      const totalMs = now.getTime() - periodStart.getTime();
      uptimePercent = totalMs > 0 ? Math.round((uptimeMs / totalMs * 100) * 100) / 100 : null;
    }

    /* ── 10. Format uptime ── */
    const rawUptime = dev.uptime_seconds || (collectorDev?.collector_uptime);
    let uptimeFormatted = null;
    if (rawUptime && rawUptime > 0) {
      const s = Number(rawUptime);
      const d2 = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      uptimeFormatted = d2 > 0 ? d2 + 'd ' + h + 'h ' + m + 'm' : h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    /* ── 11. Port summary stats ── */
    const portStats = {
      total: ports.length,
      up: ports.filter(p => p.oper_status === 'up').length,
      down: ports.filter(p => p.oper_status === 'down').length,
      disabled: ports.filter(p => p.admin_status === 'down').length,
      errors: ports.reduce((sum, p) => sum + (Number(p.in_errors) || 0) + (Number(p.out_errors) || 0), 0),
    };

    /* ── Response ── */
    return Response.json({
      device: {
        id: dev.id, name: dev.name, type: dev.device_type,
        status: dev.current_status, make: dev.make, model: dev.model,
        ipAddress: dev.ip_address, macAddress: dev.mac_address,
        lastSeenAt: dev.last_seen_at, siteName: dev.site_name,
        serialNumber: dev.serial_number, firmwareVersion: dev.firmware_version,
        description: dev.description || collectorDev?.sys_descr || null,
        sysDescr: collectorDev?.sys_descr || null,
        makeModel: collectorDev?.make_model || null,
        eolDate: dev.eol_date, warrantyExpiry: dev.warranty_expiry,
        uptimeSeconds: rawUptime,
        uptimeFormatted,
        cpuPercent: collectorDev?.cpu_percent || null,
        memoryPercent: collectorDev?.memory_percent || null,
        snmpVersion: collectorDev?.snmp_version || null,
        isCritical: dev.is_critical,
        hasRedundancy: dev.has_redundancy, isRetired: dev.is_retired,
        createdAt: dev.created_at, updatedAt: dev.updated_at,
      },
      ports: ports.map(p => ({
        index: p.port_index, name: p.port_name,
        adminStatus: p.admin_status, operStatus: p.oper_status,
        speedMbps: p.speed_mbps, duplex: p.duplex,
        inOctets: p.in_octets, outOctets: p.out_octets,
        inErrors: p.in_errors, outErrors: p.out_errors,
        connectedDevice: p.connected_device,
        inRateMbps: p.in_rate_mbps, outRateMbps: p.out_rate_mbps,
      })),
      portStats,
      vlans: vlans.map(v => ({
        id: v.vlan_id, name: v.vlan_name,
        taggedPorts: v.tagged_ports, untaggedPorts: v.untagged_ports,
      })),
      neighbors: neighborsResult.rows.filter(r => r.neighbor_name).map(r => ({
        name: r.neighbor_name, type: r.neighbor_type, make: r.neighbor_make,
        model: r.neighbor_model, status: r.neighbor_status,
        ipAddress: r.neighbor_ip, deviceId: r.neighbor_device_id,
        localInterface: r.local_interface, remoteInterface: r.remote_interface,
        method: r.relationship_type,
      })),
      interfaces: interfaces.map(r => ({
        ipAddress: r.ip_address, interfaceName: r.interface_name,
        vlanId: r.vlan_id, isPrimary: r.is_primary, source: r.source,
      })),
      endpoints: endpoints.map(e => ({
        mac: e.mac_address, ip: e.ip_address, manufacturer: e.manufacturer,
        connectionType: e.connection_type, port: e.port_index,
        portName: e.port_name, hostname: e.hostname,
        apName: e.connected_ap_name, switchName: e.connected_switch_name,
        vlanId: e.vlan_id, vlanName: e.vlan_name,
        status: e.status, firstSeen: e.first_seen, lastSeen: e.last_seen,
      })),
      uptime: { percent: uptimePercent, days, totalEvents: history.length },
      history: history.map(h => ({ status: h.status, changedAt: h.changed_at, source: h.source })),
    });
  } catch (err) {
    console.error('[VEMIO API] Device detail error:', err.message, err.stack);
    return Response.json({ error: 'Failed to fetch device detail' }, { status: 500 });
  }
});
