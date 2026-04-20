'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Activity, RefreshCw, ArrowUpRight, ArrowDownLeft, Shield, Radio,
  Search, ExternalLink,
} from 'lucide-react';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';

/* ── Helpers ── */
function formatBps(bps) {
  if (bps == null || bps === 0) return '0 bps';
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(1)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} Kbps`;
  return `${bps} bps`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const RANGE_OPTIONS = [
  { value: 1,   label: '1h'  },
  { value: 4,   label: '4h'  },
  { value: 24,  label: '24h' },
  { value: 168, label: '7d'  },
];

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function TrafficPage() {
  const router = useRouter();
  const { selectedTenantId, loading: tenantLoading } = useTenantSwitcher();

  // Device list state
  const [devices, setDevices] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Traffic data state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(4);
  const [selectedIface, setSelectedIface] = useState(null);

  // Fetch firewalls and routers
  const fetchDevices = useCallback(async () => {
    if (!selectedTenantId || tenantLoading) return;
    setDevicesLoading(true);
    try {
      const params = new URLSearchParams({
        tenantId: selectedTenantId,
        limit: '500',
        page: '1',
        category: 'network',
      });
      const res = await fetch(`/api/devices?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const eligible = (result.devices || []).filter(d =>
        ['firewall', 'router', 'switch', 'core_switch', 'access_switch'].includes(d.type)
      );
      setDevices(eligible);
      // Auto-select first device if none selected
      if (!selectedDeviceId && eligible.length > 0) {
        setSelectedDeviceId(eligible[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setDevicesLoading(false);
    }
  }, [selectedTenantId, tenantLoading]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // Fetch traffic data for selected device
  const fetchTraffic = useCallback(async () => {
    if (!selectedDeviceId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ hours: hours.toString() });
      if (selectedIface) params.set('interface', selectedIface);
      const res = await fetch(`/api/devices/${selectedDeviceId}/traffic?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      setData(result);
      if (!selectedIface && result.interfaces?.length > 0) {
        setSelectedIface(result.interfaces[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch traffic data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDeviceId, hours, selectedIface]);

  useEffect(() => { fetchTraffic(); }, [fetchTraffic]);

  // Reset interface selection when device changes
  useEffect(() => { setSelectedIface(null); setData(null); }, [selectedDeviceId]);

  // Derived data
  const interfaces = data?.interfaces || [];
  const timeSeries = data?.timeSeries || [];
  const latest = data?.latest || [];
  const device = data?.device;

  const selectedTimeSeries = timeSeries.find(ts => ts.id === selectedIface);
  const selectedLatest = latest.find(l => l.id === selectedIface);
  const selectedIfaceInfo = interfaces.find(i => i.id === selectedIface);

  const barData = interfaces.slice(0, 15).map(iface => ({
    name: iface.name.length > 20 ? iface.name.slice(0, 18) + '...' : iface.name,
    fullName: iface.name,
    id: iface.id,
    tx: iface.avgTxBps,
    rx: iface.avgRxBps,
    total: iface.avgTotalBps,
    peak: iface.peakTotalBps,
  }));

  const lineData = (selectedTimeSeries?.data || []).map(point => ({
    time: hours <= 24 ? formatTime(point.time) : formatDateTime(point.time),
    tx: point.txBps,
    rx: point.rxBps,
    total: point.totalBps,
  }));

  // Filter devices by search
  const filteredDevices = deviceSearch
    ? devices.filter(d =>
        d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
        (d.ipAddress && d.ipAddress.includes(deviceSearch))
      )
    : devices;

  // Aggregate stats across all interfaces
  const totalTx = latest.reduce((sum, l) => sum + (l.txBps || 0), 0);
  const totalRx = latest.reduce((sum, l) => sum + (l.rxBps || 0), 0);

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="tf-root"
      >
        {/* ── Header ── */}
        <motion.div variants={fadeUp} className="tf-header">
          <div>
            <h1 className="tf-title">
              <Activity className="tf-title-icon" />
              Traffic Analysis
            </h1>
            <p className="tf-subtitle">
              Real-time interface bandwidth for firewalls and routers
            </p>
          </div>
          <div className="tf-header-actions">
            <div className="tf-range-btns">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setHours(opt.value)}
                  className={`tf-range-btn ${hours === opt.value ? 'tf-range-btn--active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={fetchTraffic} className="tf-refresh-btn" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.div>

        <div className="tf-layout">
          {/* ── Device sidebar ── */}
          <motion.div variants={fadeUp} className="tf-sidebar">
            <div className="tf-sidebar-header">
              <h2 className="tf-sidebar-title">Devices</h2>
              <span className="tf-sidebar-count">{devices.length}</span>
            </div>

            {devices.length > 5 && (
              <div className="tf-sidebar-search-wrap">
                <Search className="tf-sidebar-search-icon" />
                <input
                  type="text"
                  placeholder="Filter devices..."
                  value={deviceSearch}
                  onChange={e => setDeviceSearch(e.target.value)}
                  className="tf-sidebar-search"
                />
              </div>
            )}

            <div className="tf-device-list">
              {devicesLoading ? (
                <div className="tf-device-empty">Loading devices...</div>
              ) : filteredDevices.length === 0 ? (
                <div className="tf-device-empty">
                  {devices.length === 0
                    ? 'No traffic-monitored devices found'
                    : 'No devices match your search'}
                </div>
              ) : (
                filteredDevices.map(d => {
                  const isSelected = d.id === selectedDeviceId;
                  const Icon = d.type === 'firewall' ? Shield : Radio;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setSelectedDeviceId(d.id)}
                      className={`tf-device-item ${isSelected ? 'tf-device-item--active' : ''}`}
                    >
                      <Icon className="tf-device-icon" />
                      <div className="tf-device-info">
                        <span className="tf-device-name">{d.name}</span>
                        <span className="tf-device-meta">
                          {d.type} {d.ipAddress ? `| ${d.ipAddress}` : ''}
                        </span>
                      </div>
                      <span className={`tf-device-status tf-device-status--${d.status}`} />
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>

          {/* ── Main content ── */}
          <div className="tf-main">
            {!selectedDeviceId ? (
              <motion.div variants={fadeUp} className="tf-empty-state">
                <Activity className="tf-empty-icon" />
                <h3>Select a device</h3>
                <p>Choose a firewall or router from the sidebar to view traffic analysis</p>
              </motion.div>
            ) : (
              <>
                {/* Device name bar */}
                {device && (
                  <motion.div variants={fadeUp} className="tf-device-bar">
                    <div className="tf-device-bar-left">
                      {device.type === 'firewall' ? (
                        <Shield className="tf-device-bar-icon" />
                      ) : (
                        <Radio className="tf-device-bar-icon" />
                      )}
                      <div>
                        <h2 className="tf-device-bar-name">{device.name}</h2>
                        <span className="tf-device-bar-meta">
                          {device.make} {device.model} | {device.ipAddress}
                        </span>
                      </div>
                    </div>
                    <button
                      className="tf-device-bar-link"
                      onClick={() => router.push(`/devices/${device.id}`)}
                      title="View device details"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Device Details
                    </button>
                  </motion.div>
                )}

                {/* Loading */}
                {loading && !data && (
                  <div className="tf-loading">
                    <RefreshCw className="tf-loading-icon" />
                    <span>Loading traffic data...</span>
                  </div>
                )}

                {/* No data */}
                {!loading && interfaces.length === 0 && data && (
                  <div className="tf-no-data">
                    No interface bandwidth data collected yet. Data appears after the stats collector runs.
                  </div>
                )}

                {interfaces.length > 0 && (
                  <>
                    {/* ── Aggregate snapshot ── */}
                    <motion.div variants={fadeUp} className="tf-snapshot">
                      <div className="tf-snapshot-card">
                        <div className="tf-snapshot-label">
                          <ArrowUpRight className="tf-snapshot-icon tf-snapshot-icon--tx" />
                          TX (Upload)
                        </div>
                        <div className="tf-snapshot-value tf-snapshot-value--tx">
                          {selectedLatest ? formatBps(selectedLatest.txBps) : formatBps(totalTx)}
                        </div>
                        <div className="tf-snapshot-avg">
                          {selectedIfaceInfo ? `Avg: ${formatBps(selectedIfaceInfo.avgTxBps)}` : `${interfaces.length} interfaces`}
                        </div>
                      </div>
                      <div className="tf-snapshot-card">
                        <div className="tf-snapshot-label">
                          <ArrowDownLeft className="tf-snapshot-icon tf-snapshot-icon--rx" />
                          RX (Download)
                        </div>
                        <div className="tf-snapshot-value tf-snapshot-value--rx">
                          {selectedLatest ? formatBps(selectedLatest.rxBps) : formatBps(totalRx)}
                        </div>
                        <div className="tf-snapshot-avg">
                          {selectedIfaceInfo ? `Avg: ${formatBps(selectedIfaceInfo.avgRxBps)}` : 'Aggregate'}
                        </div>
                      </div>
                      <div className="tf-snapshot-card">
                        <div className="tf-snapshot-label">Total Throughput</div>
                        <div className="tf-snapshot-value">
                          {selectedLatest ? formatBps(selectedLatest.totalBps) : formatBps(totalTx + totalRx)}
                        </div>
                        <div className="tf-snapshot-avg">
                          {selectedIfaceInfo ? `Peak: ${formatBps(selectedIfaceInfo.peakTotalBps)}` : `${data?.bucketInterval || '5m'} buckets`}
                        </div>
                      </div>
                      {selectedLatest?.utilization != null && (
                        <div className="tf-snapshot-card">
                          <div className="tf-snapshot-label">Utilization</div>
                          <div className={`tf-snapshot-value ${
                            selectedLatest.utilization >= 90 ? 'tf-snapshot-value--critical' :
                            selectedLatest.utilization >= 75 ? 'tf-snapshot-value--warning' : ''
                          }`}>
                            {selectedLatest.utilization.toFixed(1)}%
                          </div>
                          <div className="tf-snapshot-avg">
                            Avg: {selectedIfaceInfo?.avgUtilization?.toFixed(1) || '\u2014'}%
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* ── Interface pills ── */}
                    <motion.div variants={fadeUp} className="tf-iface-section">
                      <span className="tf-iface-label">Interface:</span>
                      <div className="tf-iface-pills">
                        {interfaces.map(iface => (
                          <button
                            key={iface.id}
                            onClick={() => setSelectedIface(iface.id)}
                            className={`tf-iface-pill ${selectedIface === iface.id ? 'tf-iface-pill--active' : ''}`}
                          >
                            {iface.name}
                            <span className="tf-iface-pill-bps">{formatBps(iface.avgTotalBps)}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>

                    {/* ── TX/RX Area chart ── */}
                    {lineData.length > 0 && (
                      <motion.div variants={fadeUp} className="tf-chart-panel">
                        <h3 className="tf-chart-title">
                          {selectedTimeSeries?.name || 'Interface'} &mdash; TX/RX over time
                        </h3>
                        <ResponsiveContainer width="100%" height={280}>
                          <AreaChart data={lineData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                            <defs>
                              <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-vemio-border)" vertical={false} />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 10, fill: 'var(--color-vemio-text-dim)' }}
                              axisLine={false}
                              tickLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: 'var(--color-vemio-text-dim)' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={v => formatBps(v).replace(' bps', '')}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                return (
                                  <div className="tf-tooltip">
                                    <p className="tf-tooltip-time">{label}</p>
                                    {payload.map(p => (
                                      <p key={p.name} className="tf-tooltip-row" style={{ color: p.color }}>
                                        {p.name === 'tx' ? 'TX' : 'RX'}: {formatBps(p.value)}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }}
                            />
                            <Area type="monotone" dataKey="tx" stroke="#F59E0B" strokeWidth={2} fill="url(#txGrad)" name="tx" />
                            <Area type="monotone" dataKey="rx" stroke="#14B8A6" strokeWidth={2} fill="url(#rxGrad)" name="rx" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </motion.div>
                    )}

                    {/* ── Top interfaces bar chart ── */}
                    {barData.length > 1 && (
                      <motion.div variants={fadeUp} className="tf-chart-panel">
                        <h3 className="tf-chart-title">Top Interfaces by Avg Throughput</h3>
                        <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 34)}>
                          <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-vemio-border)" horizontal={false} />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 10, fill: 'var(--color-vemio-text-dim)' }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={v => formatBps(v).replace(' bps', '')}
                            />
                            <YAxis
                              dataKey="name"
                              type="category"
                              tick={{ fontSize: 10, fill: 'var(--color-vemio-text-dim)' }}
                              axisLine={false}
                              tickLine={false}
                              width={120}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null;
                                const d = payload[0]?.payload;
                                return (
                                  <div className="tf-tooltip">
                                    <p className="tf-tooltip-time">{d?.fullName}</p>
                                    <p className="tf-tooltip-row" style={{ color: '#F59E0B' }}>TX: {formatBps(d?.tx)}</p>
                                    <p className="tf-tooltip-row" style={{ color: '#14B8A6' }}>RX: {formatBps(d?.rx)}</p>
                                    <p className="tf-tooltip-row" style={{ color: '#94A3B8' }}>Peak: {formatBps(d?.peak)}</p>
                                  </div>
                                );
                              }}
                              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Bar dataKey="tx" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} name="TX" />
                            <Bar dataKey="rx" stackId="a" fill="#14B8A6" radius={[0, 4, 4, 0]} name="RX" />
                          </BarChart>
                        </ResponsiveContainer>
                      </motion.div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>

      <style>{`
        .tf-root {
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-width: 1400px;
        }

        /* ── Header ── */
        .tf-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .tf-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tf-title-icon { width: 20px; height: 20px; color: var(--color-vemio-amber); }
        .tf-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }
        .tf-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .tf-range-btns { display: flex; gap: 2px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); border-radius: 8px; padding: 2px; }
        .tf-range-btn {
          padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
          cursor: pointer; border: none; background: transparent;
          color: var(--color-vemio-text-dim); transition: all 0.12s;
        }
        .tf-range-btn:hover { background: rgba(255,255,255,0.05); }
        .tf-range-btn--active { background: rgba(245,158,11,0.12); color: var(--color-vemio-amber); }
        .tf-refresh-btn {
          padding: 8px; border-radius: 8px; border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface); cursor: pointer; display: flex;
          align-items: center; color: var(--color-vemio-text-muted); transition: background 0.15s;
        }
        .tf-refresh-btn:hover { background: var(--color-vemio-surface); }

        /* ── Layout ── */
        .tf-layout { display: grid; grid-template-columns: 260px 1fr; gap: 18px; }
        @media (max-width: 899px) { .tf-layout { grid-template-columns: 1fr; } }

        /* ── Sidebar ── */
        .tf-sidebar {
          border-radius: 16px; background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border); overflow: hidden;
          display: flex; flex-direction: column; max-height: calc(100vh - 160px);
        }
        @media (max-width: 899px) { .tf-sidebar { max-height: 280px; } }
        .tf-sidebar-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid var(--color-vemio-border);
        }
        .tf-sidebar-title { font-size: 12px; font-weight: 600; color: var(--vemio-text); margin: 0; text-transform: uppercase; letter-spacing: 0.06em; }
        .tf-sidebar-count {
          font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px;
          background: rgba(245,158,11,0.1); color: var(--color-vemio-amber);
        }
        .tf-sidebar-search-wrap { position: relative; padding: 8px 10px; border-bottom: 1px solid var(--color-vemio-border); }
        .tf-sidebar-search-icon {
          position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
          width: 14px; height: 14px; color: var(--color-vemio-text-dim); pointer-events: none;
        }
        .tf-sidebar-search {
          width: 100%; padding: 7px 8px 7px 30px; font-size: 12px; border-radius: 6px;
          background: rgba(255,255,255,0.03); border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text); outline: none;
        }
        .tf-sidebar-search::placeholder { color: rgba(148,163,184,0.4); }
        .tf-sidebar-search:focus { border-color: rgba(245,158,11,0.3); }
        .tf-device-list { overflow-y: auto; flex: 1; padding: 4px; }
        .tf-device-item {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 10px 12px; border: none; background: transparent;
          cursor: pointer; border-radius: 8px; text-align: left; color: inherit;
          transition: background 0.12s;
        }
        .tf-device-item:hover { background: rgba(255,255,255,0.03); }
        .tf-device-item--active { background: rgba(245,158,11,0.08); }
        .tf-device-icon { width: 16px; height: 16px; color: var(--color-vemio-text-dim); flex-shrink: 0; }
        .tf-device-item--active .tf-device-icon { color: var(--color-vemio-amber); }
        .tf-device-info { flex: 1; min-width: 0; }
        .tf-device-name {
          display: block; font-size: 12px; font-weight: 500; color: var(--vemio-text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tf-device-meta {
          display: block; font-size: 10px; color: var(--color-vemio-text-dim);
          text-transform: capitalize; margin-top: 1px;
        }
        .tf-device-status {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
        .tf-device-status--up { background: var(--color-status-up); }
        .tf-device-status--down { background: var(--color-status-down); }
        .tf-device-status--degraded { background: var(--color-status-degraded); }
        .tf-device-status--unknown { background: var(--color-status-unknown); }
        .tf-device-empty { padding: 24px 16px; text-align: center; font-size: 12px; color: var(--color-vemio-text-dim); }

        /* ── Main ── */
        .tf-main { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

        /* Device bar */
        .tf-device-bar {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 14px 18px; border-radius: 12px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
        }
        .tf-device-bar-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .tf-device-bar-icon { width: 18px; height: 18px; color: var(--color-vemio-amber); flex-shrink: 0; }
        .tf-device-bar-name { font-size: 14px; font-weight: 600; color: var(--vemio-text); margin: 0; }
        .tf-device-bar-meta { font-size: 11px; color: var(--color-vemio-text-dim); }
        .tf-device-bar-link {
          display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px;
          font-size: 11px; font-weight: 500; border-radius: 6px; cursor: pointer;
          background: transparent; border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text-muted); transition: all 0.12s; white-space: nowrap; flex-shrink: 0;
        }
        .tf-device-bar-link:hover { background: rgba(255,255,255,0.04); color: var(--color-vemio-amber); border-color: rgba(245,158,11,0.3); }

        /* Snapshot cards */
        .tf-snapshot { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .tf-snapshot-card {
          border-radius: 12px; padding: 14px 16px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
        }
        .tf-snapshot-label {
          font-size: 10px; color: var(--color-vemio-text-dim); text-transform: uppercase;
          letter-spacing: 0.06em; display: flex; align-items: center; gap: 4px; margin: 0;
        }
        .tf-snapshot-icon { width: 12px; height: 12px; }
        .tf-snapshot-icon--tx { color: #F59E0B; }
        .tf-snapshot-icon--rx { color: #14B8A6; }
        .tf-snapshot-value {
          font-size: 20px; font-weight: 700; color: var(--vemio-text);
          margin: 6px 0 0; font-variant-numeric: tabular-nums;
        }
        .tf-snapshot-value--tx { color: #F59E0B; }
        .tf-snapshot-value--rx { color: #14B8A6; }
        .tf-snapshot-value--warning { color: #FBBF24; }
        .tf-snapshot-value--critical { color: #F87171; }
        .tf-snapshot-avg { font-size: 10px; color: var(--color-vemio-text-dim); margin: 4px 0 0; }

        /* Interface pills */
        .tf-iface-section { display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
        .tf-iface-label {
          font-size: 10px; color: var(--color-vemio-text-dim); text-transform: uppercase;
          letter-spacing: 0.06em; padding-top: 6px; flex-shrink: 0;
        }
        .tf-iface-pills { display: flex; flex-wrap: wrap; gap: 6px; }
        .tf-iface-pill {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
          border-radius: 8px; font-size: 11px; font-weight: 500; cursor: pointer;
          border: 1px solid var(--color-vemio-border); background: transparent;
          color: var(--color-vemio-text-muted); transition: all 0.12s; white-space: nowrap;
        }
        .tf-iface-pill:hover { background: rgba(255,255,255,0.04); border-color: var(--color-vemio-text-dim); }
        .tf-iface-pill--active { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.3); color: var(--color-vemio-amber); }
        .tf-iface-pill-bps { font-size: 9px; color: var(--color-vemio-text-dim); font-variant-numeric: tabular-nums; }
        .tf-iface-pill--active .tf-iface-pill-bps { color: rgba(245,158,11,0.6); }

        /* Chart panels */
        .tf-chart-panel {
          border-radius: 16px; padding: 18px 20px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
        }
        .tf-chart-title {
          font-size: 11px; font-weight: 600; color: var(--color-vemio-text-muted);
          margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.04em;
        }

        /* Tooltip */
        .tf-tooltip {
          border-radius: 8px; padding: 8px 12px; font-size: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          background: var(--color-vemio-surface-raised, #1E293B);
          border: 1px solid var(--color-vemio-border);
        }
        .tf-tooltip-time { color: var(--color-vemio-text-dim); margin: 0 0 4px; font-size: 11px; }
        .tf-tooltip-row { margin: 0; font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; }

        /* Empty / loading states */
        .tf-empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 80px 20px; text-align: center; border-radius: 16px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
        }
        .tf-empty-icon { width: 40px; height: 40px; color: var(--color-vemio-text-dim); margin-bottom: 12px; }
        .tf-empty-state h3 { font-size: 15px; font-weight: 600; color: var(--vemio-text); margin: 0 0 6px; }
        .tf-empty-state p { font-size: 13px; color: var(--color-vemio-text-dim); margin: 0; }
        .tf-loading {
          display: flex; align-items: center; gap: 8px; justify-content: center;
          padding: 48px 0; font-size: 13px; color: var(--color-vemio-text-dim);
        }
        .tf-loading-icon { width: 16px; height: 16px; animation: tf-spin 1s linear infinite; color: var(--color-vemio-amber); }
        @keyframes tf-spin { to { transform: rotate(360deg); } }
        .tf-no-data { padding: 48px 20px; text-align: center; font-size: 13px; color: var(--color-vemio-text-dim); border-radius: 16px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); }

        /* Mobile */
        @media (max-width: 479px) {
          .tf-range-btns { display: none; }
          .tf-snapshot { grid-template-columns: repeat(2, 1fr); }
          .tf-snapshot-value { font-size: 16px; }
          .tf-device-bar { flex-direction: column; align-items: flex-start; }
        }
      `}</style>
    </>
  );
}