/**
 * VEMIO™ — Device Retire/Reactivate API
 * PATCH /api/devices/[id]/retire
 *
 * Toggles the is_retired flag on a device.
 * Body: { retired: true|false }
 * 
 * Retired devices are excluded from all dashboards, topology, alerts, and BCS.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const PATCH = withAuth(async (req, session, { params }) => {
  const tenantId = session.user.tenantId;
  const { id: deviceId } = await params;

  try {
    const body = await req.json();
    const retired = body.retired === true;

    const result = await queryWithTenant(tenantId,
      `UPDATE devices
       SET is_retired = $1
       WHERE id = $2
       RETURNING id, name, is_retired`,
      [retired, deviceId]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    const device = result.rows[0];
    return Response.json({
      id: device.id,
      name: device.name,
      isRetired: device.is_retired,
      message: device.is_retired
        ? `${device.name} has been retired and will be hidden from dashboards`
        : `${device.name} has been reactivated`,
    });
  } catch (err) {
    console.error('[VEMIO API] Device retire error:', err.message);
    return Response.json({ error: 'Failed to update device' }, { status: 500 });
  }
});