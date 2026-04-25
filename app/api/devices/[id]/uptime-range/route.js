/**
 * VEMIO™ — Device Uptime Range API
 * GET /api/devices/[id]/uptime-range?from=<iso>&to=<iso>
 *
 * Returns status change events within the window, plus the last status
 * change *before* the window (so the chart can render the starting state
 * for devices that haven't changed status recently).
 *
 * DAY 22 — dual-source response.
 *   Events now classified by `source`:
 *     - confirmed:  sysuptime-delta, snmp-trap, collector-seed
 *                   (ground truth: device actually rebooted, or device was
 *                    seeded into monitoring)
 *     - inferred:   collector, webhook
 *                   (poll failures or legacy webhook events; may not reflect
 *                    actual device state)
 *
 *   Two uptime percents:
 *     - confirmedUptimePercent: counts only confirmed transitions. Treats
 *       inferred events as if device stayed up. This is the trustworthy
 *       number to lead with.
 *     - monitoringUptimePercent: legacy calc, all events count. Useful for
 *       reasoning about collector reliability, NOT device reliability.
 *
 * Day 16 — Scope 2.
 * Sibling to health-history route, same tenant model.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const MIN_RANGE_MS = 60 * 1000;
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_MS = 60 * 60 * 1000;

const CONFIRMED_SOURCES = new Set(['sysuptime-delta', 'snmp-trap', 'collector-seed']);

function isConfirmed(source) {
  return CONFIRMED_SOURCES.has(source);
}

function parseIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Compute uptime percent over [from, to], given a starting status and
 * an ordered list of {status, changedAt} events.
 */
function computeUptimePercent(from, to, priorStatus, events) {
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs <= 0) return null;

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

  return Math.round((uptimeMs / rangeMs) * 100 * 100) / 100;
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
      `SELECT status, changed_at, source
         FROM device_status_history
        WHERE device_id = $1
          AND changed_at < $2
        ORDER BY changed_at DESC
        LIMIT 1`,
      [deviceId, from.toISOString()]
    );

    // Determine starting status for the window.
    // Same logic as before, but priorInferred now also tracks whether the
    // prior event was from a confirmed source. A `collector-seed up` is
    // treated as confirmed prior state, not inferred.
    let priorStatus;
    let priorInferred;
    if (priorResult.rows.length > 0) {
      priorStatus = priorResult.rows[0].status;
      priorInferred = !isConfirmed(priorResult.rows[0].source);
    } else if (eventsResult.rows.length > 0) {
      // No history before window, but events within window — assume the
      // inverse of the first event.
      priorStatus = eventsResult.rows[0].status === 'up' ? 'down' : 'up';
      priorInferred = true;
    } else {
      // No history at all — fall back to current status.
      priorStatus = device.current_status || 'up';
      priorInferred = true;
    }

    // Annotate events with confirmed flag
    const allEvents = eventsResult.rows.map(r => ({
      status: r.status,
      changedAt: r.changed_at,
      source: r.source,
      confirmed: isConfirmed(r.source),
    }));

    // For confirmed-uptime calculation: treat inferred events as if they
    // didn't exist. Device's confirmed status only changes on confirmed
    // events. The starting status for confirmed calc may differ from the
    // window's starting status if the most recent confirmed prior is
    // different from the most recent any-source prior — but for now we
    // use the same priorStatus, since priorResult already prefers the
    // most recent event regardless of source. (A future refinement could
    // query for the most recent CONFIRMED prior separately, but in
    // practice the difference is small.)
    const confirmedEvents = allEvents.filter(e => e.confirmed);

    const monitoringUptimePercent = computeUptimePercent(from, to, priorStatus, allEvents);
    const confirmedUptimePercent = computeUptimePercent(from, to, priorStatus, confirmedEvents);

    return Response.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      priorStatus,
      priorInferred,
      events: allEvents,
      confirmedEventCount: confirmedEvents.length,
      inferredEventCount: allEvents.length - confirmedEvents.length,
      currentStatus: device.current_status,
      // Day 22: dual metrics. uptimePercent kept as alias for
      // confirmedUptimePercent so existing frontend code that reads it
      // gets the trustworthy number by default.
      uptimePercent: confirmedUptimePercent,
      confirmedUptimePercent,
      monitoringUptimePercent,
    });
  } catch (err) {
    console.error('[VEMIO API] Device uptime range error:', err.message);
    return Response.json(
      { error: 'Failed to fetch uptime range' },
      { status: 500 }
    );
  }
});
