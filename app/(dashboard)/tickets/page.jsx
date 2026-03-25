'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Filter, Ticket,
} from 'lucide-react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const STATUS_STYLES = {
  open: { label: 'Open', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', color: 'var(--color-vemio-amber)' },
  pending: { label: 'Pending', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.25)', color: '#a78bfa' },
  resolved: { label: 'Resolved', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', color: '#10b981' },
  closed: { label: 'Closed', bg: 'rgba(107, 114, 128, 0.12)', border: 'rgba(107, 114, 128, 0.25)', color: '#9ca3af' },
};

const PRIORITY_STYLES = {
  critical: { label: 'Critical', color: '#ef4444' },
  high: { label: 'High', color: '#f97316' },
  medium: { label: 'Medium', color: 'var(--color-vemio-amber)' },
  low: { label: 'Low', color: '#6b7280' },
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [period, setPeriod] = useState('mtd');

  const fetchTickets = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '25');
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTickets(json.tickets);
      setPagination(json.pagination);
    } catch (err) {
      setError(err.message);
    }
  }, [statusFilter, priorityFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/stats?period=${period}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setStats(json);
    } catch (err) {
      console.error('Stats fetch failed:', err.message);
    }
  }, [period]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTickets(1), fetchStats()]);
      setLoading(false);
    };
    load();
  }, [fetchTickets, fetchStats]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-severity-high" />
        <p className="text-vemio-text-muted text-sm">Failed to load tickets: {error}</p>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Tickets & SLA</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">
            Service desk metrics and ticket tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['7d', 'mtd', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="text-xs font-mono px-2.5 py-1 rounded transition-colors"
              style={{
                background: period === p ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                border: `1px solid ${period === p ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.06)'}`,
                color: period === p ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-muted)',
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Summary Cards */}
      {stats && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Open tickets"
            value={stats.allTime.open + stats.allTime.pending}
            sub={`${stats.period.total} this period`}
            icon={<Ticket size={16} />}
            color="var(--color-vemio-amber)"
          />
          <StatCard
            label="Avg response"
            value={stats.avgResponseMinutes != null ? formatMinutes(stats.avgResponseMinutes) : '—'}
            sub={stats.sla.responseCompliance != null ? `${stats.sla.responseCompliance}% SLA met` : 'No data'}
            icon={<Clock size={16} />}
            color="#10b981"
          />
          <StatCard
            label="SLA compliance"
            value={stats.sla.resolutionCompliance != null ? `${stats.sla.resolutionCompliance}%` : '—'}
            sub={`${stats.sla.resolutionBreaches} breaches this period`}
            icon={stats.sla.resolutionCompliance >= 90 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            color={stats.sla.resolutionCompliance >= 90 ? '#10b981' : '#ef4444'}
          />
          <StatCard
            label="MTTR"
            value={stats.avgResolutionMinutes != null ? formatMinutes(stats.avgResolutionMinutes) : '—'}
            sub={`${stats.allTime.resolved + stats.allTime.closed} resolved total`}
            icon={<RefreshCw size={16} />}
            color="#a78bfa"
          />
        </motion.div>
      )}

      {/* Filters + Search */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-vemio-text-muted" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-vemio-surface border border-white/6 text-vemio-text placeholder:text-vemio-text-muted/50 focus:outline-none focus:border-vemio-amber/30"
          />
        </form>
        <div className="flex gap-2">
          <FilterSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All status' },
              { value: 'open', label: 'Open' },
              { value: 'pending', label: 'Pending' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <FilterSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={[
              { value: '', label: 'All priority' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
      </motion.div>

      {/* Ticket Table */}
      <motion.div
        variants={fadeUp}
        className="rounded-xl border border-white/6 overflow-hidden"
        style={{ background: 'var(--color-vemio-surface)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6">
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider">Priority</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider hidden lg:table-cell">Site</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider hidden md:table-cell">SLA</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-vemio-text-muted uppercase tracking-wider">Age</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-white/4 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-vemio-text-muted">
                    #{t.sourceId || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-vemio-text font-medium truncate max-w-[280px]">{t.title}</div>
                    {t.requester && (
                      <div className="text-xs text-vemio-text-muted mt-0.5">{t.requester}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityDot priority={t.priority} />
                  </td>
                  <td className="px-4 py-3 text-vemio-text-muted text-xs hidden lg:table-cell">
                    {t.site}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <SlaIndicator sla={t.sla} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-vemio-text-muted">
                    {t.age || '—'}
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-vemio-text-muted text-sm">
                    No tickets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/6">
            <span className="text-xs text-vemio-text-muted">
              {pagination.total} tickets · Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => fetchTickets(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30 text-vemio-text-muted"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => fetchTickets(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded hover:bg-white/5 disabled:opacity-30 text-vemio-text-muted"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div
      className="rounded-xl p-4 border border-white/6"
      style={{ background: 'var(--color-vemio-surface)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color }}>{icon}</span>
        <span className="text-xs text-vemio-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-vemio-text">{value}</div>
      <div className="text-xs text-vemio-text-muted mt-1">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span
      className="inline-flex text-[11px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function PriorityDot({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
      <span className="text-xs text-vemio-text-muted">{p.label}</span>
    </div>
  );
}

function SlaIndicator({ sla }) {
  if (sla.responseMet == null && sla.resolutionMet == null) {
    return <span className="text-xs text-vemio-text-muted">—</span>;
  }

  const responseFailed = sla.responseMet === false;
  const resolutionFailed = sla.resolutionMet === false;
  const allMet = (sla.responseMet === true || sla.responseMet == null)
    && (sla.resolutionMet === true || sla.resolutionMet == null);

  if (allMet) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
        <CheckCircle2 size={12} /> Met
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
      <XCircle size={12} />
      {responseFailed && resolutionFailed ? 'Both breached' : responseFailed ? 'Response' : 'Resolution'}
    </span>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs px-2.5 py-2 rounded-lg border border-white/6 text-vemio-text-muted focus:outline-none focus:border-vemio-amber/30"
      style={{ background: 'var(--color-vemio-surface)' }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function formatMinutes(min) {
  if (min == null) return '—';
  if (min < 60) return `${Math.round(min)}m`;
  if (min < 1440) return `${(min / 60).toFixed(1)}h`;
  return `${(min / 1440).toFixed(1)}d`;
}