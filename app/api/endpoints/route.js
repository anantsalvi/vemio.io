/**
 * VEMIO™ | Endpoints API v3
 * GET /api/endpoints
 *
 * Auvik-level endpoint accuracy:
 * - Only counts devices with an IP address OR a real (non-random) MAC on a known port
 * - Filters infrastructure device MACs (switches, APs, firewalls)
 * - Filters locally-administered/randomized MACs without IPs
 * - Classifies devices by manufacturer into types
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

/* ── Infrastructure manufacturer filter ── */
const INFRA_MANUFACTURERS = new Set([
  'cisco', 'aruba', 'hpe', 'ubiquiti', 'juniper', 'fortinet', 'meraki',
  'sophos', 'palo alto', 'sonicwall', 'watchguard', 'netgear',
]);

/* ── Check if MAC is locally administered (randomized) ── */
function isRandomizedMac(mac) {
  if (!mac) return false;
  const firstByte = parseInt(mac.split(':')[0] || mac.split('-')[0], 16);
  return !!(firstByte & 0x02);
}

/* ── Device-type classification from manufacturer ── */
function classifyDevice(manufacturer, mac) {
  if (!manufacturer || manufacturer === 'Unknown') {
    if (isRandomizedMac(mac)) return { type: 'mobile', icon: 'smartphone', label: 'Mobile (Random MAC)' };
    return { type: 'unknown', icon: 'help-circle', label: 'Unknown' };
  }

  const mfr = manufacturer.toLowerCase();

  if (['microsoft', 'hyper-v', 'vmware', 'virtualbox'].some(v => mfr.includes(v)))
    return { type: 'virtual', icon: 'cloud', label: 'Virtual Machine' };

  if (['samsung', 'apple', 'huawei', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'realme',
       'motorola', 'google', 'tcl', 'beats'].some(v => mfr.includes(v)))
    return { type: 'mobile', icon: 'smartphone', label: 'Mobile/Tablet' };

  if (['dell', 'lenovo', 'hp', 'acer', 'asus', 'asrock', 'msi', 'gigabyte'].some(v => mfr.includes(v)))
    return { type: 'workstation', icon: 'monitor', label: 'Workstation' };

  if (['intel', 'realtek', 'qualcomm', 'broadcom', 'amd'].some(v => mfr.includes(v)))
    return { type: 'workstation', icon: 'monitor', label: 'PC/Workstation' };

  if (['brother', 'canon', 'epson', 'xerox', 'ricoh', 'lexmark', 'konica'].some(v => mfr.includes(v)))
    return { type: 'printer', icon: 'printer', label: 'Printer' };

  if (['hikvision', 'tvt', 'dahua', 'prama', 'axis', 'vivotek', 'aditya'].some(v => mfr.includes(v)))
    return { type: 'camera', icon: 'camera', label: 'IP Camera' };

  if (['espressif', 'raspberry', 'arduino', 'tuya', 'shelly', 'tenda', 'shenzhen'].some(v => mfr.includes(v)))
    return { type: 'iot', icon: 'cpu', label: 'IoT Device' };

  if (['sonos', 'roku', 'amazon', 'ring', 'nest', 'chromecast'].some(v => mfr.includes(v)))
    return { type: 'media', icon: 'tv', label: 'Media Device' };

  if (['arris', 'd-link', 'tp-link'].some(v => mfr.includes(v)))
    return { type: 'network', icon: 'router', label: 'Network Device' };

  return { type: 'other', icon: 'box', label: manufacturer };
}

export const GET = withAuth(async (req, session) => {
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Get infrastructure device IPs to exclude
    const infraResult = await queryForTenant(target,
      `SELECT ip_address, name, device_type FROM devices WHERE current_status IS NOT NULL`
    );
    const infraIPs = new Set(
      infraResult.rows.map(r => {
        const ip = r.ip_address ? String(r.ip_address).replace('/32', '') : null;
        return ip;
      }).filter(Boolean)
    );

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
       WHERE cpc.ip_address IS NOT NULL
         AND cpc.last_seen > NOW() - INTERVAL '24 hours'
       ORDER BY cpc.last_seen DESC`
    );

    const endpoints = [];
    for (const row of result.rows) {
      const ip = row.ip_address ? String(row.ip_address).replace('/32', '') : null;
      const mac = String(row.mac_address || '');
      const manufacturer = row.manufacturer || 'Unknown';
      const switchName = row.connected_switch_name || null;

      // ── FILTER 1: Skip infrastructure device MACs (by IP match) ──
      if (ip && infraIPs.has(ip)) continue;

      // ── FILTER 2: Skip infrastructure manufacturer MACs ──
      if (manufacturer && INFRA_MANUFACTURERS.has(manufacturer.toLowerCase())) continue;

      // ── FILTER 3: Skip orphan MACs (no IP, no switch, no AP) ──
      if (!ip && !switchName && !row.connected_ap_name) continue;

      // ── FILTER 4: Skip randomized MACs without IP (transient WiFi probes) ──
      if (isRandomizedMac(mac) && !ip) continue;

      const classification = classifyDevice(manufacturer, mac);

      endpoints.push({
        mac,
        ip,
        hostname: row.hostname || null,
        connectionType: row.connection_type || 'wired',
        port: row.port_index,
        portName: row.port_name,
        vlanId: row.vlan_id,
        manufacturer,
        deviceType: classification.type,
        deviceIcon: classification.icon,
        deviceLabel: classification.label,
        apName: row.connected_ap_name || null,
        switchName,
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
      summary.byManufacturer[ep.manufacturer] = (summary.byManufacturer[ep.manufacturer] || 0) + 1;
    }

    return Response.json({ endpoints, summary });
  } catch (err) {
    console.error('[VEMIO API] Endpoints query error:', err.message);
    return Response.json({ error: 'Failed to fetch endpoints' }, { status: 500 });
  }
});
