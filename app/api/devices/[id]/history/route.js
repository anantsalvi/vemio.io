/**
 * VEMIO™ — Device History API
 * GET /api/devices/[id]/history
 * 
 * Returns status history and all IP interfaces for a single device.
 * Query params: days (7, 30, 90)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const tenantId = session.user.tenantId;
  const { id: deviceId } = await params;
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '30')));

  try {
    // Get device info — including enrichment fields
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

    // Get status history entries
    const historyResult = await queryWithTenant(tenantId,
      `SELECT status, changed_at, source
       FROM device_status_history
       WHERE device_id = $1
         AND changed_at > NOW() - INTERVAL '${days} days'
       ORDER BY changed_at ASC`,
      [deviceId]
    );

    // Calculate uptime percentage from history
    const history = historyResult.rows;
    let uptimePercent = null;

    if (history.length > 0) {
      const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const now = new Date();
      let uptimeMs = 0;
      let lastStatus = history[0].status;
      let lastTime = new Date(Math.max(periodStart.getTime(), new Date(history[0].changed_at).getTime()));

      for (let i = 1; i < history.length; i++) {
        const entryTime = new Date(history[i].changed_at);
        if (lastStatus === 'up') {
          uptimeMs += entryTime.getTime() - lastTime.getTime();
        }
        lastStatus = history[i].status;
        lastTime = entryTime;
      }

      // Account for time from last entry to now
      if (lastStatus === 'up') {
        uptimeMs += now.getTime() - lastTime.getTime();
      }

      const totalMs = now.getTime() - periodStart.getTime();
      uptimePercent = totalMs > 0 ? (uptimeMs / totalMs * 100) : null;
    }

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
      history: history.map(h => ({
        status: h.status,
        changedAt: h.changed_at,
        source: h.source,
      })),
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