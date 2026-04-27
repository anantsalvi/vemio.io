'use client';

/**
 * VEMIO™ — UptimeTimeline (Day 22 v3)
 *
 * Stepped up/down line chart in the style of Pingdom-class uptime charts.
 *
 *   - Y axis is binary: up (top) or down (bottom).
 *   - Cyan stepped line stays at "up" while the device is reachable and not
 *     rebooting. Drops to "down" at confirmed reboot moments and at gaps in
 *     polling, returns to "up" once the device is reachable again.
 *   - Confirmed reboot dips: solid cyan, narrow.
 *   - Gaps in polling (no sample for > MAX_GAP_MS): rendered as a gray
 *     "monitoring gap" band — distinct from confirmed-down so the reader
 *     can tell whether a "down" was a real outage or a collector hiccup.
 *   - Pre-monitoring period (before earliest sample / synthesized boot):
 *     gray "unmonitored" band.
 *
 * Backed by GET /api/devices/:id/uptime-range (Day 22 v3 schema).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

// A "gap" in polling is anything longer than this between adjacent samples.
// At 180s (3min) poll cadence, anything over 6 minutes is suspicious.
const MAX_GAP_MS = 6 * 60 * 1000;

// Visual durations for confirmed reboot dips. The dip is centered on the
// boot_time_estimate; the line drops to "down" REBOOT_DIP_MS/2 before and
// returns to "up" REBOOT_DIP_MS/2 after.
const REBOOT_DIP_MS = 60 * 1000;

const Y_UP = 100;
const Y_DOWN = 0;

function formatXAxisTick(timestamp, rangeMs) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (rangeMs > 24 * 60 * 60 * 1000) {
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hm}`;
  }
  return hm;
}

function formatTooltipLabel(ts) {
  return new Date(ts).toLocaleString();
}

/**
 * Walk the samples + reboots, emit a series of points at every transition.
 * Each point has:
 *   t            timestamp (ms)
 *   line         Y_UP / Y_DOWN / null  (the cyan stepped line)
 *   gap          Y_UP if this t is inside a polling gap, else null
 *   unmonitored  Y_UP if this t is before any data, else null
 */
function buildSeries(from, to, samples, reboots, synthesis) {
  const fromMs = from.getTime();
  const toMs = to.getTime();

  // Real samples sorted by time, with parsed ms timestamps.
  const reachableSamples = (samples || [])
    .filter(s => s.reachable)
    .map(s => ({ tMs: new Date(s.t).getTime(), uptimeSec: s.uptimeSeconds }))
    .sort((a, b) => a.tMs - b.tMs);

  const earliestSampleMs = reachableSamples.length > 0
    ? reachableSamples[0].tMs
    : null;
  const latestSampleMs = reachableSamples.length > 0
    ? reachableSamples[reachableSamples.length - 1].tMs
    : null;

  // Reboot events sorted by boot time.
  const sortedReboots = (reboots || [])
    .map(r => ({
      bootMs: new Date(r.bootTime).getTime(),
      prevObservedMs: new Date(r.prevObservedAt).getTime(),
    }))
    .filter(r => !isNaN(r.bootMs))
    .sort((a, b) => a.bootMs - b.bootMs);

  // Synthesis: lastBootEstimate from device's most recent known uptime.
  const synthBootMs = synthesis?.lastBootEstimate
    ? new Date(synthesis.lastBootEstimate).getTime()
    : null;
  const synthLatestMs = synthesis?.latestPolledAt
    ? new Date(synthesis.latestPolledAt).getTime()
    : null;

  // The "monitored region": the union of [synthBoot, synthLatest] and
  // [earliestSample, latestSample]. Anything outside is unmonitored.
  let monStartMs = null;
  if (synthBootMs !== null) monStartMs = synthBootMs;
  if (earliestSampleMs !== null) {
    monStartMs = monStartMs === null
      ? earliestSampleMs
      : Math.min(monStartMs, earliestSampleMs);
  }

  let monEndMs = null;
  if (synthLatestMs !== null) monEndMs = synthLatestMs;
  if (latestSampleMs !== null) {
    monEndMs = monEndMs === null
      ? latestSampleMs
      : Math.max(monEndMs, latestSampleMs);
  }

  // Build a list of "events" (transitions) at distinct timestamps within
  // [from, to]. We emit a sample point per significant moment:
  //   - window start/end
  //   - monitoring start/end (if inside window)
  //   - each reboot (drop+rise)
  //   - each polling gap (drop at gap start, rise at gap end)
  // The chart uses connectNulls=false so each band only paints where it
  // has data.

  const events = [];

  // Identify polling gaps. A gap = adjacent reachable samples more than
  // MAX_GAP_MS apart. Treat the gap as a down region from sample[i].t
  // until sample[i+1].t.
  const gaps = [];
  for (let i = 1; i < reachableSamples.length; i++) {
    const dt = reachableSamples[i].tMs - reachableSamples[i - 1].tMs;
    if (dt > MAX_GAP_MS) {
      gaps.push({ startMs: reachableSamples[i - 1].tMs, endMs: reachableSamples[i].tMs });
    }
  }

  // Helper: produce {t, line, gap, unmonitored} given the situation at a
  // time point. We compute booleans then assign.
  function pointAt(tMs, opts = {}) {
    const isUnmonitored = monStartMs !== null && tMs < monStartMs;
    const isInGap = gaps.some(g => tMs > g.startMs && tMs < g.endMs);
    const isInRebootDip = sortedReboots.some(r =>
      tMs >= r.bootMs - REBOOT_DIP_MS / 2 && tMs <= r.bootMs + REBOOT_DIP_MS / 2
    );

    let line = null;
    if (!isUnmonitored && !isInGap) {
      line = (isInRebootDip || opts.forceDown) ? Y_DOWN : Y_UP;
    }

    return {
      t: tMs,
      line,
      gap: isInGap ? Y_UP : null,
      unmonitored: isUnmonitored ? Y_UP : null,
    };
  }

  // Densely sample the window so step rendering is correct. We emit
  // ~300 evenly-spaced points plus extra points at every gap/reboot edge
  // to make transitions sharp.
  const TARGET_POINTS = 300;
  const granularity = Math.max(60_000, Math.floor((toMs - fromMs) / TARGET_POINTS));

  const tSet = new Set();
  for (let t = fromMs; t <= toMs; t += granularity) tSet.add(t);
  tSet.add(fromMs);
  tSet.add(toMs);
  if (monStartMs !== null && monStartMs >= fromMs && monStartMs <= toMs) {
    tSet.add(monStartMs - 1);
    tSet.add(monStartMs);
  }
  for (const g of gaps) {
    tSet.add(g.startMs);
    tSet.add(g.startMs + 1);
    tSet.add(g.endMs - 1);
    tSet.add(g.endMs);
  }
  for (const r of sortedReboots) {
    tSet.add(r.bootMs - REBOOT_DIP_MS / 2 - 1);
    tSet.add(r.bootMs - REBOOT_DIP_MS / 2);
    tSet.add(r.bootMs);
    tSet.add(r.bootMs + REBOOT_DIP_MS / 2);
    tSet.add(r.bootMs + REBOOT_DIP_MS / 2 + 1);
  }

  const sortedTs = [...tSet].filter(t => t >= fromMs && t <= toMs).sort((a, b) => a - b);

  for (const t of sortedTs) {
    events.push(pointAt(t));
  }

  return { series: events, monStartMs, gaps, sortedReboots };
}

