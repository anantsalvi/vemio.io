/**
 * VEMIO™ — Device Retire/Reactivate API
 * PATCH /api/devices/[id]/retire
 *
 * PHASE 6.1: MSP users can retire/reactivate devices from any managed tenant.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant, queryRaw } from '@/lib/db';

async function resolveDeviceTenant(session, deviceId) {
  const isMSP = session.user.isMSP === true;
  const userTenantId = session.user.tenantId;

  if (!isMSP) return { tenantId: userTenantId };

  const result = await queryRaw('SELECT tenant_id FROM devices WHERE id = $1', [deviceId]);
  if (result.rows.length === 0) return { error: 'Device not found', status: 404 };

  const deviceTenantId = result.rows[0].tenant_id;
  const accessCheck = await queryWithTenant(userTenantId,
    `SELECT 1 FROM msp_tenant_access WHERE msp_tenant_id = $1 AND managed_tenant_id = $2`,
    [userTenantId, deviceTenantId]
  );
  if (accessCheck.rows.length === 0) return { error: 'Access denied', status: 403 };

  return { tenantId: deviceTenantId };
}

export const PATCH = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;

  const resolved = await resolveDeviceTenant(session, deviceId);
  if (resolved.error) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const tenantId = resolved.tenantId;

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
