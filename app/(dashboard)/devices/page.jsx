'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Server, Search, RefreshCw, ChevronLeft, ChevronRight, Download,
  Wifi, Shield, MonitorSpeaker, HardDrive, Radio, Cpu,
} from 'lucide-react';

const STATUS_CONFIG = {
  up:       { label: 'Online',   color: 'var(--color-status-up)',       bg: 'rgba(34,197,94,0.1)'   },
  down:     { label: 'Offline',  color: 'var(--color-status-down)',     bg: 'rgba(239,68,68,0.1)'   },
  degraded: { label: 'Degraded', color: 'var(--color-status-degraded)', bg: 'rgba(245,158,11,0.1)'  },
  unknown:  { label: 'Unknown',  color: 'var(--color-status-unknown)',  bg: 'rgba(107,114,128,0.1)' },
};

const TYPE_ICONS = {
  firewall:      Shield,
  core_switch:   MonitorSpeaker,
  access_switch: MonitorSpeaker,
  access_point:  Wifi,
  server:        Cpu,
  nas:           HardDrive,
  ups:           HardDrive,
  router:        Radio,
  other:         Server,
};

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

function timeAgo(date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
if (s < 60)    return 'just now';
if (s < 3600)  return `${Math.floor(s / 60)}m`;
if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}

