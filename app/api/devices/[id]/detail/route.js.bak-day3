/**
 * VEMIO™ — Device Detail API (Collector-Native)
 * GET /api/devices/[id]/detail
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30')));

  try {
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

    const neighborsResult = await queryWithTenant(tenantId,
      `SELECT
         dn.interface_name AS local_interface,
         dn.neighbor_interface AS remote_interface,
         dn.relationship_type,
         d2.name AS neighbor_name,
         d2.device_type AS neighbor_type,
         d2.make AS neighbor_make,
         d2.model AS neighbor_model,
         d2.current_status AS neighbor_status,
         d2.ip_address AS neighbor_ip,
         d2.id AS neighbor_device_id
       FROM device_neighbors dn
       JOIN devices d2 ON d2.auvik_device_id = CASE
         WHEN dn.device_id = $1 THEN dn.neighbor_device_id
         ELSE dn.device_id
       END AND d2.tenant_id = $2
       WHERE (dn.device_id = $1 OR dn.neighbor_device_id = $1)
         AND dn.tenant_id = $2`,
      [dev.auvik_device_id, tenantId]
    );

    const interfacesResult = await queryWithTenant(tenantId,
      `SELECT ip_address, interface_name, vlan_id, is_primary, source, updated_at
       FROM device_interfaces
       WHERE device_id = $1
       ORDER BY is_primary DESC, ip_address ASC`,
      [deviceId]
    );

    const historyResult = await queryWithTenant(tenantId,
      `SELECT status, changed_at, source
       FROM device_status_history
       WHERE device_id = $1
         AND changed_at > NOW() - make_interval(days => $2)
       ORDER BY changed_at ASC`,
      [deviceId, days]
    );

    let endpoints = [];
    if (['core_switch', 'access_switch', 'access_point'].includes(dev.device_type)) {
      const cleanName = dev.name;
      const endpointsResult = await queryWithTenant(tenantId,
        `SELECT mac_address, ip_address, manufacturer, connection_type,
                port_index, connected_ap_name, connected_switch_name,
                status, last_seen
         FROM collector_port_clients
         WHERE (connected_switch_name ILIKE $1 OR connected_ap_name ILIKE $2)
           AND tenant_id = $3
         ORDER BY last_seen DESC
         LIMIT 100`,
        ['%' + cleanName + '%', '%' + cleanName + '%', tenantId]
      );
      endpoints = endpointsResult.rows;
    }

    const history = historyResult.rows;
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

    let uptimeFormatted = null;
    if (dev.uptime_seconds && dev.uptime_seconds > 0) {
      const s = Number(dev.uptime_seconds);
      const d2 = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      uptimeFormatted = d2 > 0 ? d2 + 'd ' + h + 'h ' + m + 'm' : h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    }

    return Response.json({
      device: {
        id: dev.id, name: dev.name, type: dev.device_type,
        status: dev.current_status, make: dev.make, model: dev.model,
        ipAddress: dev.ip_address, macAddress: dev.mac_address,
        lastSeenAt: dev.last_seen_at, siteName: dev.site_name,
        serialNumber: dev.serial_number, firmwareVersion: dev.firmware_version,
        description: dev.description, eolDate: dev.eol_date,
        warrantyExpiry: dev.warranty_expiry, uptimeSeconds: dev.uptime_seconds,
        uptimeFormatted, isCritical: dev.is_critical,
        hasRedundancy: dev.has_redundancy, isRetired: dev.is_retired,
        createdAt: dev.created_at, updatedAt: dev.updated_at,
      },
      neighbors: neighborsResult.rows.filter(r => r.neighbor_name).map(r => ({
        name: r.neighbor_name, type: r.neighbor_type, make: r.neighbor_make,
        model: r.neighbor_model, status: r.neighbor_status,
        ipAddress: r.neighbor_ip, deviceId: r.neighbor_device_id,
        localInterface: r.local_interface, remoteInterface: r.remote_interface,
        method: r.relationship_type,
      })),
      interfaces: interfacesResult.rows.map(r => ({
        ipAddress: r.ip_address, interfaceName: r.interface_name,
        vlanId: r.vlan_id, isPrimary: r.is_primary, source: r.source,
      })),
      endpoints: endpoints.map(e => ({
        mac: e.mac_address, ip: e.ip_address, manufacturer: e.manufacturer,
        connectionType: e.connection_type, port: e.port_index,
        apName: e.connected_ap_name, switchName: e.connected_switch_name,
        status: e.status, lastSeen: e.last_seen,
      })),
      uptime: { percent: uptimePercent, days, totalEvents: history.length },
      history: history.map(h => ({ status: h.status, changedAt: h.changed_at, source: h.source })),
    });
  } catch (err) {
    console.error('[VEMIO API] Device detail error:', err.message);
    return Response.json({ error: 'Failed to fetch device detail' }, { status: 500 });
  }
});
