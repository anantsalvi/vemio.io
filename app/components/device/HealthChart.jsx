'use client';

/**
 * VEMIO™ — HealthChart
 * CPU + memory percent time series for a device, over a given {from, to} range.
 * Backed by GET /api/devices/:id/health-history.
 *
 * Null samples (e.g. ProCurve intermittent CPU) render as gaps — we deliberately
 * do NOT connectNulls, so that intermittent-polling behavior is visible rather
 * than smoothed over.
 *
 * Day 16 — Scope 2.
 */

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';

function formatXAxisTick(timestamp, rangeMs) {
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (rangeMs > 24 * 60 * 60 * 1000) {
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hm}`;
  }
  return hm;
}

function formatTooltipLabel(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString();
}

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  return `${Number(v).toFixed(1)}%`;
}

export default function HealthChart({ deviceId, from, to, height = 240 }) {
  const [samples, setSamples] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (!deviceId || !from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = `/api/devices/${deviceId}/health-history?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setSamples(data.samples || []);
        setTruncated(!!data.range?.truncated);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [deviceId, from, to]);

  const rangeMs = (from && to) ? to.getTime() - from.getTime() : 0;

  const chartData = (samples || []).map(s => ({
    t: new Date(s.recordedAt).getTime(),
    cpu: s.cpuPercent,
    mem: s.memoryPercent,
  }));

  return (
    <div className="vemio-health-chart">
      <div className="vemio-health-header">
        <h4 className="vemio-health-title">Device Utilization</h4>
        {truncated && (
          <span className="vemio-health-warning">
            Showing first 5000 samples — narrow the range for complete data
          </span>
        )}
      </div>

      <div className="vemio-health-body" style={{ height }}>
        {loading && <div className="vemio-health-state">Loading…</div>}
        {!loading && error && (
          <div className="vemio-health-state vemio-health-error">
            Failed to load: {error}
          </div>
        )}
        {!loading && !error && chartData.length === 0 && (
          <div className="vemio-health-state">
            No health samples in this range.
          </div>
        )}
        {!loading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={[from.getTime(), to.getTime()]}
                tickFormatter={(t) => formatXAxisTick(t, rangeMs)}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
                stroke="rgba(255,255,255,0.15)"
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }}
                stroke="rgba(255,255,255,0.15)"
                width={48}
              />
              <Tooltip
                labelFormatter={formatTooltipLabel}
                formatter={(v, name) => [formatValue(v), name]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(10,10,10,0.95)',
                  color: 'rgba(255,255,255,0.9)',
                }}
                itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
                labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
              />
              <Legend
                verticalAlign="top"
                height={24}
                wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}
              />
              <Line
                type="monotone"
                dataKey="cpu"
                name="CPU"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="mem"
                name="Memory"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <style jsx>{`
        .vemio-health-chart {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .vemio-health-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
        }
        .vemio-health-title {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin: 0;
        }
        .vemio-health-warning {
          font-size: 11px;
          color: #f59e0b;
        }
        .vemio-health-body {
          width: 100%;
          position: relative;
        }
        .vemio-health-state {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
        }
        .vemio-health-error {
          color: #ef4444;
        }
      `}</style>
    </div>
  );
}
