'use client';

/**
 * VEMIO™ — UptimeTimeline
 * Filled-area uptime chart: green band where device was up, red band where down.
 * Backed by GET /api/devices/:id/uptime-range.
 *
 * DAY 22 — three-tier rendering:
 *   - Confirmed up (green, solid)
 *   - Confirmed down (red, solid) — sysuptime-delta or snmp-trap events
 *   - Inferred down (red, diagonal-stripe pattern) — collector poll-failure
 *     events that may not represent actual outages
 *
 * Sample series carries `confidenceDown` for inferred-down regions, so the
 * chart can render a separate striped layer on top of solid red.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const TARGET_POINTS = 200;
const MAX_POINTS = 600;
const MIN_GRANULARITY_MS = 30 * 1000;

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
 * Build a dense sample series. Each sample has three nullable bands so that
 * each <Area> only renders where that particular state is active:
 *   - up:           filled when status is up
 *   - downSolid:    filled when status is down AND last transition was confirmed
 *   - downStriped:  filled when status is down AND last transition was inferred
 *
 * "Inferred" includes the case where status started inferred and there have
 * been no confirmed events since.
 */
function buildSamples(from, to, priorStatus, priorInferred, events) {
  const rangeMs = to.getTime() - from.getTime();
  let granularity = Math.max(MIN_GRANULARITY_MS, Math.floor(rangeMs / TARGET_POINTS));
  let pointCount = Math.floor(rangeMs / granularity) + 1;
  if (pointCount > MAX_POINTS) {
    granularity = Math.ceil(rangeMs / MAX_POINTS);
    pointCount = MAX_POINTS + 1;
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  );

  const samples = [];
  let eventIdx = 0;
  let currentStatus = priorStatus;
  let currentConfirmed = !priorInferred;

  for (let i = 0; i < pointCount; i++) {
    const t = from.getTime() + i * granularity;
    while (eventIdx < sorted.length && new Date(sorted[eventIdx].changedAt).getTime() <= t) {
      currentStatus = sorted[eventIdx].status;
      currentConfirmed = !!sorted[eventIdx].confirmed;
      eventIdx++;
    }
    const isUp = currentStatus === 'up';
    samples.push({
      t,
      up: isUp ? 100 : null,
      downSolid: !isUp && currentConfirmed ? 100 : null,
      downStriped: !isUp && !currentConfirmed ? 100 : null,
    });
  }
  return samples;
}

export default function UptimeTimeline({ deviceId, from, to, height = 80, onData, showHeader = true }) {
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

  const samples = useMemo(() => {
    if (!data || !from || !to) return [];
    return buildSamples(from, to, data.priorStatus, data.priorInferred, data.events || []);
  }, [data, from, to]);

  const rangeMs = (from && to) ? to.getTime() - from.getTime() : 0;

  return (
    <div className="vemio-uptime-timeline">
      {showHeader && (
        <div className="vemio-uptime-header">
          <h4 className="vemio-uptime-title">Online Status</h4>
          {data && data.confirmedUptimePercent !== null && (
            <span className="vemio-uptime-meta">
              {data.confirmedUptimePercent.toFixed(2)}% up
              {data.priorInferred && <span className="vemio-uptime-inferred"> · starting state inferred</span>}
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
        {!loading && !error && samples.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={samples} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <pattern
                  id="vemio-uptime-stripes"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#ef4444" fillOpacity="0.25" />
                  <rect width="3" height="8" fill="#ef4444" fillOpacity="0.7" />
                </pattern>
              </defs>
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
                  if (name === 'up') return ['Up', 'Status'];
                  if (name === 'downSolid') return ['Down (confirmed reboot)', 'Status'];
                  if (name === 'downStriped') return ['Down (poll failure — may not be actual outage)', 'Status'];
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
              <Area
                type="step"
                dataKey="up"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.7}
                isAnimationActive={false}
                connectNulls={false}
                activeDot={false}
              />
              <Area
                type="step"
                dataKey="downSolid"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.7}
                isAnimationActive={false}
                connectNulls={false}
                activeDot={false}
              />
              <Area
                type="step"
                dataKey="downStriped"
                stroke="#ef4444"
                strokeOpacity={0.4}
                fill="url(#vemio-uptime-stripes)"
                isAnimationActive={false}
                connectNulls={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <style jsx>{`
        .vemio-uptime-timeline {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .vemio-uptime-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
        }
        .vemio-uptime-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin: 0;
        }
        .vemio-uptime-meta {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
          font-variant-numeric: tabular-nums;
        }
        .vemio-uptime-inferred {
          color: rgba(255,255,255,0.4);
          font-style: italic;
        }
        .vemio-uptime-body {
          width: 100%;
          position: relative;
        }
        .vemio-uptime-state {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }
        .vemio-uptime-error {
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}
