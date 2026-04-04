/**
 * VEMIO™ | Endpoints API v2
 * GET /api/endpoints
 *
 * Returns network endpoints with manufacturer data, filtering out
 * infrastructure device MACs (switches, APs, firewalls).
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

/* ── Device-type classification from manufacturer ── */
function classifyDevice(manufacturer, mac, hostname) {
  if (!manufacturer || manufacturer === 'Unknown') {
    // Check locally administered bit
    if (mac) {
      const firstByte = parseInt(mac.split(':')[0] || mac.split('-')[0], 16);
      if (firstByte & 0x02) return { type: 'virtual', icon: 'cloud', label: 'Virtual/Random' };
    }
    return { type: 'unknown', icon: 'help-circle', label: 'Unknown' };
  }

  const mfr = manufacturer.toLowerCase();

  // Virtual / Hypervisor
  if (['microsoft', 'hyper-v', 'vmware', 'virtualbox'].some(v => mfr.includes(v)))
    return { type: 'virtual', icon: 'cloud', label: 'Virtual Machine' };

  // Mobile
  if (['samsung', 'apple', 'huawei', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'motorola', 'google'].some(v => mfr.includes(v)))
    return { type: 'mobile', icon: 'smartphone', label: 'Mobile/Tablet' };

  // PC / Workstation
  if (['dell', 'lenovo', 'hp', 'acer', 'asus', 'asrock', 'msi', 'gigabyte', 'intel', 'amd', 'realtek', 'qualcomm'].some(v => mfr.includes(v)))
    return { type: 'workstation', icon: 'monitor', label: 'Workstation' };

  // Printer
  if (['brother', 'canon', 'epson', 'xerox', 'ricoh', 'lexmark', 'konica'].some(v => mfr.includes(v)))
    return { type: 'printer', icon: 'printer', label: 'Printer' };

  // IoT
  if (['espressif', 'raspberry', 'arduino', 'texas instruments', 'tuya', 'shelly'].some(v => mfr.includes(v)))
    return { type: 'iot', icon: 'cpu', label: 'IoT Device' };

  // Networking (should be filtered but just in case)
  if (['cisco', 'aruba', 'hpe', 'ubiquiti', 'netgear', 'tp-link', 'juniper', 'fortinet', 'meraki', 'sophos', 'palo alto', 'sonicwall', 'watchguard'].some(v => mfr.includes(v)))
    return { type: 'network', icon: 'router', label: 'Network Device' };

  // Media
  if (['sonos', 'roku', 'amazon', 'ring', 'nest'].some(v => mfr.includes(v)))
    return { type: 'media', icon: 'tv', label: 'Media Device' };

  return { type: 'other', icon: 'box', label: manufacturer };
}

export const GET = withAuth(async (req, session) => {
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Get infrastructure device IPs + MACs to exclude
    const infraResult = await queryForTenant(target,
      `SELECT ip_address, name, device_type FROM devices WHERE current_status IS NOT NULL`
    );
    const infraIPs = new Set(infraResult.rows.map(r => r.ip_address?.replace('/32', '')).filter(Boolean));

    // Get endpoints
    const result = await queryForTenant(target,
      `SELECT
         cpc.mac_address,
         cpc.ip_address,
         cpc.hostname,
         cpc.connection_type,
         cpc.port_index,
         cpc.port_name,
         cpc.vlan_id,
         cpc.manufacturer,
         cpc.connected_ap_name,
         cpc.connected_switch_name,
         cpc.status,
         cpc.first_seen,
         cpc.last_seen
       FROM collector_port_clients cpc
       WHERE cpc.last_seen > NOW() - INTERVAL '24 hours'
       ORDER BY cpc.last_seen DESC`
    );

    const endpoints = [];
    for (const row of result.rows) {
      const ip = row.ip_address ? String(row.ip_address).replace('/32', '') : null;

      // Skip infrastructure device MACs
      if (ip && infraIPs.has(ip)) continue;

      const mac = String(row.mac_address || '');
      const manufacturer = row.manufacturer || 'Unknown';
      const classification = classifyDevice(manufacturer, mac, row.hostname);

      endpoints.push({
        mac,
        ip,
        hostname: row.hostname || null,
        connectionType: row.connection_type || 'wired',
        port: row.port_index,
        portName: row.port_name,
        vlanId: row.vlan_id,
        manufacturer: manufacturer === 'Virtual/Randomized' ? 'Randomized MAC' : manufacturer,
        deviceType: classification.type,
        deviceIcon: classification.icon,
        deviceLabel: classification.label,
        apName: row.connected_ap_name || null,
        switchName: row.connected_switch_name || null,
        status: row.status,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
      });
    }

    // Summary stats
    const summary = {
      total: endpoints.length,
      wired: endpoints.filter(e => e.connectionType === 'wired').length,
      wireless: endpoints.filter(e => e.connectionType === 'wireless').length,
      withIp: endpoints.filter(e => e.ip).length,
      byType: {},
      byManufacturer: {},
    };

    for (const ep of endpoints) {
      summary.byType[ep.deviceType] = (summary.byType[ep.deviceType] || 0) + 1;
      const mfr = ep.manufacturer === 'Unknown' ? 'Unknown' : ep.manufacturer;
      summary.byManufacturer[mfr] = (summary.byManufacturer[mfr] || 0) + 1;
    }

    return Response.json({ endpoints, summary });
  } catch (err) {
    console.error('[VEMIO API] Endpoints query error:', err.message);
    return Response.json({ error: 'Failed to fetch endpoints' }, { status: 500 });
  }
});
