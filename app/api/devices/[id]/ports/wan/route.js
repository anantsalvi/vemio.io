/**
 * VEMIO™ — Toggle WAN Flag on Device Port
 * app/api/devices/[id]/ports/[portId]/wan/route.js
 *
 * PATCH /api/devices/:id/ports/:portId/wan
 * Body: { isWan: true|false }
 *
 * MSP admin or tenant admin only.
 * Uses MSP-aware resolveTargetTenant/queryForTenant pattern.
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const PATCH = withAuth(async (req, session) => {
  // Only admins and msp_admin can toggle WAN
  if (!['admin', 'msp_admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const deviceId = segments[segments.indexOf('devices') + 1];
  const portId = segments[segments.indexOf('ports') + 1];

  if (!deviceId || !portId) {
    return Response.json({ error: 'Device ID and Port ID required' }, { status: 400 });
  }

  const body = await req.json();
  const isWan = Boolean(body.isWan);

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Verify device belongs to tenant
    const deviceCheck = await queryForTenant(target,
      'SELECT id FROM devices WHERE id = $1',
      [deviceId]
    );
    if (!deviceCheck.rows.length) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    // Update port
    const result = await queryForTenant(target,
      `UPDATE device_ports
       SET is_wan = $1
       WHERE id = $2 AND device_id = $3
       RETURNING id, interface_name, is_wan`,
      [isWan, portId, deviceId]
    );

    if (!result.rows.length) {
      return Response.json({ error: 'Port not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      port: result.rows[0],
    });
  } catch (err) {
    console.error('[VEMIO API] WAN toggle error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});