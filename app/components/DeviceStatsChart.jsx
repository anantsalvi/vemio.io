/**
 * VEMIO™ — Device Statistics Charts
 * app/components/DeviceStatsChart.jsx
 *
 * Displays CPU and memory utilization as line charts on the device detail page.
 * Uses Recharts. Fetches from /api/devices/[id]/stats.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cpu, MemoryStick, Activity } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

const PERIODS = [
  { key: '24h', label: '24H' },
  { key: '7d',  label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
];

const STAT_CONFIG = {
  cpu: {
    label: 'CPU',
    color: '#3B82F6',
    gradientId: 'statCpuGradient',
    icon: Cpu,
  },
  memory: {
    label: 'Memory',
    color: '#8B5CF6',
    gradientId: 'statMemGradient',
    icon: MemoryStick,
  },
};

function formatTime(timestamp, period) {
  const d = new Date(timestamp);
  if (period === '24h') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (period === '7d') {
    return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function CustomTooltip({ active, payload, label, period }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dsc-tooltip">
      <span className="dsc-tooltip-time">{formatTime(label, period)}</span>
      {payload.map((p) => (
        <div key={p.dataKey} className="dsc-tooltip-row">
          <span className="dsc-tooltip-dot" style={{ background: p.color }} />
          <span className="dsc-tooltip-label">{STAT_CONFIG[p.dataKey]?.label || p.dataKey}</span>
          <span className="dsc-tooltip-value">{p.value?.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export default function DeviceStatsChart({ deviceId }) {
  const [period, setPeriod] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/stats?period=${period}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError('Unable to load statistics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, period]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Merge CPU and memory into unified chart data
  const chartData = [];
  if (data?.stats) {
    const timeMap = new Map();
    for (const type of ['cpu', 'memory']) {
      const series = data.stats[type] || [];
      for (const point of series) {
        const key = point.time;
        if (!timeMap.has(key)) timeMap.set(key, { time: key });
        timeMap.get(key)[type] = point.value;
      }
    }
    // Sort by time
    chartData.push(...Array.from(timeMap.values()).sort((a, b) => new Date(a.time) - new Date(b.time)));
  }

  const hasCpu = data?.stats?.cpu?.length > 0;
  const hasMem = data?.stats?.memory?.length > 0;
  const hasData = hasCpu || hasMem;

  return (
    <div className="dsc-root">
      {/* Header */}
      <div className="dsc-header">
        <div className="dsc-header-left">
          <Activity className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
          <span className="dsc-title">Utilization</span>
        </div>

        {/* Current values */}
        {data?.current && (
          <div className="dsc-current">
            {data.current.cpu && (
              <span className="dsc-current-badge dsc-current-badge--cpu">
                <Cpu className="w-3 h-3" />
                {data.current.cpu.value.toFixed(1)}%
              </span>
            )}
            {data.current.memory && (
              <span className="dsc-current-badge dsc-current-badge--mem">
                <MemoryStick className="w-3 h-3" />
                {data.current.memory.value.toFixed(1)}%
              </span>
            )}
          </div>
        )}

        {/* Period toggle */}
        <div className="dsc-periods">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`dsc-period-btn ${period === p.key ? 'dsc-period-btn--active' : ''}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="dsc-chart-wrap">
        {loading && (
          <div className="dsc-loading">
            <div className="dsc-spinner" />
          </div>
        )}

        {!loading && error && (
          <div className="dsc-empty">{error}</div>
        )}

        {!loading && !error && !hasData && (
          <div className="dsc-empty">No utilization data available yet</div>
        )}

        {!loading && hasData && (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="statCpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="statMemGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis
                dataKey="time"
                tickFormatter={(t) => formatTime(t, period)}
                tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.4)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={60}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'rgba(148,163,184,0.4)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip period={period} />} />
              {hasCpu && (
                <Area
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3B82F6"
                  strokeWidth={1.5}
                  fill="url(#statCpuGradient)"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              )}
              {hasMem && (
                <Area
                  type="monotone"
                  dataKey="memory"
                  stroke="#8B5CF6"
                  strokeWidth={1.5}
                  fill="url(#statMemGradient)"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend */}
      {hasData && (
        <div className="dsc-legend">
          {hasCpu && (
            <span className="dsc-legend-item">
              <span className="dsc-legend-dot" style={{ background: '#3B82F6' }} />
              CPU
            </span>
          )}
          {hasMem && (
            <span className="dsc-legend-item">
              <span className="dsc-legend-dot" style={{ background: '#8B5CF6' }} />
              Memory
            </span>
          )}
        </div>
      )}

      <style>{`
        .dsc-root {
          border-radius: 12px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          overflow: hidden;
        }
        .dsc-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-vemio-border);
          flex-wrap: wrap;
        }
        .dsc-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dsc-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-vemio-text);
        }
        .dsc-current {
          display: flex;
          gap: 6px;
          margin-left: auto;
        }
        .dsc-current-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .dsc-current-badge--cpu {
          background: rgba(59, 130, 246, 0.1);
          color: #3B82F6;
        }
        .dsc-current-badge--mem {
          background: rgba(139, 92, 246, 0.1);
          color: #8B5CF6;
        }
        .dsc-periods {
          display: flex;
          gap: 2px;
          padding: 2px;
          border-radius: 8px;
          background: var(--color-vemio-bg);
        }
        .dsc-period-btn {
          padding: 4px 10px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--color-vemio-text-dim);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s, color 0.12s;
          font-family: inherit;
        }
        .dsc-period-btn:hover {
          color: var(--color-vemio-text-muted);
        }
        .dsc-period-btn--active {
          background: var(--color-vemio-surface);
          color: var(--color-vemio-amber);
          font-weight: 600;
        }
        .dsc-chart-wrap {
          padding: 12px 8px 4px;
          min-height: 200px;
          position: relative;
        }
        .dsc-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .dsc-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(148,163,184,0.15);
          border-top-color: var(--color-vemio-amber);
          border-radius: 50%;
          animation: dsc-spin 0.7s linear infinite;
        }
        @keyframes dsc-spin { to { transform: rotate(360deg); } }
        .dsc-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          font-size: 12px;
          color: var(--color-vemio-text-dim);
        }
        .dsc-legend {
          display: flex;
          gap: 12px;
          padding: 8px 16px 10px;
          border-top: 1px solid var(--color-vemio-border);
        }
        .dsc-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--color-vemio-text-muted);
        }
        .dsc-legend-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dsc-tooltip {
          background: var(--color-vemio-bg);
          border: 1px solid var(--color-vemio-border);
          border-radius: 8px;
          padding: 8px 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .dsc-tooltip-time {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          display: block;
          margin-bottom: 4px;
        }
        .dsc-tooltip-row {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
        }
        .dsc-tooltip-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dsc-tooltip-label {
          color: var(--color-vemio-text-muted);
        }
        .dsc-tooltip-value {
          font-weight: 600;
          color: var(--color-vemio-text);
          margin-left: auto;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}
