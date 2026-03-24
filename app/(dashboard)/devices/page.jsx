'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Server, Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
  Wifi, Shield, MonitorSpeaker, HardDrive, Radio, Cpu, AlertTriangle,
} from 'lucide-react';

const STATUS_CONFIG = {
  up: { label: 'Online', color: 'var(--color-status-up)', bg: 'rgba(34,197,94,0.1)' },
  down: { label: 'Offline', color: 'var(--color-status-down)', bg: 'rgba(239,68,68,0.1)' },
  degraded: { label: 'Degraded', color: 'var(--color-status-degraded)', bg: 'rgba(245,158,11,0.1)' },
  unknown: { label: 'Unknown', color: 'var(--color-status-unknown)', bg: 'rgba(107,114,128,0.1)' },
};

const TYPE_ICONS = {
  firewall: Shield,
  core_switch: MonitorSpeaker,
  access_switch: MonitorSpeaker,
  access_point: Wifi,
  server: Cpu,
  nas: HardDrive,
  ups: HardDrive,
  router: Radio,
  other: Server,
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function DevicesPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const [page, setPage] = useState(1);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      params.set('page', page.toString());
      params.set('limit', '25');

      const res = await fetch(`/api/devices?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const summary = data?.summary;
  const devices = data?.devices || [];
  const pagination = data?.pagination;

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 } } }} className="space-y-5">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Device Health</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">
            {summary ? `${summary.total} devices across your network` : 'Loading...'}
          </p>
        </div>
        <button onClick={fetchDevices} className="p-2 rounded-lg hover:bg-vemio-surface-hover transition-colors">
          <RefreshCw className={`w-4 h-4 text-vemio-text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Status summary pills */}
      {summary && (
        <motion.div variants={fadeUp} className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = summary[key] || 0;
            const isActive = filters.status === key;
            return (
              <button
                key={key}
                onClick={() => { setFilters(f => ({ ...f, status: isActive ? '' : key })); setPage(1); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isActive ? cfg.bg : 'var(--color-vemio-surface)',
                  border: `1px solid ${isActive ? cfg.color + '40' : 'var(--color-vemio-border)'}`,
                  color: isActive ? cfg.color : 'var(--color-vemio-text-muted)',
                }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
                {cfg.label}: {count}
              </button>
            );
          })}
        </motion.div>
      )}

      {/* Search + type filter */}
      <motion.div variants={fadeUp} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vemio-text-dim" />
          <input
            type="text"
            placeholder="Search by name, IP, or manufacturer..."
            value={filters.search}
            onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm"
            style={{
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
              color: 'var(--color-vemio-text)',
              outline: 'none',
            }}
          />
        </div>
        <select
          value={filters.type}
          onChange={(e) => { setFilters(f => ({ ...f, type: e.target.value })); setPage(1); }}
          className="px-4 py-2.5 rounded-lg text-sm appearance-none cursor-pointer"
          style={{
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
            color: 'var(--color-vemio-text)',
            outline: 'none',
            minWidth: '160px',
          }}
        >
          <option value="">All types</option>
          <option value="firewall">Firewalls</option>
          <option value="core_switch">Core Switches</option>
          <option value="access_switch">Access Switches</option>
          <option value="access_point">Access Points</option>
          <option value="router">Routers</option>
          <option value="server">Servers</option>
          <option value="nas">NAS/Storage</option>
          <option value="ups">UPS</option>
          <option value="other">Other</option>
        </select>
      </motion.div>

      {/* Device table */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-vemio-border)' }}>
                {['Status', 'Device Name', 'Type', 'IP Address', 'Make / Model', 'Site', 'Last Seen'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-vemio-text-dim uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devices.length > 0 ? devices.map((device) => {
                const statusCfg = STATUS_CONFIG[device.status] || STATUS_CONFIG.unknown;
                const TypeIcon = TYPE_ICONS[device.type] || Server;
                return (
                  <tr
                    key={device.id}
                    onClick={() => router.push(`/devices/${device.id}`)}
                    className="cursor-pointer transition-colors hover:bg-vemio-surface-hover"
                    style={{ borderBottom: '1px solid var(--color-vemio-border-subtle)' }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                        style={{ background: statusCfg.bg, color: statusCfg.color }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${device.status === 'down' ? 'animate-pulse-dot' : ''}`}
                          style={{ background: statusCfg.color }} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-vemio-text-dim shrink-0" />
                        <span className="font-medium text-vemio-text truncate max-w-[200px]">{device.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-vemio-text-muted capitalize">{device.type?.replace('_', ' ')}</td>
                    <td className="px-4 py-3 font-mono text-xs text-vemio-text-muted">{device.ipAddress || '—'}</td>
                    <td className="px-4 py-3 text-vemio-text-muted">{[device.make, device.model].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3 text-vemio-text-muted">{device.siteName || '—'}</td>
                    <td className="px-4 py-3 text-xs text-vemio-text-dim">
                      {device.lastSeenAt ? timeAgo(new Date(device.lastSeenAt)) : '—'}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-vemio-text-muted">
                    {loading ? 'Loading devices...' : 'No devices found matching your filters'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--color-vemio-border)' }}>
            <p className="text-xs text-vemio-text-dim">
              Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-vemio-surface-hover disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-vemio-text-muted" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-1.5 rounded-lg hover:bg-vemio-surface-hover disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-vemio-text-muted" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
