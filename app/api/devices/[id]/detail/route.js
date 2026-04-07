/**
 * VEMIO™ — Device Detail API (Collector-Native, v4)
 * GET /api/devices/[id]/detail
 *
 * v4 changes:
 * - Each port now carries portIp (from device_interfaces JOIN on interface_name)
 * - Each port now carries connectedDevice (from device_neighbors LLDP JOIN on local_interface)
 * - Smart endpoint primary detection
 * - Neighbor matching normalizes "Port 24" vs "24" naming differences
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30')));

  try {
    /* ── 1. Device ── */
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
    const isFirewallOrRouter = ['firewall', 'router'].includes(dev.device_type);
    const isSwitch = ['core_switch', 'access_switch'].includes(dev.device_type);
    const isAP = dev.device_type === 'access_point';

    /* ── 2. Resolve collector_devices ── */
    const collectorDevResult = await queryWithTenant(tenantId,
      `WITH ranked AS (
         SELECT cd.id AS collector_device_id, cd.sys_descr, cd.make_model,
                cd.cpu_percent, cd.memory_percent, cd.snmp_version,
                cd.uptime_seconds AS collector_uptime, cd.collector_site_id,
                cd.first_seen AS collector_first_seen, cd.last_seen AS collector_last_seen,
                cd.sys_name,
                cd.ip_address AS cd_ip,
                (SELECT COUNT(*) FROM collector_switch_ports csp WHERE csp.device_id = cd.id) AS port_count,
                CASE WHEN host(cd.ip_address) = host($1::inet) THEN 1 ELSE 0 END AS ip_match,
                CASE WHEN cd.sys_name = $3 THEN 1 ELSE 0 END AS name_match
         FROM collector_devices cd
         WHERE cd.tenant_id = $2
           AND (
             host(cd.ip_address) = host($1::inet)
             OR cd.sys_name = $3
           )
       )
       SELECT * FROM ranked
       ORDER BY
         (port_count > 0)::int DESC,
         ip_match DESC,
         name_match DESC,
         port_count DESC,
         collector_last_seen DESC
       LIMIT 1`,
      [dev.ip_address, tenantId, dev.name]
    );

    const collectorDev = collectorDevResult.rows[0] || null;
    const collectorDeviceId = collectorDev?.collector_device_id;

    /* ── 3. Ports ── */
    let ports = [];
    let portEndpointMap = new Map();

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

      const portClientsResult = await queryWithTenant(tenantId,
        `SELECT port_index, mac_address, ip_address, manufacturer, hostname,
                connection_type, vlan_id, last_seen
         FROM collector_port_clients
         WHERE device_id = $1 AND port_index IS NOT NULL
         ORDER BY last_seen DESC`,
        [collectorDeviceId]
      );

      for (const ep of portClientsResult.rows) {
        const idx = ep.port_index;
        if (!portEndpointMap.has(idx)) portEndpointMap.set(idx, []);
        portEndpointMap.get(idx).push(ep);
      }

      ports = portsResult.rows.map(p => {
        const attached = portEndpointMap.get(p.port_index) || [];
        return {
          ...p,
          category: categorizePort(p.port_name, dev.device_type, p.port_index),
          attachedEndpoints: attached.map(e => ({
            mac: e.mac_address, ip: e.ip_address,
            manufacturer: e.manufacturer, hostname: e.hostname,
            connectionType: e.connection_type, vlanId: e.vlan_id,
            lastSeen: e.last_seen,
          })),
          attachedCount: attached.length,
          primaryEndpointIp: attached.find(e => e.ip_address)?.ip_address || null,
          primaryEndpointMac: attached[0]?.mac_address || null,
        };
      });
    }

    /* ── 4. VLANs ── */
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

    /* ── 5. Neighbors ── */
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

    const neighbors = neighborsResult.rows.filter(r => r.neighbor_name);

    /* ── 6. IP Interfaces ── */
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
    } catch (e) {}

    /* ── 7. Endpoints (directly connected with IP) ── */
    let endpoints = [];
    let endpointMode = 'none';

    if (collectorDeviceId) {
      const r = await queryWithTenant(tenantId,
        `SELECT mac_address, ip_address, manufacturer, connection_type,
                port_index, port_name, hostname,
                connected_ap_name, connected_switch_name,
                vlan_id, vlan_name, status, first_seen, last_seen
         FROM collector_port_clients
         WHERE device_id = $1
           AND ip_address IS NOT NULL
           AND tenant_id = $2
         ORDER BY ip_address ASC
         LIMIT 500`,
        [collectorDeviceId, tenantId]
      );
      endpoints = r.rows;
      endpointMode = isAP ? 'ap_clients' : isSwitch ? 'switch_clients' : 'direct';
    }

    /* ── 8. Status history ── */
    let history = [];
    try {
      const r = await queryWithTenant(tenantId,
        `SELECT status, changed_at, source FROM device_status_history
         WHERE device_id = $1 AND changed_at > NOW() - make_interval(days => $2)
         ORDER BY changed_at ASC`,
        [deviceId, days]
      );
      history = r.rows;
    } catch (e) {}

    /* ── 9. Uptime calc ── */
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();
    let uptimePercent = null;
    if (history.length > 0) {
      let uptimeMs = 0;
      let lastStatus = history[0].status;
      let lastTime = periodStart;
      for (const e of history) {
        const t = new Date(e.changed_at);
        if (lastStatus === 'up') uptimeMs += t.getTime() - lastTime.getTime();
        lastStatus = e.status;
        lastTime = t;
      }
      if (lastStatus === 'up') uptimeMs += now.getTime() - lastTime.getTime();
      const totalMs = now.getTime() - periodStart.getTime();
      uptimePercent = totalMs > 0 ? Math.round((uptimeMs / totalMs * 100) * 100) / 100 : null;
    }

    const rawUptime = dev.uptime_seconds || (collectorDev?.collector_uptime);
    let uptimeFormatted = null;
    if (rawUptime && rawUptime > 0) {
      const s = Number(rawUptime);
      const d2 = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      uptimeFormatted = d2 > 0 ? d2 + 'd ' + h + 'h ' + m + 'm' : h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    /* ── 10. ENRICH PORTS with Port IP (from device_interfaces) and Connected To (from neighbors) ── */
    // Build interface lookup: interface_name → ip_address
    const ifaceByName = new Map();
    for (const i of interfaces) {
      const key = (i.interface_name || '').toLowerCase().trim();
      if (key && !ifaceByName.has(key)) {
        ifaceByName.set(key, { ip: i.ip_address, isPrimary: i.is_primary });
      }
    }

    // Build neighbor lookup: normalized local_interface → neighbor info
    // LLDP returns "Port 24" with space, but switch port_name might be "24"
    function normalizeIfName(s) {
      if (!s) return '';
      return String(s).toLowerCase().replace(/^port\s*/i, '').replace(/\s+/g, '').trim();
    }

    const neighborByPort = new Map();
    for (const n of neighbors) {
      const key = normalizeIfName(n.local_interface);
      if (key) neighborByPort.set(key, n);
    }

    ports = ports.map(p => {
      const ifaceKey = (p.port_name || '').toLowerCase().trim();
      const iface = ifaceByName.get(ifaceKey);
      const nKey = normalizeIfName(p.port_name);
      const nbr = neighborByPort.get(nKey);

      return {
        ...p,
        portIp: iface?.ip || null,
        portIsPrimary: iface?.isPrimary || false,
        connectedNeighborName: nbr?.neighbor_name || null,
        connectedNeighborPort: nbr?.remote_interface || null,
        connectedNeighborId: nbr?.neighbor_device_id || null,
        connectedNeighborType: nbr?.neighbor_type || null,
        connectedNeighborMethod: nbr?.relationship_type || null,
      };
    });

    /* ── 11. Stats ── */
    const physicalPorts = ports.filter(p => p.category === 'physical' || p.category === 'physical_sfp');
    const portStats = {
      total: ports.length,
      up: ports.filter(p => p.oper_status === 'up').length,
      down: ports.filter(p => p.oper_status === 'down' && p.admin_status !== 'down').length,
      adminDown: ports.filter(p => p.admin_status === 'down').length,
      errors: ports.reduce((s, p) => s + (Number(p.in_errors) || 0) + (Number(p.out_errors) || 0), 0),
      hasTrafficData: ports.some(p => Number(p.in_octets) > 0 || Number(p.out_octets) > 0),
      hasPortIps: ports.some(p => p.portIp),
      hasNeighbors: ports.some(p => p.connectedNeighborName),
      physicalCount: physicalPorts.length,
      physicalUp: physicalPorts.filter(p => p.oper_status === 'up').length,
    };

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
        uptimeSeconds: rawUptime, uptimeFormatted,
        cpuPercent: collectorDev?.cpu_percent || null,
        memoryPercent: collectorDev?.memory_percent || null,
        snmpVersion: collectorDev?.snmp_version || null,
        isCritical: dev.is_critical, hasRedundancy: dev.has_redundancy, isRetired: dev.is_retired,
        createdAt: dev.created_at, updatedAt: dev.updated_at,
        firstDiscovered: collectorDev?.collector_first_seen || dev.created_at,
      },
      ports: ports.map(p => ({
        index: p.port_index, name: p.port_name, category: p.category,
        adminStatus: p.admin_status, operStatus: p.oper_status,
        speedMbps: (p.speed_mbps && p.speed_mbps > 10000) ? Math.round(p.speed_mbps / 1000000) : p.speed_mbps, duplex: p.duplex,
        inOctets: p.in_octets, outOctets: p.out_octets,
        inErrors: p.in_errors, outErrors: p.out_errors,
        inRateMbps: p.in_rate_mbps, outRateMbps: p.out_rate_mbps,
        // NEW v4 fields
        portIp: p.portIp,
        portIsPrimary: p.portIsPrimary,
        connectedNeighborName: p.connectedNeighborName,
        connectedNeighborPort: p.connectedNeighborPort,
        connectedNeighborId: p.connectedNeighborId,
        connectedNeighborType: p.connectedNeighborType,
        connectedNeighborMethod: p.connectedNeighborMethod,
        // Endpoint correlation (existing)
        attachedEndpoints: p.attachedEndpoints,
        attachedCount: p.attachedCount,
        primaryEndpointIp: p.primaryEndpointIp,
        primaryEndpointMac: p.primaryEndpointMac,
      })),
      portStats,
      vlans: vlans.map(v => ({
        id: v.vlan_id, name: v.vlan_name,
        taggedPorts: v.tagged_ports, untaggedPorts: v.untagged_ports,
      })),
      neighbors: neighbors.map(r => ({
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
      endpointMode,
      uptime: { percent: uptimePercent, days, totalEvents: history.length },
      history: history.map(h => ({ status: h.status, changedAt: h.changed_at, source: h.source })),
    });
  } catch (err) {
    console.error('[VEMIO API] Device detail error:', err.message, err.stack);
    return Response.json({ error: 'Failed to fetch device detail' }, { status: 500 });
  }
});

