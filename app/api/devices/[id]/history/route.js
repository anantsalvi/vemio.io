/**
 * VEMIO™ — Device History API
 * GET /api/devices/[id]/history
 * 
 * Returns status history and all IP interfaces for a single device.
 * Query params: days (7, 30, 90)
 * 
 * PHASE 6.1: MSP users can view devices from any managed tenant.
 * Looks up the device's tenant_id first, validates MSP access, then queries.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant, queryRaw } from '@/lib/db';

/**
 * Resolve which tenant owns a device.
 * For MSP users, validates access via msp_tenant_access.
 * For client users, just returns their own tenant ID.
 */
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

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30')));

  // Phase 6.1: Resolve device's tenant (MSP can view any managed device)
  const resolved = await resolveDeviceTenant(session, deviceId);
  if (resolved.error) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const tenantId = resolved.tenantId;

  try {
    // Get device info
    const deviceResult = await queryWithTenant(tenantId,
      `SELECT d.id, d.name, d.device_type, d.current_status, d.make, d.model,
              d.ip_address, d.last_seen_at, d.auvik_device_id,
              d.serial_number, d.firmware_version,
              d.eol_date, d.warranty_expiry,
              d.is_critical, d.has_redundancy,
              d.firmware_is_current, d.config_last_validated,
              d.is_retired,
              s.name AS site_name,
              d.description
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       WHERE d.id = $1`,
      [deviceId]
    );

    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    const device = deviceResult.rows[0];

    // Get all IP interfaces for this device
    const interfacesResult = await queryWithTenant(tenantId,
      `SELECT ip_address, interface_name, vlan_id, is_primary, source, updated_at
       FROM device_interfaces
       WHERE device_id = $1
       ORDER BY is_primary DESC, ip_address ASC`,
      [deviceId]
    );

    // Get status history entries within the period
    const historyResult = await queryWithTenant(tenantId,
      `SELECT status, changed_at, source
       FROM device_status_history
       WHERE device_id = $1
         AND changed_at > NOW() - INTERVAL '${days} days'
       ORDER BY changed_at ASC`,
      [deviceId]
    );

    // Get the LAST status change BEFORE the period
    const priorStatusResult = await queryWithTenant(tenantId,
      `SELECT status, changed_at
       FROM device_status_history
       WHERE device_id = $1
         AND changed_at <= NOW() - INTERVAL '${days} days'
       ORDER BY changed_at DESC
       LIMIT 1`,
      [deviceId]
    );

    const history = historyResult.rows;
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const now = new Date();

    const priorStatus = priorStatusResult.rows[0]?.status
      || (history.length > 0 ? history[0].status : device.current_status);

    // Calculate uptime percentage
    let uptimePercent = null;
    {
      let uptimeMs = 0;
      let lastStatus = priorStatus;
      let lastTime = periodStart;

      for (const entry of history) {
        const entryTime = new Date(entry.changed_at);
        if (lastStatus === 'up') {
          uptimeMs += entryTime.getTime() - lastTime.getTime();
        }
        lastStatus = entry.status;
        lastTime = entryTime;
      }

      if (lastStatus === 'up') {
        uptimeMs += now.getTime() - lastTime.getTime();
      }

      const totalMs = now.getTime() - periodStart.getTime();
      uptimePercent = totalMs > 0 ? (uptimeMs / totalMs * 100) : null;
    }

    // Build chart-ready history with synthetic boundary points
    const chartHistory = [];

    chartHistory.push({
      status: priorStatus,
      changedAt: periodStart.toISOString(),
      source: 'synthetic',
    });

    for (const h of history) {
      chartHistory.push({
        status: h.status,
        changedAt: h.changed_at,
        source: h.source,
      });
    }

    chartHistory.push({
      status: device.current_status,
      changedAt: now.toISOString(),
      source: 'synthetic',
    });

    // Build daily uptime breakdown
    const dailyUptime = [];
    for (let d = days - 1; d >= 0; d--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - d);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayHistory = history.filter(h => {
        const t = new Date(h.changed_at);
        return t >= dayStart && t < dayEnd;
      });

      dailyUptime.push({
        date: dayStart.toISOString().split('T')[0],
        changes: dayHistory.length,
        hasData: dayHistory.length > 0,
      });
    }

    return Response.json({
      device: {
        id: device.id,
        name: device.name,
        type: device.device_type,
        status: device.current_status,
        make: device.make,
        model: device.model,
        ipAddress: device.ip_address,
        lastSeenAt: device.last_seen_at,
        siteName: device.site_name,
        auvikDeviceId: device.auvik_device_id,
        serialNumber: device.serial_number,
        firmwareVersion: device.firmware_version,
        eolDate: device.eol_date,
        warrantyExpiry: device.warranty_expiry,
        isCritical: device.is_critical,
        hasRedundancy: device.has_redundancy,
        firmwareIsCurrent: device.firmware_is_current,
        configLastValidated: device.config_last_validated,
        description: device.description,
        isRetired: device.is_retired,
      },
      interfaces: interfacesResult.rows.map(row => ({
        ipAddress: row.ip_address,
        interfaceName: row.interface_name,
        vlanId: row.vlan_id,
        isPrimary: row.is_primary,
        source: row.source,
        updatedAt: row.updated_at,
      })),
      history: chartHistory,
      uptime: {
        percent: uptimePercent !== null ? Math.round(uptimePercent * 100) / 100 : null,
        days,
        totalEvents: history.length,
      },
      dailyUptime,
    });
  } catch (err) {
    console.error('[VEMIO API] Device history error:', err.message);
    return Response.json({ error: 'Failed to fetch device history' }, { status: 500 });
  }
});
