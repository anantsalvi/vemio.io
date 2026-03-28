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
    <div className="uc-tooltip">
      <p className="uc-tooltip-date">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="uc-tooltip-row">
          <span className="uc-tooltip-dot" style={{ background: entry.color }} />
          <span className="uc-tooltip-label">{entry.name}</span>
          <span className="uc-tooltip-val" style={{ color: entry.color }}>
            {entry.value != null ? entry.value.toFixed(1) : '—'}%
          </span>
        </div>
      ))}

      <style>{`
        .uc-tooltip {
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 11px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.4);
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          min-width: 140px;
        }
        .uc-tooltip-date {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          margin: 0 0 6px;
          padding-bottom: 5px;
          border-bottom: 1px solid var(--color-vemio-border);
        }
        .uc-tooltip-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 2px 0;
        }
        .uc-tooltip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .uc-tooltip-label {
          font-size: 11px;
          color: var(--color-vemio-text-muted);
          flex: 1;
        }
        .uc-tooltip-val {
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

export default function UptimeChart({ data, devices }) {
  const chartData = data || [];

  // Auto-scale Y-axis
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 100];
    const values = chartData.map(d => d.uptime).filter(v => v != null);
    if (!values.length) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const yMin = Math.max(0, Math.floor((min - 5) / 5) * 5);
    const yMax = Math.min(100, Math.ceil((max + 2) / 5) * 5);
    return [yMin, yMax];
  }, [chartData]);

  const latestUptime = chartData.length > 0
    ? chartData[chartData.length - 1]?.uptime
    : null;

  const uptimeColor = latestUptime != null
    ? latestUptime >= 99 ? '#22c55e'
      : latestUptime >= 95 ? '#14b8a6'
      : latestUptime >= 80 ? '#f59e0b'
      : '#ef4444'
    : '#14b8a6';

  // Summary stats from devices prop
  const totalDevices = devices?.total ?? 0;
  const onlineDevices = devices?.up ?? 0;
  const availability = totalDevices > 0
    ? ((onlineDevices / totalDevices) * 100).toFixed(1)
    : null;

  return (
    <div className="uc-card">
      <div className="uc-header">
        <div>
          <h3 className="uc-title">Uptime Trend</h3>
          <p className="uc-sub">Last 7 days · all sites</p>
        </div>
        <div className="uc-header-right">
          {availability != null && (
            <div className="uc-avail">
              <span className="uc-avail-pct" style={{ color: uptimeColor }}>
                {latestUptime != null ? `${latestUptime.toFixed(1)}%` : `${availability}%`}
              </span>
              <span className="uc-avail-label">availability</span>
            </div>
          )}
        </div>
      </div>

      {chartData.length > 0 ? (
        <div className="uc-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
              <defs>
                <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={uptimeColor} stopOpacity={0.2} />
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
                name="Uptime"
                stroke={uptimeColor}
                strokeWidth={2}
                fill="url(#uptimeGrad)"
                dot={{ r: 3, fill: uptimeColor, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: uptimeColor, stroke: 'var(--color-vemio-bg)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="uc-empty">
          <p className="uc-empty-title">No uptime data yet</p>
          <p className="uc-empty-sub">Status history builds as devices report in</p>
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

        .uc-header-right {
          flex-shrink: 0;
          text-align: right;
        }

        .uc-avail {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }

        .uc-avail-pct {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        .uc-avail-label {
          font-size: 9px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .uc-chart-wrap {
          flex: 1;
          min-height: 180px;
        }

        .uc-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          min-height: 180px;
        }

        .uc-empty-title {
          font-size: 13px;
          color: var(--color-vemio-text-muted);
          margin: 0;
        }

        .uc-empty-sub {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 0;
        }

        @media (max-width: 767px) {
          .uc-chart-wrap, .uc-empty { min-height: 160px; }
        }
      `}</style>
    </div>
  );
}