export default function UptimeTimeline({
  deviceId, from, to, height = 80, onData, showHeader = true,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deviceId || !from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/api/devices/${deviceId}/uptime-range?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((body) => {
        if (cancelled) return;
        setData(body);
        if (onData) onData(body);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [deviceId, from, to]);

  const { series } = useMemo(() => {
    if (!data || !from || !to) return { series: [] };
    return buildSeries(from, to, data.samples, data.reboots, data.synthesis);
  }, [data, from, to]);

  const rangeMs = (from && to) ? to.getTime() - from.getTime() : 0;

  return (
    <div className="vemio-uptime-timeline">
      {showHeader && (
        <div className="vemio-uptime-header">
          <h4 className="vemio-uptime-title">Online Status</h4>
          {data && (
            <span className="vemio-uptime-meta">
              {data.rebootCount === 0
                ? 'No reboots in window'
                : `${data.rebootCount} reboot${data.rebootCount === 1 ? '' : 's'} in window`}
            </span>
          )}
        </div>
      )}

      <div className="vemio-uptime-body" style={{ height }}>
        {loading && <div className="vemio-uptime-state">Loading…</div>}
        {!loading && error && (
          <div className="vemio-uptime-state vemio-uptime-error">
            Failed to load: {error}
          </div>
        )}
        {!loading && !error && series.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series}
              margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} horizontal={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[from.getTime(), to.getTime()]}
                tickFormatter={(t) => formatXAxisTick(t, rangeMs)}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
                stroke="rgba(255,255,255,0.15)"
              />
              <YAxis hide domain={[0, 100]} />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                formatter={(v, name) => {
                  if (v == null) return null;
                  if (name === 'unmonitored') return ['Not monitored yet', 'Status'];
                  if (name === 'gap') return ['Down (collector gap — may not be actual outage)', 'Status'];
                  if (name === 'line') {
                    return [v === Y_UP ? 'Up' : 'Down (confirmed reboot)', 'Status'];
                  }
                  return [v, name];
                }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(10,10,10,0.95)',
                  color: 'rgba(255,255,255,0.9)',
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                separator=": "
              />

              {/* Unmonitored band (gray) — full-height fill */}
              <Area
                type="step"
                dataKey="unmonitored"
                stroke="rgba(255,255,255,0.10)"
                fill="rgba(255,255,255,0.05)"
                isAnimationActive={false}
                connectNulls={false}
                activeDot={false}
              />

              {/* Polling-gap band (also gray-ish, but distinct from unmonitored) */}
              <Area
                type="step"
                dataKey="gap"
                stroke="rgba(255,255,255,0.18)"
                fill="rgba(255,255,255,0.10)"
                isAnimationActive={false}
                connectNulls={false}
                activeDot={false}
              />

              {/* The cyan stepped line: up=100, down=0, null=hidden */}
              <Line
                type="stepAfter"
                dataKey="line"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <style jsx>{`
        .vemio-uptime-timeline { display: flex; flex-direction: column; gap: 8px; }
        .vemio-uptime-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .vemio-uptime-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.9); margin: 0; }
        .vemio-uptime-meta { font-size: 12px; color: rgba(255,255,255,0.6); font-variant-numeric: tabular-nums; }
        .vemio-uptime-body { width: 100%; position: relative; }
        .vemio-uptime-state { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: rgba(255,255,255,0.5); }
        .vemio-uptime-error { color: #ef4444; }
      `}</style>
    </div>
  );
}
