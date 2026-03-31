/**
 * VEMIO™ — Interface Bandwidth Chart
 * app/components/InterfaceBandwidthChart.jsx
 *
 * Displays TX/RX bandwidth for a device's WAN interfaces.
 * Uses Recharts AreaChart with dual-axis (TX up, RX down mirrored).
 * Period toggle: 24H / 7D
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useTenantFetch } from '@/hooks/useTenantFetch';

// ── Helpers ──
function formatBps(bps) {
  if (bps == null) return '—';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps} bps`;
}

function formatTime(isoStr, period) {
  const d = new Date(isoStr);
  if (period === '7d') {
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Color palette for multiple interfaces
const IFACE_COLORS = [
  { tx: '#10B981', rx: '#3B82F6', name: 'Emerald/Blue' },
  { tx: '#F59E0B', rx: '#8B5CF6', name: 'Amber/Purple' },
  { tx: '#EF4444', rx: '#06B6D4', name: 'Red/Cyan' },
  { tx: '#EC4899', rx: '#14B8A6', name: 'Pink/Teal' },
];

export default function InterfaceBandwidthChart({ deviceId }) {
  const [period, setPeriod] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const tenantFetch = useTenantFetch();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ifaceParam = showAll ? 'all' : 'wan';
      const res = await tenantFetch(
        `/api/devices/${deviceId}/interfaces/stats?period=${period}&interfaces=${ifaceParam}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch interface stats:', err);
    } finally {
      setLoading(false);
    }
  }, [deviceId, period, showAll, tenantFetch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 bg-[var(--color-border)] rounded" />
          <div className="h-64 bg-[var(--color-border)] rounded" />
        </div>
      </div>
    );
  }

  if (!data || !data.interfaces?.length) {
    return (
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Interface Bandwidth</h3>
          <div className="flex gap-1">
            {['wan', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setShowAll(f === 'all')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                  (showAll ? 'all' : 'wan') === f
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'
                }`}
              >
                {f === 'wan' ? 'WAN Only' : 'All Interfaces'}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          {showAll
            ? 'No bandwidth data available for this device.'
            : 'No WAN ports flagged. Tag ports as WAN in the Ports tab to see bandwidth here, or switch to "All Interfaces".'}
        </p>
      </div>
    );
  }

  // Merge all interfaces into a unified time-series for the chart
  // Each data point: { time, iface1_tx, iface1_rx, iface2_tx, ... }
  const timeMap = new Map();
  data.interfaces.forEach((iface, idx) => {
    iface.data.forEach(dp => {
      const t = dp.recordedAt;
      if (!timeMap.has(t)) timeMap.set(t, { time: t });
      const entry = timeMap.get(t);
      entry[`tx_${idx}`] = dp.txBps;
      entry[`rx_${idx}`] = dp.rxBps;
    });
  });

  const chartData = Array.from(timeMap.values()).sort((a, b) =>
    new Date(a.time) - new Date(b.time)
  );

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-[var(--color-text)]">Interface Bandwidth</h3>
          {/* Current values */}
          {data.current?.map((c, i) => (
            <div key={c.interfaceAuvikId} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-secondary)]">{c.interfaceName}:</span>
              <span className="text-emerald-500 font-medium">↑{formatBps(c.txBps)}</span>
              <span className="text-blue-500 font-medium">↓{formatBps(c.rxBps)}</span>
              {c.utilizationPct !== null && (
                <span className={`font-medium ${
                  c.utilizationPct > 85 ? 'text-red-500' :
                  c.utilizationPct > 70 ? 'text-amber-500' :
                  'text-[var(--color-text-secondary)]'
                }`}>
                  ({c.utilizationPct.toFixed(1)}%)
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-1">
          {/* Interface filter */}
          {['wan', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setShowAll(f === 'all')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                (showAll ? 'all' : 'wan') === f
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'
              }`}
            >
              {f === 'wan' ? 'WAN' : 'All'}
            </button>
          ))}
          <span className="mx-1" />
          {/* Period toggle */}
          {['24h', '7d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                period === p
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            {data.interfaces.map((iface, idx) => {
              const colors = IFACE_COLORS[idx % IFACE_COLORS.length];
              return (
                <g key={idx}>
                  <linearGradient id={`txGrad_${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.tx} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.tx} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id={`rxGrad_${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.rx} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.rx} stopOpacity={0.05} />
                  </linearGradient>
                </g>
              );
            })}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />
          <XAxis
            dataKey="time"
            tickFormatter={(v) => formatTime(v, period)}
            stroke="var(--color-text-secondary)"
            fontSize={11}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tickFormatter={formatBps}
            stroke="var(--color-text-secondary)"
            fontSize={11}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelFormatter={(v) => formatTime(v, period)}
            formatter={(value, name) => {
              const label = name.startsWith('tx_') ? '↑ TX' : '↓ RX';
              const ifaceIdx = parseInt(name.split('_')[1]);
              const ifaceName = data.interfaces[ifaceIdx]?.interfaceName || '';
              return [formatBps(value), `${ifaceName} ${label}`];
            }}
          />
          {data.interfaces.length > 1 && <Legend />}
          {data.interfaces.map((iface, idx) => {
            const colors = IFACE_COLORS[idx % IFACE_COLORS.length];
            return (
              <g key={idx}>
                <Area
                  type="monotone"
                  dataKey={`tx_${idx}`}
                  name={`tx_${idx}`}
                  stroke={colors.tx}
                  strokeWidth={1.5}
                  fill={`url(#txGrad_${idx})`}
                  dot={false}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={`rx_${idx}`}
                  name={`rx_${idx}`}
                  stroke={colors.rx}
                  strokeWidth={1.5}
                  fill={`url(#rxGrad_${idx})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </g>
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      {/* WAN port legend */}
      {data.wanPorts?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
          {data.wanPorts.map(p => (
            <span key={p.interfaceAuvikId}>
              <span className="font-medium text-[var(--color-text)]">{p.interfaceName}</span>
              {' '}{formatBps(p.negotiatedSpeed)} line
            </span>
          ))}
        </div>
      )}
    </div>
  );
}