/**
 * VEMIO™ | Endpoints API
 * GET /api/endpoints
 *
 * Returns all network endpoints (PCs, phones, cameras, etc.)
 * with their connection details, manufacturer, and status.
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
         cpc.last_seen,
         cd.ip_address AS switch_ip,
         cd.sys_name AS switch_name,
         cd.device_type AS switch_type
       FROM collector_port_clients cpc
       LEFT JOIN collector_devices cd ON cd.id = cpc.device_id
       WHERE cpc.status = 'active'
         AND cpc.last_seen > NOW() - INTERVAL '24 hours'
       ORDER BY cpc.last_seen DESC`
    );

    const endpoints = result.rows.map(row => ({
      mac: row.mac_address,
      ip: row.ip_address || null,
      hostname: row.hostname || null,
      connectionType: row.connection_type || 'wired',
      port: row.port_index,
      portName: row.port_name,
      vlanId: row.vlan_id,
      manufacturer: row.manufacturer || 'Unknown',
      apName: row.connected_ap_name || null,
      switchName: row.connected_switch_name || row.switch_name || null,
      switchIp: row.switch_ip || null,
      switchType: row.switch_type || null,
      status: row.status,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    }));

    const summary = {
      total: endpoints.length,
      wired: endpoints.filter(e => e.connectionType === 'wired').length,
      wireless: endpoints.filter(e => e.connectionType === 'wireless').length,
      withIp: endpoints.filter(e => e.ip).length,
    };

    return Response.json({ endpoints, summary });
  } catch (err) {
    console.error('[VEMIO API] Endpoints query error:', err.message);
    return Response.json({ error: 'Failed to fetch endpoints' }, { status: 500 });
  }
});
