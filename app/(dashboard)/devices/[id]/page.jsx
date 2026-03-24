'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, ExternalLink } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const STATUS_CONFIG = {
  up: { label: 'Online', color: 'var(--color-status-up)', bg: 'rgba(34,197,94,0.1)' },
  down: { label: 'Offline', color: 'var(--color-status-down)', bg: 'rgba(239,68,68,0.1)' },
  degraded: { label: 'Degraded', color: 'var(--color-status-degraded)', bg: 'rgba(245,158,11,0.1)' },
  unknown: { label: 'Unknown', color: 'var(--color-status-unknown)', bg: 'rgba(107,114,128,0.1)' },
};

export default function DeviceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch_data() {
      setLoading(true);
      try {
        const res = await fetch(`/api/devices/${id}/history?days=${days}`);
        if (res.status === 404) { router.push('/devices'); return; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch_data();
  }, [id, days, router]);

  const device = data?.device;
  const uptime = data?.uptime;
  const history = data?.history || [];
  const statusCfg = device ? (STATUS_CONFIG[device.status] || STATUS_CONFIG.unknown) : null;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  if (!device) return null;

  // Build timeline data for the chart
  const timelineData = history.map((h, i) => ({
    time: new Date(h.changedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    value: h.status === 'up' ? 1 : h.status === 'degraded' ? 0.5 : 0,
    status: h.status,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Back + header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => router.push('/devices')}
            className="mt-1 p-2 rounded-lg hover:bg-vemio-surface-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-vemio-text-muted" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-vemio-text">{device.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                style={{ background: statusCfg.bg, color: statusCfg.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.color }} />
                {statusCfg.label}
              </span>
              <span className="text-xs text-vemio-text-dim">{device.type?.replace('_', ' ')}</span>
              {device.siteName && (
                <>
                  <span className="text-xs text-vemio-text-dim">·</span>
                  <span className="text-xs text-vemio-text-dim">{device.siteName}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Device info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'IP Address', value: device.ipAddress || '—', mono: true },
          { label: 'Manufacturer', value: device.make || '—' },
          { label: 'Model', value: device.model || '—' },
          { label: 'Last Seen', value: device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('en-IN') : '—' },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-4"
            style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}
          >
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider">{item.label}</p>
            <p className={`text-sm font-medium text-vemio-text mt-1 ${item.mono ? 'font-mono' : ''}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Uptime summary */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-vemio-text">Uptime History</h3>
            <p className="text-xs text-vemio-text-dim mt-0.5">
              {uptime?.totalEvents || 0} status changes in the last {days} days
            </p>
          </div>
          <div className="flex items-center gap-4">
            {uptime?.percent !== null && (
              <span className="text-lg font-bold tabular-nums" style={{ color: uptime.percent >= 99 ? 'var(--color-status-up)' : uptime.percent >= 95 ? 'var(--color-status-degraded)' : 'var(--color-status-down)' }}>
                {uptime.percent}%
              </span>
            )}
            <div className="flex gap-1">
              {[7, 30, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: days === d ? 'var(--color-vemio-amber-soft)' : 'transparent',
                    color: days === d ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>

        {timelineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timelineData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
              <defs>
                <linearGradient id="statusGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-vemio-border)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: 'var(--color-vemio-text-dim)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 1]}
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown;
                  return (
                    <div className="rounded-lg px-3 py-2 text-xs shadow-lg"
                      style={{ background: 'var(--color-vemio-surface-raised)', border: '1px solid var(--color-vemio-border)' }}>
                      <p className="text-vemio-text-muted">{d.time}</p>
                      <p className="font-semibold mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke="#14b8a6"
                strokeWidth={2}
                fill="url(#statusGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-sm text-vemio-text-dim">
            No status history recorded yet
          </div>
        )}
      </div>

      {/* Status change log */}
      {history.length > 0 && (
        <div
          className="rounded-2xl p-6"
          style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}
        >
          <h3 className="text-sm font-semibold text-vemio-text mb-4">Status Change Log</h3>
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {[...history].reverse().slice(0, 50).map((entry, i) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.unknown;
              return (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-vemio-surface-hover">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                  <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                  <span className="text-xs text-vemio-text-dim ml-auto font-mono">
                    {new Date(entry.changedAt).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-vemio-text-dim uppercase">{entry.source}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}
