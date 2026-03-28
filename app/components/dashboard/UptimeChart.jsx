'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-vemio-surface-raised)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      <p className="text-vemio-text-muted">{label}</p>
      <p className="text-vemio-teal font-semibold mt-0.5">
        {payload[0].value != null ? payload[0].value.toFixed(1) : '—'}% uptime
      </p>
    </div>
  );
}

export default function UptimeChart({ data }) {
  const chartData = data || [];

  // Auto-scale Y-axis based on actual data range
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 100];
    const values = chartData.map(d => d.uptime).filter(v => v != null);
    if (!values.length) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Add padding: floor to nearest 5 below min, cap at 100
    const yMin = Math.max(0, Math.floor((min - 5) / 5) * 5);
    const yMax = Math.min(100, Math.ceil((max + 2) / 5) * 5);
    return [yMin, yMax];
  }, [chartData]);

  // Latest value for header
  const latestUptime = chartData.length > 0
    ? chartData[chartData.length - 1]?.uptime
    : null;

  // Color based on uptime level
  const uptimeColor = latestUptime != null
    ? latestUptime >= 99 ? '#22c55e'
      : latestUptime >= 95 ? '#14b8a6'
      : latestUptime >= 80 ? '#f59e0b'
      : '#ef4444'
    : '#14b8a6';

  return (
    <div className="uc-card">
      <div className="uc-header">
        <div>
          <h3 className="uc-title">Uptime Trend</h3>
          <p className="uc-sub">Last 7 days · all sites</p>
        </div>
        {latestUptime != null && (
          <span className="uc-pct" style={{ color: uptimeColor }}>
            {latestUptime.toFixed(1)}%
          </span>
        )}
      </div>

      {chartData.length > 0 ? (
        <div className="uc-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
              <defs>
                <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={uptimeColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={uptimeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-vemio-border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--color-vemio-text-dim)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                }}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11, fill: 'var(--color-vemio-text-dim)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="uptime"
                stroke={uptimeColor}
                strokeWidth={2}
                fill="url(#uptimeGradient)"
                dot={{ r: 3, fill: uptimeColor, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: uptimeColor, stroke: 'var(--color-vemio-bg)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="uc-empty">
          No uptime data yet — status history builds over time
        </div>
      )}

      <style>{`
        .uc-card {
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          height: 340px;
        }

        .uc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          flex-shrink: 0;
        }

        .uc-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
        }

        .uc-sub {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 2px 0 0;
        }

        .uc-pct {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
        }

        .uc-chart-wrap {
          flex: 1;
          min-height: 0;
        }

        .uc-empty {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: var(--color-vemio-text-dim);
        }

        @media (max-width: 767px) {
          .uc-card {
            height: 280px;
          }
        }
      `}</style>
    </div>
  );
}