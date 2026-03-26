'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const STATUS_CONFIG = {
  up:       { label: 'Online',   color: 'var(--color-status-up)',       bg: 'rgba(34,197,94,0.1)'  },
  down:     { label: 'Offline',  color: 'var(--color-status-down)',     bg: 'rgba(239,68,68,0.1)'  },
  degraded: { label: 'Degraded', color: 'var(--color-status-degraded)', bg: 'rgba(245,158,11,0.1)' },
  unknown:  { label: 'Unknown',  color: 'var(--color-status-unknown)',  bg: 'rgba(107,114,128,0.1)'},
};

export default function DeviceDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [data, setData]     = useState(null);
  const [days, setDays]     = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
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
    fetchData();
  }, [id, days, router]);

  const device    = data?.device;
  const uptime    = data?.uptime;
  const history   = data?.history || [];
  const statusCfg = device ? (STATUS_CONFIG[device.status] || STATUS_CONFIG.unknown) : null;

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }
  if (!device) return null;

  const timelineData = history.map(h => ({
    time: new Date(h.changedAt).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }),
    value:  h.status === 'up' ? 1 : h.status === 'degraded' ? 0.5 : 0,
    status: h.status,
  }));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="dd-root"
      >
        {/* ── Back + header ── */}
        <div className="dd-header">
          <button
            onClick={() => router.push('/devices')}
            className="dd-back-btn"
            aria-label="Back to devices"
          >
            <ArrowLeft className="w-4 h-4 text-vemio-text-muted" />
          </button>

          <div className="dd-header-body">
            <h1 className="dd-title">{device.name}</h1>
            <div className="dd-badges">
              <span className="dd-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                <span className="dd-status-dot" style={{ background: statusCfg.color }} />
                {statusCfg.label}
              </span>
              <span className="dd-meta-chip">{device.type?.replace('_', ' ')}</span>
              {device.siteName && (
                <span className="dd-meta-chip">{device.siteName}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Info cards ── */}
        <div className="dd-info-grid">
          {[
            { label: 'IP Address',    value: device.ipAddress || '—', mono: true },
            { label: 'Manufacturer',  value: device.make      || '—' },
            { label: 'Model',         value: device.model     || '—' },
            { label: 'Last Seen',     value: device.lastSeenAt
                ? new Date(device.lastSeenAt).toLocaleString('en-IN') : '—' },
          ].map(item => (
            <div key={item.label} className="dd-info-card">
              <p className="dd-info-label">{item.label}</p>
              <p className={`dd-info-value ${item.mono ? 'dd-info-value--mono' : ''}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Uptime panel ── */}
        <div className="dd-panel">
          {/* Panel header — stacks on mobile */}
          <div className="dd-uptime-header">
            <div className="dd-uptime-header-left">
              <h3 className="dd-panel-title">Uptime History</h3>
              <p className="dd-panel-sub">
                {uptime?.totalEvents || 0} status changes in the last {days} days
              </p>
            </div>
            <div className="dd-uptime-header-right">
              {uptime?.percent != null && (
                <span
                  className="dd-uptime-pct"
                  style={{
                    color: uptime.percent >= 99
                      ? 'var(--color-status-up)'
                      : uptime.percent >= 95
                      ? 'var(--color-status-degraded)'
                      : 'var(--color-status-down)',
                  }}
                >
                  {uptime.percent}%
                </span>
              )}
              <div className="dd-range-btns">
                {[7, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className="dd-range-btn"
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
                    <stop offset="0%"   stopColor="#14b8a6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#14b8a6" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-vemio-border)" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-vemio-text-dim)' }}
                  axisLine={false} tickLine={false} />
                <YAxis domain={[0, 1]} tick={false} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown;
                    return (
                      <div className="dd-tooltip">
                        <p className="text-vemio-text-muted">{d.time}</p>
                        <p className="font-semibold mt-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                      </div>
                    );
                  }}
                />
                <Area type="stepAfter" dataKey="value" stroke="#14b8a6" strokeWidth={2}
                  fill="url(#statusGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="dd-empty-chart">No status history recorded yet</div>
          )}
        </div>

        {/* ── Status change log ── */}
        {history.length > 0 && (
          <div className="dd-panel">
            <h3 className="dd-panel-title" style={{ padding: '0 0 16px' }}>Status Change Log</h3>
            <div className="dd-log">
              {[...history].reverse().slice(0, 50).map((entry, i) => {
                const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.unknown;
                return (
                  <div key={i} className="dd-log-row">
                    <span className="dd-log-dot" style={{ background: cfg.color }} />
                    <span className="dd-log-status" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="dd-log-time font-mono">
                      {new Date(entry.changedAt).toLocaleString('en-IN')}
                    </span>
                    <span className="dd-log-source">{entry.source}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.div>

      <style>{`
        .dd-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }
        @media (max-width: 767px) { .dd-root { gap: 14px; } }

        /* ── Header ── */
        .dd-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .dd-back-btn {
          margin-top: 3px;
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface);
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: background 0.15s;
        }
        .dd-back-btn:hover { background: var(--color-vemio-surface-raised); }

        .dd-header-body { min-width: 0; }

        .dd-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 479px) { .dd-title { font-size: 16px; } }

        .dd-badges {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          flex-wrap: wrap;
        }
        .dd-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
        .dd-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dd-meta-chip {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          background: var(--color-vemio-surface-raised);
          padding: 2px 8px;
          border-radius: 6px;
          text-transform: capitalize;
        }

        /* ── Info grid: 4-col desktop, 2-col tablet/mobile ── */
        .dd-info-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 1023px) {
          .dd-info-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 479px) {
          .dd-info-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
        }

        .dd-info-card {
          border-radius: 12px;
          padding: 14px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .dd-info-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin: 0;
        }
        .dd-info-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--vemio-text);
          margin: 4px 0 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dd-info-value--mono { font-family: monospace; }

        /* ── Shared panel ── */
        .dd-panel {
          border-radius: 16px;
          padding: 20px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        @media (max-width: 479px) { .dd-panel { padding: 14px; } }

        .dd-panel-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
        }
        .dd-panel-sub {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 3px 0 0;
        }

        /* ── Uptime header: side-by-side on tablet+, stacked on mobile ── */
        .dd-uptime-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .dd-uptime-header-left { min-width: 0; }
        .dd-uptime-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        @media (max-width: 479px) {
          .dd-uptime-header { flex-direction: column; gap: 10px; }
          .dd-uptime-header-right { align-self: flex-start; }
        }

        .dd-uptime-pct {
          font-size: 18px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .dd-range-btns {
          display: flex;
          gap: 2px;
        }
        .dd-range-btn {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: background 0.15s, color 0.15s;
          min-height: 30px;
        }

        .dd-empty-chart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          font-size: 13px;
          color: var(--color-vemio-text-dim);
        }

        .dd-tooltip {
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
        }

        /* ── Log ── */
        .dd-log {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 300px;
          overflow-y: auto;
        }
        .dd-log-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 12px;
          border-radius: 8px;
          transition: background 0.12s;
          flex-wrap: wrap;          /* wraps timestamp on very small screens */
        }
        .dd-log-row:hover { background: var(--color-vemio-surface-raised); }
        .dd-log-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dd-log-status {
          font-size: 12px;
          font-weight: 500;
          min-width: 52px;
        }
        .dd-log-time {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin-left: auto;
        }
        .dd-log-source {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        @media (max-width: 479px) {
          .dd-log-time  { margin-left: 0; }
          .dd-log-source { display: none; }
        }
      `}</style>
    </>
  );
}