export default function DevicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    type:   searchParams.get('type')   || '',
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  // Sync URL when filters change (shallow update, no navigation)
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.type)   params.set('type',   filters.type);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    const newUrl = qs ? `/devices?${qs}` : '/devices';
    router.replace(newUrl, { scroll: false });
  }, [filters, router]);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type)   params.set('type',   filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('page',  page.toString());
      params.set('limit', pageSize.toString());
      const res = await fetch(`/api/devices?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) { console.error('Failed to fetch devices:', err); }
    finally { setLoading(false); }
  }, [filters, page, pageSize]);

  // Export all devices (fetches without pagination limit)
  const handleExportAll = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (filters.type)   params.set('type',   filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('page', '1');
      params.set('limit', '10000'); // Fetch all
      const res = await fetch(`/api/devices?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const allData = await res.json();
      const { downloadCSV } = await import('@/lib/exportCSV');
      downloadCSV(
        allData.devices || [],
        'vemio-devices',
        ['name', 'status', 'type', 'ipAddress', 'make', 'model', 'siteName', 'lastSeenAt'],
        { ipAddress: 'IP Address', lastSeenAt: 'Status Since', siteName: 'Site', make: 'Manufacturer' }
      );
    } catch (err) { console.error('Export failed:', err); }
    finally { setExporting(false); }
  }, [filters]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const summary    = data?.summary;
  const devices    = data?.devices    || [];
  const pagination = data?.pagination;

  return (
    <>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="dv-root"
      >
        {/* ── Header ── */}
        <motion.div variants={fadeUp} className="dv-header">
          <div>
            <h1 className="dv-title">Device Health</h1>
            <p className="dv-subtitle">
              {summary ? `${summary.total} devices across your network` : 'Loading…'}
            </p>
          </div>
          <div className="dv-header-actions">
            <button
              onClick={handleExportAll}
              disabled={exporting || !summary?.total}
              className="dv-export-btn"
              title={summary?.total ? `Export all ${summary.total} devices as CSV` : 'No data to export'}
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-spin' : ''}`} />
              <span className="dv-export-label">{exporting ? 'Exporting…' : 'Export All'}</span>
            </button>
            <button onClick={fetchDevices} className="dv-refresh-btn" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 text-vemio-text-muted ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </motion.div>

        {/* ── Status pills — scrollable row on mobile ── */}
        {summary && (
          <motion.div variants={fadeUp} className="dv-pills">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count    = summary[key] || 0;
              const isActive = filters.status === key;
              return (
                <button
                  key={key}
                  onClick={() => { setFilters(f => ({ ...f, status: isActive ? '' : key })); setPage(1); }}
                  className="dv-pill"
                  style={{
                    background:  isActive ? cfg.bg                        : 'var(--color-vemio-surface)',
                    border:      `1px solid ${isActive ? cfg.color + '40' : 'var(--color-vemio-border)'}`,
                    color:       isActive ? cfg.color                      : 'var(--color-vemio-text-muted)',
                  }}
                >
                  <span className="dv-pill-dot" style={{ background: cfg.color }} />
                  {cfg.label}: {count}
                </button>
              );
            })}
          </motion.div>
        )}

        {/* ── Search + type filter ── */}
        <motion.div variants={fadeUp} className="dv-filters">
          <div className="dv-search-wrap">
            <Search className="dv-search-icon" />
            <input
              type="text"
              placeholder="Search by name, IP, or manufacturer…"
              value={filters.search}
              onChange={e => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
              className="dv-search-input"
            />
          </div>
          <select
            value={filters.type}
            onChange={e => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}
            className="dv-type-select"
          >
            <option value="">All types</option>
            <option value="firewall">Firewalls</option>
            <option value="core_switch">Core Switches</option>
            <option value="access_switch">Access Switches</option>
            <option value="access_point">Access Points</option>
            <option value="router">Routers</option>
            <option value="server">Servers</option>
            <option value="nas">NAS / Storage</option>
            <option value="ups">UPS</option>
            <option value="other">Other</option>
          </select>
        </motion.div>

        {/* ── Device table ── */}
        <motion.div variants={fadeUp} className="dv-table-panel">
          <div className="dv-table-scroll">
            <table className="dv-table">
              <thead>
                <tr className="dv-thead-row">
                  <th className="dv-th">Status</th>
                  <th className="dv-th dv-th--wide">Device Name</th>
                  <th className="dv-th dv-th--md-only">Type</th>
                  <th className="dv-th dv-th--md-only">IP Address</th>
                  <th className="dv-th dv-th--lg-only">Make / Model</th>
                  <th className="dv-th dv-th--lg-only">Site</th>
                  <th className="dv-th dv-th--sm-only">Duration</th>
                </tr>
              </thead>
              <tbody>
                {devices.length > 0 ? devices.map(device => {
                  const statusCfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.unknown;
                  const TypeIcon  = TYPE_ICONS[device.type] || Server;
                  return (
                    <tr
                      key={device.id}
                      onClick={() => router.push(`/devices/${device.id}`)}
                      className="dv-tr"
                    >
                      {/* Status */}
                      <td className="dv-td">
                        <span className="dv-status-badge"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}>
                          <span
                            className={`dv-status-dot ${device.status === 'down' ? 'dv-status-dot--pulse' : ''}`}
                            style={{ background: statusCfg.color }}
                          />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="dv-td dv-td--wide">
                        <div className="dv-name-cell">
                          <TypeIcon className="dv-type-icon" />
                          <span className="dv-name">{device.name}</span>
                        </div>
                        {/* On mobile, show type + IP below name */}
                        <div className="dv-name-sub">
                          <span>{device.type?.replace('_', ' ')}</span>
                          {device.ipAddress && <span className="dv-name-ip">{device.ipAddress}</span>}
                        </div>
                      </td>

                      {/* Type — hidden on mobile */}
                      <td className="dv-td dv-td--md-only dv-td--muted dv-td--capitalize">
                        {device.type?.replace('_', ' ')}
                      </td>

                      {/* IP — hidden on mobile */}
                      <td className="dv-td dv-td--md-only dv-td--mono">{device.ipAddress || '—'}</td>

                      {/* Make/Model — hidden below 1024px */}
                      <td className="dv-td dv-td--lg-only dv-td--muted">
                        {[device.make, device.model].filter(Boolean).join(' ') || '—'}
                      </td>

                      {/* Site — hidden below 1024px */}
                      <td className="dv-td dv-td--lg-only dv-td--muted">{device.siteName || '—'}</td>

                      <td className="dv-td dv-td--sm-only dv-td--dim">
  {device.lastSeenAt
    ? `${device.status === 'up' ? 'Up' : device.status === 'down' ? 'Down' : 'Idle'} ${timeAgo(new Date(device.lastSeenAt))}`
    : '—'}
</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="dv-empty">
                      {loading ? 'Loading devices…' : 'No devices found matching your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="dv-pagination">
              <div className="dv-pagination-left">
                <label className="dv-pagesize-label">
                  Show
                  <select
                    value={pageSize}
                    onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="dv-pagesize-select"
                  >
                    {[25, 50, 100, 250].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  per page
                </label>
                <span className="dv-pagination-info">
                  {(pagination.page - 1) * pagination.limit + 1}–
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </span>
              </div>
              {pagination.totalPages > 1 && (
                <div className="dv-pagination-btns">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1} className="dv-page-btn">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="dv-page-indicator">{page} / {pagination.totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages} className="dv-page-btn">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      <style>{`
        .dv-root {
          display: flex;
          flex-direction: column;
          gap: 18px;
          max-width: 1400px;
        }
        @media (max-width: 767px) { .dv-root { gap: 12px; } }

        /* Header */
        .dv-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .dv-title    { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .dv-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }
        .dv-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .dv-refresh-btn {
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface);
          cursor: pointer;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          transition: background 0.15s;
          margin-top: 2px;
        }
        .dv-refresh-btn:hover { background: var(--color-vemio-surface-raised); }

        /* Pills */
        .dv-pills {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 2px;
          flex-wrap: nowrap;
        }
        .dv-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          flex-shrink: 0;
          min-height: 32px;
        }
        .dv-pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Search + filter row */
        .dv-filters {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .dv-search-wrap {
          flex: 1;
          position: relative;
          min-width: 0;
        }
        .dv-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: var(--color-vemio-text-dim);
          pointer-events: none;
        }
        .dv-search-input {
          width: 100%;
          padding: 9px 12px 9px 34px;
          font-size: 13px;
          border-radius: 8px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          transition: border-color 0.15s;
        }
        .dv-search-input::placeholder { color: rgba(148,163,184,0.5); }
        .dv-search-input:focus { border-color: rgba(245,158,11,0.3); }

        .dv-type-select {
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          cursor: pointer;
          flex-shrink: 0;
          width: 160px;
        }
        @media (max-width: 479px) {
          .dv-type-select { width: 120px; font-size: 12px; }
        }

        /* Table panel */
        .dv-table-panel {
          border-radius: 16px;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .dv-table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .dv-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 420px;
        }
        .dv-thead-row { border-bottom: 1px solid var(--color-vemio-border); }
        .dv-th {
          padding: 10px 14px;
          text-align: left;
          font-size: 10px;
          font-weight: 500;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          white-space: nowrap;
        }

        .dv-th--md-only, .dv-td--md-only { display: none; }
        @media (min-width: 640px) {
          .dv-th--md-only, .dv-td--md-only { display: table-cell; }
        }
        .dv-th--lg-only, .dv-td--lg-only { display: none; }
        @media (min-width: 1024px) {
          .dv-th--lg-only, .dv-td--lg-only { display: table-cell; }
        }
        .dv-th--sm-only, .dv-td--sm-only { display: none; }
        @media (min-width: 480px) {
          .dv-th--sm-only, .dv-td--sm-only { display: table-cell; }
        }

        .dv-tr {
          border-bottom: 1px solid rgba(255,255,255,0.03);
          cursor: pointer;
          transition: background 0.12s;
        }
        .dv-tr:hover { background: rgba(255,255,255,0.025); }

        .dv-td {
          padding: 10px 14px;
          font-size: 13px;
          vertical-align: middle;
        }
        .dv-td--muted     { color: var(--vemio-text-muted); font-size: 12px; }
        .dv-td--mono      { font-family: monospace; font-size: 11px; color: var(--vemio-text-muted); }
        .dv-td--dim       { font-size: 11px; color: var(--color-vemio-text-dim); }
        .dv-td--capitalize { text-transform: capitalize; }

        .dv-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }
        .dv-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dv-status-dot--pulse {
          animation: dv-pulse 1.5s ease-in-out infinite;
        }
        @keyframes dv-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }

        .dv-td--wide { max-width: 0; }
        .dv-name-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dv-type-icon {
          width: 15px;
          height: 15px;
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
        }
        .dv-name {
          font-weight: 500;
          color: var(--vemio-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .dv-name-sub {
          display: none;
          gap: 8px;
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin-top: 2px;
          padding-left: 23px;
        }
        @media (max-width: 639px) {
          .dv-name-sub { display: flex; flex-wrap: wrap; }
        }
        .dv-name-ip { font-family: monospace; }

        .dv-empty {
          padding: 48px 14px;
          text-align: center;
          font-size: 13px;
          color: var(--vemio-text-muted);
        }

        .dv-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid var(--color-vemio-border);
          flex-wrap: wrap;
          gap: 8px;
        }
        .dv-pagination-left {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .dv-pagination-info {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 0;
        }
        .dv-pagesize-label {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dv-pagesize-select {
          padding: 3px 6px;
          border-radius: 6px;
          font-size: 11px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          cursor: pointer;
          outline: none;
        }
        .dv-pagination-btns { display: flex; gap: 4px; align-items: center; }
        .dv-page-btn {
          padding: 6px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--vemio-text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background 0.12s;
        }
        .dv-page-btn:hover    { background: rgba(255,255,255,0.05); }
        .dv-page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .dv-page-indicator {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          min-width: 48px;
          text-align: center;
        }

        /* Export button */
        .dv-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          color: var(--color-vemio-text-muted);
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .dv-export-btn:hover:not(:disabled) {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text);
          border-color: var(--color-vemio-text-dim);
        }
        .dv-export-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @media (max-width: 479px) {
          .dv-export-label { display: none; }
          .dv-export-btn { padding: 7px 8px; }
          .dv-pagesize-label { display: none; }
        }
      `}</style>
    </>
  );
}