function categorizePort(name, deviceType, portIndex) {
  // DATAFIX-APR07: high port indices are virtual interfaces (VLANs/loopbacks/SVIs)
  if (portIndex != null && portIndex >= 500) return 'virtual';
  if (!name) return 'other';
  const n = name.toLowerCase();
  if (n.startsWith('switch loopback')) return 'loopback';
  if (n.startsWith('default_vlan') || /^vlan\d/i.test(n)) return 'vlan_iface';
  if (n === 'lo' || n.startsWith('loop')) return 'loopback';
  if (/^(gre|gretap|ipsec|sit|ip6tnl|tun|erspan|vxlan|vti|pport_l|port\d+_ppp)/i.test(n)) return 'tunnel';
  if (/^(dummy|ifb|mv-|mvmgmt|spq|null|teql)/i.test(n)) return 'virtual';
  if (/^(wlan|ath|guestap|ssid)/i.test(n)) return 'wireless';
  if (/^portf\d+$/i.test(n)) return 'physical_sfp';
  if (/^port\d+$/i.test(n)) return 'physical';
  if (/^(eth|gi|te|fa|xe|ge)\d/i.test(n)) return 'physical';
  if (/^trk\d+$/i.test(n)) return 'trunk';
  if (/^\d+$/.test(n)) return 'physical';
  return 'other';
}
