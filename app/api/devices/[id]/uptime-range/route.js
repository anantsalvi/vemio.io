/**
 * VEMIO™ — Device Uptime Range API
 * GET /api/devices/[id]/uptime-range?from=<iso>&to=<iso>
 *
 * Returns status change events within the window, plus the last status
 * change *before* the window (so the chart can render the starting state
 * for devices that haven't changed status recently).
 *
 * DAY 22 — dual-source response + monitoring start.
 *
 *   Events classified by `source`:
 *     - confirmed:  sysuptime-delta, snmp-trap, collector-seed
 *                   (ground truth: device actually rebooted, or device was
 *                    seeded into monitoring)
 *     - inferred:   collector, webhook
 *                   (poll failures or legacy webhook events; may not reflect
 *                    actual device state)
 *
 *   monitoringStart:
 *     The earliest moment we have ANY observation of the device. Periods
 *     before this within the window represent "we weren't watching yet",
 *     not "device was down". The frontend renders these as a distinct
 *     unmonitored band, and uptime percentages are calculated only over
 *     [max(from, monitoringStart), to].
 *
 *   Two uptime percents (both over the MONITORED portion of the window):
 *     - confirmedUptimePercent: counts only confirmed transitions.
 *     - monitoringUptimePercent: legacy calc, all events count.
 *
 * Day 16 — Scope 2.
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
 * an ordered list of {status, changedAt} events. Events outside [from,to]
 * are ignored. Returns null if range is non-positive.
 */
function computeUptimePercent(from, to, priorStatus, events) {
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs <= 0) return null;

  let uptimeMs = 0;
  let cursorStatus = priorStatus;
  let cursorTime = from;
  for (const e of events) {
    const eTime = new Date(e.changedAt);
    if (eTime <= from) {
      // Event at or before the calc window start — apply its status as
      // the current status, but don't accumulate any time.
      cursorStatus = e.status;
      cursorTime = from;
      continue;
    }
    if (eTime > to) break;
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

    // Earliest observation of this device. Defines monitoringStart.
    const earliestResult = await queryWithTenant(tenantId,
      `SELECT MIN(changed_at) AS first_seen
         FROM device_status_history
        WHERE device_id = $1`,
      [deviceId]
    );
    const monitoringStartRaw = earliestResult.rows[0]?.first_seen || null;
    const monitoringStart = monitoringStartRaw ? new Date(monitoringStartRaw) : null;

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
    let priorStatus;
    let priorInferred;
    if (priorResult.rows.length > 0) {
      priorStatus = priorResult.rows[0].status;
      priorInferred = !isConfirmed(priorResult.rows[0].source);
    } else if (eventsResult.rows.length > 0) {
      // No history before window. First event in-window starts monitoring
      // (or close to it). Set priorStatus to a reasonable value for the
      // sub-monitoringStart period; the chart's unmonitored band will
      // visually override it for confirmed seeds.
      const firstEvent = eventsResult.rows[0];
      if (isConfirmed(firstEvent.source)) {
        priorStatus = firstEvent.status;
        priorInferred = false;
      } else {
        priorStatus = firstEvent.status === 'up' ? 'down' : 'up';
        priorInferred = true;
      }
    } else {
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
    const confirmedEvents = allEvents.filter(e => e.confirmed);

    // Compute uptime over the MONITORED portion of the window only.
    let calcFrom = from;
    let calcPriorStatus = priorStatus;
    if (monitoringStart && monitoringStart > from) {
      calcFrom = monitoringStart;
      // First event at or after calcFrom defines the starting state of
      // the monitored period.
      const seedEvent = allEvents.find(
        e => new Date(e.changedAt).getTime() >= calcFrom.getTime()
      );
      if (seedEvent) calcPriorStatus = seedEvent.status;
    }

    const monitoringUptimePercent = computeUptimePercent(calcFrom, to, calcPriorStatus, allEvents);
    const confirmedUptimePercent = computeUptimePercent(calcFrom, to, calcPriorStatus, confirmedEvents);

    return Response.json({
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      monitoringStart: monitoringStart ? monitoringStart.toISOString() : null,
      priorStatus,
      priorInferred,
      events: allEvents,
      confirmedEventCount: confirmedEvents.length,
      inferredEventCount: allEvents.length - confirmedEvents.length,
      currentStatus: device.current_status,
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
