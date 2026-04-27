/**
 * VEMIO™ — Device Uptime Range API
 * GET /api/devices/[id]/uptime-range?from=<iso>&to=<iso>
 *
 * DAY 22 v3 — sample-based architecture.
 *
 *   Returns a time series of uptime samples plus reboot events. The chart
 *   renders the samples directly as a line (uptime in seconds → hours/days);
 *   reboots appear as vertical drops where uptime returns to ~0.
 *
 *   When the requested window extends before the earliest stored sample,
 *   we synthesize a backfill segment from the most recent sample's uptime
 *   value: assume linear growth back to the implied boot time. Anything
 *   before that boot time is unmonitored.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const MIN_RANGE_MS = 60 * 1000;
const MAX_RANGE_MS = 90 * 24 * 60 * 60 * 1000;
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
    return Response.json({ error: 'Invalid range: from must be before to' }, { status: 400 });
  }
  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs < MIN_RANGE_MS) {
    return Response.json({ error: 'Range too small (min 1 minute)' }, { status: 400 });
  }
  if (rangeMs > MAX_RANGE_MS) {
    return Response.json({ error: 'Range too large (max 90 days)' }, { status: 400 });
  }

  try {
    // Device + current state (for synthesis fallback)
    const deviceResult = await queryWithTenant(tenantId,
      'SELECT id, current_status, uptime_seconds FROM devices WHERE id = $1',
      [deviceId]
    );
    if (deviceResult.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }
    const device = deviceResult.rows[0];

    // Samples within window. Each sample is a (polled_at, uptime_seconds)
    // pair the chart can plot directly.
    const samplesResult = await queryWithTenant(tenantId,
      `SELECT polled_at, uptime_ticks, reachable
         FROM device_uptime_samples
        WHERE device_id = $1
          AND polled_at >= $2
          AND polled_at <= $3
        ORDER BY polled_at ASC`,
      [deviceId, from.toISOString(), to.toISOString()]
    );

    // Latest sample overall (for synthesis when no samples in window)
    const latestResult = await queryWithTenant(tenantId,
      `SELECT polled_at, uptime_ticks
         FROM device_uptime_samples
        WHERE device_id = $1
          AND reachable = true
        ORDER BY polled_at DESC
        LIMIT 1`,
      [deviceId]
    );

    // Reboot events within window
    const rebootsResult = await queryWithTenant(tenantId,
      `SELECT detected_at, prev_observed_at, boot_time_estimate,
              prev_uptime_ticks, cur_uptime_ticks, source
         FROM device_reboot_events
        WHERE device_id = $1
          AND boot_time_estimate >= $2
          AND boot_time_estimate <= $3
        ORDER BY boot_time_estimate ASC`,
      [deviceId, from.toISOString(), to.toISOString()]
    );

    const reboots = rebootsResult.rows.map(r => ({
      detectedAt: r.detected_at,
      prevObservedAt: r.prev_observed_at,
      bootTime: r.boot_time_estimate,
      prevUptimeSeconds: Math.round(Number(r.prev_uptime_ticks) / 100),
      source: r.source,
    }));

    // Convert ticks → seconds for the chart. Drop unreachable samples
    // (they're rendered as gaps in the chart, which the frontend handles
    // via null-valued points).
    const samples = samplesResult.rows.map(r => ({
      t: r.polled_at,
      uptimeSeconds: r.reachable && r.uptime_ticks !== null
        ? Math.round(Number(r.uptime_ticks) / 100)
        : null,
      reachable: r.reachable,
    }));

    // Synthesis: if we have a latest sample, we can extrapolate a line
    // back to the implied last-boot time. The frontend uses this to fill
    // in the chart for periods before any stored samples.
    let synthesis = null;
    const latestRow = latestResult.rows[0];
    if (latestRow && latestRow.uptime_ticks !== null) {
      const latestTicks = Number(latestRow.uptime_ticks);
      const latestUptimeSec = Math.round(latestTicks / 100);
      const latestPolledAt = new Date(latestRow.polled_at);
      const lastBootEstimate = new Date(
        latestPolledAt.getTime() - latestUptimeSec * 1000
      );
      synthesis = {
        latestPolledAt: latestPolledAt.toISOString(),
        latestUptimeSeconds: latestUptimeSec,
        lastBootEstimate: lastBootEstimate.toISOString(),
      };
    } else if (device.uptime_seconds != null) {
      // Fallback: device row carries a current uptime (kept up-to-date by
      // the sysinfo handler's regular UPDATE). Use NOW as the implied poll
      // time. Slightly less accurate than a real sample but covers the
      // "freshly deployed, no samples yet" case.
      const latestUptimeSec = Number(device.uptime_seconds);
      const lastBootEstimate = new Date(now.getTime() - latestUptimeSec * 1000);
      synthesis = {
        latestPolledAt: now.toISOString(),
        latestUptimeSeconds: latestUptimeSec,
        lastBootEstimate: lastBootEstimate.toISOString(),
      };
    }

    return Response.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      currentStatus: device.current_status,
      samples,
      reboots,
      rebootCount: reboots.length,
      synthesis,
    });
  } catch (err) {
    console.error('[VEMIO API] Device uptime range error:', err.message);
    return Response.json({ error: 'Failed to fetch uptime range' }, { status: 500 });
  }
});
