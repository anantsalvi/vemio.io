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

  if (!isMSP) {
    return { tenantId: userTenantId };
  }

  // MSP user — find which managed tenant owns this device
  // Query msp_tenant_access to get managed tenants, then check each
  const managedResult = await queryWithTenant(userTenantId,
    `SELECT managed_tenant_id FROM msp_tenant_access WHERE msp_tenant_id = $1`,
    [userTenantId]
  );

  for (const row of managedResult.rows) {
    const tid = row.managed_tenant_id;
    const check = await queryWithTenant(tid,
      'SELECT id FROM devices WHERE id = $1',
      [deviceId]
    );
    if (check.rows.length > 0) {
      return { tenantId: tid };
    }
  }

  return { error: 'Device not found', status: 404 };
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
