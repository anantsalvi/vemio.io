/**
 * VEMIO™ — Device Neighbors API
 * GET /api/devices/[id]/neighbors
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const tenantId = session.user.tenantId;

  try {
    // Get the device's Auvik ID
    const deviceResult = await queryWithTenant(tenantId,
      `SELECT auvik_device_id, name FROM devices WHERE id = $1`,
      [deviceId]
    );
    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }
    const auvikId = deviceResult.rows[0].auvik_device_id;

    // Get all neighbors
    const result = await queryWithTenant(tenantId,
      `SELECT
         dn.interface_name AS local_interface,
         dn.neighbor_interface AS remote_interface,
         dn.relationship_type,
         dn.connection_type,
         CASE WHEN dn.device_id = $1 THEN nd.name ELSE sd.name END AS neighbor_name,
         CASE WHEN dn.device_id = $1 THEN nd.device_type ELSE sd.device_type END AS neighbor_type,
         CASE WHEN dn.device_id = $1 THEN nd.make ELSE sd.make END AS neighbor_make,
         CASE WHEN dn.device_id = $1 THEN nd.model ELSE sd.model END AS neighbor_model,
         CASE WHEN dn.device_id = $1 THEN nd.current_status ELSE sd.current_status END AS neighbor_status,
         CASE WHEN dn.device_id = $1 THEN nd.ip_address ELSE sd.ip_address END AS neighbor_ip,
         CASE WHEN dn.device_id = $1 THEN nd.id ELSE sd.id END AS neighbor_device_id
       FROM device_neighbors dn
       LEFT JOIN devices sd ON sd.auvik_device_id = dn.device_id AND dn.device_id != $1 AND sd.tenant_id = dn.tenant_id
       LEFT JOIN devices nd ON nd.auvik_device_id = dn.neighbor_device_id AND dn.device_id = $1 AND nd.tenant_id = dn.tenant_id
       WHERE (dn.device_id = $1 OR dn.neighbor_device_id = $1)
       ORDER BY neighbor_name ASC`,
      [auvikId]
    );

    const neighbors = result.rows
      .filter(r => r.neighbor_name) // filter out nulls from unresolved joins
      .map(r => ({
        name: r.neighbor_name,
        type: r.neighbor_type,
        make: r.neighbor_make,
        model: r.neighbor_model,
        status: r.neighbor_status,
        ipAddress: r.neighbor_ip,
        deviceId: r.neighbor_device_id,
        localInterface: r.local_interface,
        remoteInterface: r.remote_interface,
        connectionType: r.connection_type || 'physical',
      }));

    return Response.json({ neighbors });
  } catch (err) {
    console.error('[VEMIO API] Device neighbors error:', err.message);
    return Response.json({ error: 'Failed to fetch neighbors' }, { status: 500 });
  }
});