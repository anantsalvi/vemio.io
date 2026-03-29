'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Info } from 'lucide-react';
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
  const formattedDate = label
    ? new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <div className="uc-tip">
      <p className="uc-tip-date">{formattedDate}</p>
      <p className="uc-tip-val" style={{ color: payload[0].stroke }}>
        {payload[0].value != null ? payload[0].value.toFixed(1) : '\u2014'}% uptime
      </p>
      <style>{`
        .uc-tip { border-radius: 8px; padding: 8px 12px; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: var(--color-vemio-surface-raised); border: 1px solid var(--color-vemio-border); }
        .uc-tip-date { color: var(--color-vemio-text-muted); margin: 0; }
        .uc-tip-val { font-weight: 600; margin: 3px 0 0; }
      `}</style>
    </div>
  );
}

export default function UptimeChart({ data, devices }) {
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  const chartData = data || [];

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

  return (
    <div
      className="uc-card"
      onClick={() => router.push('/availability')}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push('/availability'); } }}
    >
      <div className="uc-header">
        <div className="uc-header-left">
          <h3 className="uc-title">Uptime Trend</h3>
          <button className="uc-info-btn" onClick={(e) => { e.stopPropagation(); setShowInfo(p => !p); }} title="What is this?">
            <Info size={10} />
          </button>
          <p className="uc-sub">Last 7 days · all sites</p>
        </div>
        {latestUptime != null && (
          <div className="uc-pct-wrap">
            <span className="uc-pct" style={{ color: uptimeColor }}>
              {latestUptime.toFixed(1)}%
            </span>
            <span className="uc-pct-label">availability</span>
          </div>
        )}
      </div>

      {showInfo && (
        <div className="uc-info-box" onClick={(e) => e.stopPropagation()}>
          Daily uptime percentage over the last 7 days, calculated from device status change events. Each data point represents the ratio of "up" events to total status events for that day. Click to see full availability breakdown.
        </div>
      )}

      {chartData.length > 0 ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={uptimeColor} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={uptimeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-vemio-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--color-vemio-text-dim)' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              />
              <YAxis
                domain={yDomain}
                tick={{ fontSize: 11, fill: 'var(--color-vemio-text-dim)' }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone" dataKey="uptime" name="Uptime"
                stroke={uptimeColor} strokeWidth={2} fill="url(#uptimeGrad)"
                dot={{ r: 3, fill: uptimeColor, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: uptimeColor, stroke: 'var(--color-vemio-bg)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="uc-empty">No uptime data yet — status history builds over time</div>
      )}

      <style>{`
        .uc-card {
          border-radius: 16px;
          padding: 20px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          height: 340px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .uc-card:hover {
          border-color: var(--color-vemio-text-dim);
        }
        .uc-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          flex-shrink: 0;
        }
        .uc-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .uc-title { font-size: 13px; font-weight: 600; color: var(--vemio-text); margin: 0; white-space: nowrap; }
        .uc-sub { font-size: 11px; color: var(--color-vemio-text-dim); margin: 0; width: 100%; }
        .uc-info-btn {
          display: flex; align-items: center; justify-content: center;
          width: 16px; height: 16px; border-radius: 50%;
          border: 1px solid var(--color-vemio-border); background: transparent;
          color: var(--color-vemio-text-dim); cursor: pointer; padding: 0;
          transition: color 0.15s, border-color 0.15s; flex-shrink: 0;
        }
        .uc-info-btn:hover { color: var(--color-vemio-text-muted); border-color: var(--color-vemio-text-muted); }
        .uc-info-box {
          font-size: 11px; line-height: 1.5; color: var(--color-vemio-text-muted);
          background: var(--color-vemio-surface-raised); border: 1px solid var(--color-vemio-border);
          border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; flex-shrink: 0;
        }
        .uc-pct-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
        .uc-pct { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
        .uc-pct-label { font-size: 9px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
        .uc-empty {
          flex: 1; display: flex; align-items: center; justify-content: center;
          font-size: 13px; color: var(--color-vemio-text-dim);
        }
        @media (max-width: 767px) {
          .uc-card { height: auto; min-height: 300px; }
        }
      `}</style>
    </div>
  );
}