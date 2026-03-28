// ══════════════════════════════════════════════════════════════
// Device Detail Page — app/(dashboard)/devices/[id]/page.jsx
//
// INTEGRATION CHANGE: Added DevicePortsSection between
// IP Interfaces panel and Lifecycle panel.
//
// To integrate into your existing file, add:
// 1. Import at top: import DevicePortsSection from '@/app/components/device-stencils/DevicePortsSection';
// 2. After the IP Interfaces panel (the {hasMultipleIPs && ...} block),
//    add the following JSX:
//
//    {/* ── Ports & Interfaces Stencil ── */}
//    <DevicePortsSection
//      deviceId={device.id || id}
//      device={{
//        make: device.make,
//        model: device.model,
//        type: device.type,
//        name: device.name,
//        status: device.status,
//      }}
//    />
//
// That's it — the component is fully self-contained,
// handles its own data fetching, loading states, and errors.
// ══════════════════════════════════════════════════════════════

// FULL FILE BELOW (copy-paste replacement for your existing [id]/page.jsx)

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, AlertTriangle, Shield, Archive, RotateCcw, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import DevicePortsSection from '@/app/components/device-stencils/DevicePortsSection';

const STATUS_CONFIG = {
  up:       { label: 'Online',   color: 'var(--color-status-up)',       bg: 'rgba(34,197,94,0.1)'  },
  down:     { label: 'Offline',  color: 'var(--color-status-down)',     bg: 'rgba(239,68,68,0.1)'  },
  degraded: { label: 'Degraded', color: 'var(--color-status-degraded)', bg: 'rgba(245,158,11,0.1)' },
  unknown:  { label: 'Unknown',  color: 'var(--color-status-unknown)',  bg: 'rgba(107,114,128,0.1)'},
};

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr, daysThreshold = 90) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diff = (d - now) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= daysThreshold;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function DeviceDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [data, setData]             = useState(null);
  const [days, setDays]             = useState(30);
  const [loading, setLoading]       = useState(true);
  const [retiring, setRetiring]     = useState(false);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [showAllIPs, setShowAllIPs] = useState(false);

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

  const device     = data?.device;
  const interfaces = data?.interfaces || [];
  const uptime     = data?.uptime;
  const history    = data?.history || [];
  const statusCfg  = device ? (STATUS_CONFIG[device.status] || STATUS_CONFIG.unknown) : null;

  /* ── Retire / Reactivate handler ── */
  const handleRetireToggle = async () => {
    if (!device) return;
    const newRetired = !device.isRetired;

    if (newRetired && !showRetireConfirm) {
      setShowRetireConfirm(true);
      return;
    }

    setRetiring(true);
    setShowRetireConfirm(false);
    try {
      const res = await fetch(`/api/devices/${id}/retire`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retired: newRetired }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(prev => ({
        ...prev,
        device: { ...prev.device, isRetired: result.isRetired },
      }));
    } catch (err) {
      console.error('Failed to update device:', err);
    } finally {
      setRetiring(false);
    }
  };

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

  const infoCards = [
    { label: 'IP Address',      value: device.ipAddress || '—', mono: true },
    { label: 'Manufacturer',    value: device.make      || '—' },
    { label: 'Model',           value: device.model     || '—' },
    { label: 'Serial Number',   value: device.serialNumber || '—', mono: true },
    { label: 'Firmware',        value: device.firmwareVersion || '—', mono: true },
    { label: 'Status Since',    value: device.lastSeenAt
        ? new Date(device.lastSeenAt).toLocaleString('en-IN') : '—' },
  ];

  const hasLifecycle = device.eolDate || device.warrantyExpiry;
  const primaryIP = interfaces.find(i => i.isPrimary);
  const otherIPs = interfaces.filter(i => !i.isPrimary);
  const hasMultipleIPs = interfaces.length > 1;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="dd-root"
      >
        {/* ── Retired banner ── */}
        {device.isRetired && (
          <div className="dd-retired-banner">
            <Archive className="w-4 h-4" />
            <span>This device is retired and hidden from all dashboards, topology, alerts, and BCS calculations.</span>
          </div>
        )}

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
            <h1 className="dd-title">
              {device.name}
              {device.isRetired && <span className="dd-retired-tag">Retired</span>}
            </h1>
            <div className="dd-badges">
              <span className="dd-status-badge" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                <span className="dd-status-dot" style={{ background: statusCfg.color }} />
                {statusCfg.label}
              </span>
              <span className="dd-meta-chip">{device.type?.replace('_', ' ')}</span>
              {device.siteName && (
                <span className="dd-meta-chip">{device.siteName}</span>
              )}
              {device.isCritical && (
                <span className="dd-meta-chip dd-meta-chip--critical">
                  <Shield className="w-3 h-3" /> Critical
                </span>
              )}
              {hasMultipleIPs && (
                <span className="dd-meta-chip dd-meta-chip--ips">
                  <Globe className="w-3 h-3" /> {interfaces.length} IPs
                </span>
              )}
            </div>
          </div>

          <div className="dd-header-actions">
            <button
              onClick={handleRetireToggle}
              disabled={retiring}
              className={`dd-retire-btn ${device.isRetired ? 'dd-retire-btn--reactivate' : ''}`}
              title={device.isRetired ? 'Reactivate this device' : 'Retire this device'}
            >
              {retiring ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : device.isRetired ? (
                <RotateCcw className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span className="dd-retire-label">
                {retiring ? 'Updating…' : device.isRetired ? 'Reactivate' : 'Retire'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Retire confirmation ── */}
        <AnimatePresence>
          {showRetireConfirm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="dd-retire-confirm"
            >
              <div className="dd-retire-confirm-inner">
                <div className="dd-retire-confirm-text">
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--color-vemio-amber)', flexShrink: 0 }} />
                  <div>
                    <p className="dd-retire-confirm-title">Retire {device.name}?</p>
                    <p className="dd-retire-confirm-desc">
                      This device will be hidden from Device Health, Topology, Alerts, Overview stats,
                      and BCS calculations. You can reactivate it at any time.
                    </p>
                  </div>
                </div>
                <div className="dd-retire-confirm-actions">
                  <button onClick={() => setShowRetireConfirm(false)} className="dd-retire-cancel-btn">Cancel</button>
                  <button onClick={handleRetireToggle} disabled={retiring} className="dd-retire-confirm-btn">
                    {retiring ? 'Retiring…' : 'Yes, Retire'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Description ── */}
        {device.description && (
          <div className="dd-description">
            <p className="dd-description-label">Description</p>
            <p className="dd-description-text">{device.description}</p>
          </div>
        )}

        {/* ── Info cards ── */}
        <div className="dd-info-grid">
          {infoCards.map(item => (
            <div key={item.label} className="dd-info-card">
              <p className="dd-info-label">{item.label}</p>
              <p className={`dd-info-value ${item.mono ? 'dd-info-value--mono' : ''}`}>
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── IP Interfaces panel ── */}
        {hasMultipleIPs && (
          <div className="dd-panel dd-interfaces-panel">
            <button
              className="dd-interfaces-header"
              onClick={() => setShowAllIPs(prev => !prev)}
            >
              <div className="dd-interfaces-header-left">
                <h3 className="dd-panel-title">IP Addresses</h3>
                <p className="dd-panel-sub">
                  {interfaces.length} addresses assigned to this device
                </p>
              </div>
              <div className="dd-interfaces-toggle">
                {showAllIPs ? (
                  <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
                ) : (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
                )}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {showAllIPs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="dd-interfaces-body"
                >
                  <div className="dd-interfaces-list">
                    {interfaces.map((iface, idx) => (
                      <div key={idx} className={`dd-iface-row ${iface.isPrimary ? 'dd-iface-row--primary' : ''}`}>
                        <span className="dd-iface-ip">{iface.ipAddress}</span>
                        <div className="dd-iface-meta">
                          {iface.isPrimary && (
                            <span className="dd-iface-badge dd-iface-badge--primary">Primary</span>
                          )}
                          {iface.interfaceName && (
                            <span className="dd-iface-badge">{iface.interfaceName}</span>
                          )}
                          {iface.vlanId && (
                            <span className="dd-iface-badge">VLAN {iface.vlanId}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── NEW: Ports & Interfaces Stencil ──              */}
        {/* ═══════════════════════════════════════════════════ */}
        <DevicePortsSection
          deviceId={device.id || id}
          device={{
            make: device.make,
            model: device.model,
            type: device.type,
            name: device.name,
            status: device.status,
          }}
        />

        {/* ── Lifecycle panel ── */}
        {hasLifecycle && (
          <div className="dd-lifecycle-row">
            {device.eolDate && (
              <div className={`dd-lifecycle-card ${
                isExpired(device.eolDate) ? 'dd-lifecycle-card--expired' :
                isExpiringSoon(device.eolDate) ? 'dd-lifecycle-card--warning' : ''
              }`}>
                <p className="dd-lifecycle-label">End of Life</p>
                <p className="dd-lifecycle-value">{formatDate(device.eolDate)}</p>
                {isExpired(device.eolDate) && (
                  <p className="dd-lifecycle-tag dd-lifecycle-tag--expired">
                    <AlertTriangle className="w-3 h-3" /> Past EOL
                  </p>
                )}
                {isExpiringSoon(device.eolDate) && (
                  <p className="dd-lifecycle-tag dd-lifecycle-tag--warning">
                    <AlertTriangle className="w-3 h-3" /> EOL approaching
                  </p>
                )}
              </div>
            )}
            {device.warrantyExpiry && (
              <div className={`dd-lifecycle-card ${
                isExpired(device.warrantyExpiry) ? 'dd-lifecycle-card--expired' :
                isExpiringSoon(device.warrantyExpiry) ? 'dd-lifecycle-card--warning' : ''
              }`}>
                <p className="dd-lifecycle-label">Warranty Expiry</p>
                <p className="dd-lifecycle-value">{formatDate(device.warrantyExpiry)}</p>
                {isExpired(device.warrantyExpiry) && (
                  <p className="dd-lifecycle-tag dd-lifecycle-tag--expired">
                    <AlertTriangle className="w-3 h-3" /> Warranty expired
                  </p>
                )}
                {isExpiringSoon(device.warrantyExpiry) && (
                  <p className="dd-lifecycle-tag dd-lifecycle-tag--warning">
                    <AlertTriangle className="w-3 h-3" /> Expiring soon
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Uptime panel ── */}
        <div className="dd-panel">
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

        .dd-retired-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(107, 114, 128, 0.08);
          border: 1px solid rgba(107, 114, 128, 0.2);
          color: var(--color-vemio-text-muted);
          font-size: 13px;
          line-height: 1.4;
        }

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

        .dd-header-body { min-width: 0; flex: 1; }

        .dd-header-actions {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 3px;
        }

        .dd-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
          line-height: 1.2;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        @media (max-width: 479px) { .dd-title { font-size: 16px; } }

        .dd-retired-tag {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 2px 7px;
          border-radius: 4px;
          background: rgba(107, 114, 128, 0.15);
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
        }

        .dd-badges { display: flex; align-items: center; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
        .dd-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; }
        .dd-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dd-meta-chip { font-size: 11px; color: var(--color-vemio-text-dim); background: var(--color-vemio-surface-raised); padding: 2px 8px; border-radius: 6px; text-transform: capitalize; display: inline-flex; align-items: center; gap: 4px; }
        .dd-meta-chip--critical { color: var(--color-severity-high); background: rgba(249, 115, 22, 0.08); border: 1px solid rgba(249, 115, 22, 0.15); }
        .dd-meta-chip--ips { color: var(--color-vemio-amber); background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.12); text-transform: none; }

        .dd-retire-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; border: 1px solid rgba(107, 114, 128, 0.25); background: var(--color-vemio-surface); color: var(--color-vemio-text-dim); transition: background 0.15s, color 0.15s, border-color 0.15s; }
        .dd-retire-btn:hover:not(:disabled) { background: rgba(239, 68, 68, 0.06); border-color: rgba(239, 68, 68, 0.25); color: var(--color-status-down); }
        .dd-retire-btn--reactivate:hover:not(:disabled) { background: rgba(34, 197, 94, 0.06); border-color: rgba(34, 197, 94, 0.25); color: var(--color-status-up); }
        .dd-retire-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 479px) { .dd-retire-label { display: none; } .dd-retire-btn { padding: 7px 8px; } }

        .dd-retire-confirm { overflow: hidden; }
        .dd-retire-confirm-inner { padding: 16px; border-radius: 12px; background: rgba(245, 158, 11, 0.04); border: 1px solid rgba(245, 158, 11, 0.15); display: flex; flex-direction: column; gap: 14px; }
        .dd-retire-confirm-text { display: flex; gap: 10px; align-items: flex-start; }
        .dd-retire-confirm-title { font-size: 13px; font-weight: 600; color: var(--color-vemio-text); margin: 0; }
        .dd-retire-confirm-desc { font-size: 12px; color: var(--color-vemio-text-muted); margin: 4px 0 0; line-height: 1.5; }
        .dd-retire-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .dd-retire-cancel-btn { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid var(--color-vemio-border); background: var(--color-vemio-surface); color: var(--color-vemio-text-muted); transition: background 0.15s; }
        .dd-retire-cancel-btn:hover { background: var(--color-vemio-surface-raised); }
        .dd-retire-confirm-btn { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; background: rgba(239, 68, 68, 0.12); color: var(--color-status-down); transition: background 0.15s; }
        .dd-retire-confirm-btn:hover { background: rgba(239, 68, 68, 0.2); }
        .dd-retire-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .dd-description { border-radius: 12px; padding: 14px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); }
        .dd-description-label { font-size: 10px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.07em; margin: 0; }
        .dd-description-text { font-size: 13px; color: var(--color-vemio-text-muted); margin: 6px 0 0; line-height: 1.5; }

        .dd-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 767px) { .dd-info-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 479px) { .dd-info-grid { gap: 8px; } }
        .dd-info-card { border-radius: 12px; padding: 14px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); }
        .dd-info-label { font-size: 10px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.07em; margin: 0; }
        .dd-info-value { font-size: 13px; font-weight: 500; color: var(--vemio-text); margin: 4px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dd-info-value--mono { font-family: var(--font-mono); font-size: 12px; }

        .dd-interfaces-panel { padding: 0; }
        .dd-interfaces-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; cursor: pointer; border: none; background: transparent; width: 100%; text-align: left; color: inherit; transition: background 0.12s; border-radius: 16px; }
        .dd-interfaces-header:hover { background: rgba(255, 255, 255, 0.02); }
        .dd-interfaces-header-left { min-width: 0; }
        .dd-interfaces-toggle { flex-shrink: 0; }
        .dd-interfaces-body { overflow: hidden; }
        .dd-interfaces-list { padding: 0 20px 16px; display: flex; flex-direction: column; gap: 4px; max-height: 400px; overflow-y: auto; }
        .dd-iface-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border-radius: 8px; transition: background 0.12s; }
        .dd-iface-row:hover { background: rgba(255, 255, 255, 0.03); }
        .dd-iface-row--primary { background: rgba(245, 158, 11, 0.03); }
        .dd-iface-row--primary:hover { background: rgba(245, 158, 11, 0.06); }
        .dd-iface-ip { font-family: var(--font-mono); font-size: 12px; color: var(--color-vemio-text); font-weight: 500; flex-shrink: 0; }
        .dd-iface-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .dd-iface-badge { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 4px; background: rgba(148, 163, 184, 0.1); color: var(--color-vemio-text-dim); }
        .dd-iface-badge--primary { background: rgba(245, 158, 11, 0.12); color: var(--color-vemio-amber); }
        @media (max-width: 479px) { .dd-interfaces-header { padding: 12px 14px; } .dd-interfaces-list { padding: 0 14px 12px; } .dd-iface-row { flex-direction: column; align-items: flex-start; gap: 4px; } .dd-iface-meta { justify-content: flex-start; } }

        .dd-lifecycle-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (max-width: 479px) { .dd-lifecycle-row { grid-template-columns: 1fr; } }
        .dd-lifecycle-card { border-radius: 12px; padding: 16px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); }
        .dd-lifecycle-card--expired { background: rgba(239, 68, 68, 0.04); border-color: rgba(239, 68, 68, 0.15); }
        .dd-lifecycle-card--warning { background: rgba(245, 158, 11, 0.04); border-color: rgba(245, 158, 11, 0.15); }
        .dd-lifecycle-label { font-size: 10px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.07em; margin: 0; }
        .dd-lifecycle-value { font-size: 16px; font-weight: 600; color: var(--color-vemio-text); margin: 6px 0 0; }
        .dd-lifecycle-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; margin: 8px 0 0; padding: 2px 8px; border-radius: 6px; }
        .dd-lifecycle-tag--expired { color: var(--color-severity-high); background: rgba(239, 68, 68, 0.08); }
        .dd-lifecycle-tag--warning { color: var(--color-vemio-amber); background: rgba(245, 158, 11, 0.08); }

        .dd-panel { border-radius: 16px; padding: 20px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); }
        @media (max-width: 479px) { .dd-panel { padding: 14px; } }
        .dd-panel-title { font-size: 13px; font-weight: 600; color: var(--vemio-text); margin: 0; }
        .dd-panel-sub { font-size: 11px; color: var(--color-vemio-text-dim); margin: 3px 0 0; }

        .dd-uptime-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .dd-uptime-header-left { min-width: 0; }
        .dd-uptime-header-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        @media (max-width: 479px) { .dd-uptime-header { flex-direction: column; gap: 10px; } .dd-uptime-header-right { align-self: flex-start; } }
        .dd-uptime-pct { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .dd-range-btns { display: flex; gap: 2px; }
        .dd-range-btn { padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s, color 0.15s; min-height: 30px; }

        .dd-empty-chart { display: flex; align-items: center; justify-content: center; height: 200px; font-size: 13px; color: var(--color-vemio-text-dim); }
        .dd-tooltip { border-radius: 8px; padding: 8px 12px; font-size: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background: var(--color-vemio-surface-raised); border: 1px solid var(--color-vemio-border); }

        .dd-log { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow-y: auto; }
        .dd-log-row { display: flex; align-items: center; gap: 10px; padding: 7px 12px; border-radius: 8px; transition: background 0.12s; flex-wrap: wrap; }
        .dd-log-row:hover { background: var(--color-vemio-surface-raised); }
        .dd-log-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .dd-log-status { font-size: 12px; font-weight: 500; min-width: 52px; }
        .dd-log-time { font-size: 11px; color: var(--color-vemio-text-dim); margin-left: auto; }
        .dd-log-source { font-size: 10px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
        @media (max-width: 479px) { .dd-log-time { margin-left: 0; } .dd-log-source { display: none; } }
      `}</style>
    </>
  );
}