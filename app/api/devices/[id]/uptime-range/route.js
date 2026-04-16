/**
 * VEMIO™ — Device Uptime Range API
 * GET /api/devices/[id]/uptime-range?from=<iso>&to=<iso>
 *
 * Returns status change events within the window, plus the last status
 * change *before* the window (so the chart can render the starting state
 * for devices that haven't changed status recently). The frontend uses
 * these to build a step series: [{ t: from, status: prior }, ...events,
 * { t: to, status: lastEvent?.status ?? prior }].
 *
 * Day 16 — Scope 2.
 * Sibling to health-history route, same tenant model.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const MIN_RANGE_MS = 60 * 1000;
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 60 * 60 * 1000;

function parseIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);

  const now = new Date();
  let to = parseIso(url.searchParams.get('to')) || now;
  let from = parseIso(url.searchParams.get('from'));
  if (!from) from = new Date(to.getTime() - DEFAULT_RANGE_MS);

  if (from >= to) {
    return Response.json(
      { error: 'Invalid range: from must be before to' },
      { status: 400 }
    );
  }
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs < MIN_RANGE_MS) {
    return Response.json({ error: 'Range too small (min 1 minute)' }, { status: 400 });
  }
  if (rangeMs > MAX_RANGE_MS) {
    return Response.json({ error: 'Range too large (max 7 days)' }, { status: 400 });
  }

  try {
    // Device + current status (for fallback when no history at all)
    const deviceResult = await queryWithTenant(tenantId,
      'SELECT id, current_status FROM devices WHERE id = $1',
      [deviceId]
    );
    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }
    const device = deviceResult.rows[0];

    // Status change events within window
    const eventsResult = await queryWithTenant(tenantId,
      `SELECT status, changed_at, source
         FROM device_status_history
        WHERE device_id = $1
          AND changed_at >= $2
          AND changed_at <= $3
        ORDER BY changed_at ASC`,
      [deviceId, from.toISOString(), to.toISOString()]
    );

    // Last status change before the window (defines the starting state)
    const priorResult = await queryWithTenant(tenantId,
      `SELECT status, changed_at
         FROM device_status_history
        WHERE device_id = $1
          AND changed_at < $2
        ORDER BY changed_at DESC
        LIMIT 1`,
      [deviceId, from.toISOString()]
    );

    // Determine starting status for the window
    let priorStatus;
    if (priorResult.rows.length > 0) {
      priorStatus = priorResult.rows[0].status;
    } else if (eventsResult.rows.length > 0) {
      // No history before window, but events within window — assume the
      // inverse of the first event (before it fired, state was the other).
      // This is an inference, not ground truth. Mark accordingly.
      priorStatus = eventsResult.rows[0].status === 'up' ? 'down' : 'up';
    } else {
      // No history at all — fall back to current status.
      priorStatus = device.current_status || 'up';
    }

    const events = eventsResult.rows.map(r => ({
      status: r.status,
      changedAt: r.changed_at,
      source: r.source,
    }));

    // Compute uptime percent over the window
    let uptimeMs = 0;
    let cursorStatus = priorStatus;
    let cursorTime = from;
    for (const e of events) {
      const eTime = new Date(e.changedAt);
      if (cursorStatus === 'up') uptimeMs += eTime.getTime() - cursorTime.getTime();
      cursorStatus = e.status;
      cursorTime = eTime;
    }
    if (cursorStatus === 'up') uptimeMs += to.getTime() - cursorTime.getTime();
    const uptimePercent = rangeMs > 0 ? (uptimeMs / rangeMs) * 100 : null;

    return Response.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      priorStatus,
      priorInferred: priorResult.rows.length === 0,
      events,
      currentStatus: device.current_status,
      uptimePercent: uptimePercent !== null
        ? Math.round(uptimePercent * 100) / 100
        : null,
    });
  } catch (err) {
    console.error('[VEMIO API] Device uptime range error:', err.message);
    return Response.json(
      { error: 'Failed to fetch uptime range' },
      { status: 500 }
    );
  }
});
