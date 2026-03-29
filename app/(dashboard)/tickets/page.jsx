// ════════════════════════════════════════════════════════
//  TicketsPage  →  app/(dashboard)/tickets/page.jsx
// ════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, RefreshCw, AlertTriangle, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, Clock, Ticket,
} from 'lucide-react';
import ExportButton from '@/app/components/ExportButton';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const STATUS_STYLES = {
  open:     { label: 'Open',     bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)',  color: 'var(--color-vemio-amber)' },
  pending:  { label: 'Pending',  bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.25)',  color: '#a78bfa' },
  resolved: { label: 'Resolved', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)',  color: '#10b981' },
  closed:   { label: 'Closed',   bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.25)', color: '#9ca3af' },
};
const PRIORITY_STYLES = {
  critical: { label: 'Critical', color: '#ef4444' },
  high:     { label: 'High',     color: '#f97316' },
  medium:   { label: 'Medium',   color: 'var(--color-vemio-amber)' },
  low:      { label: 'Low',      color: '#6b7280' },
};

function formatMinutes(min) {
  if (min == null) return '—';
  if (min < 60)   return `${Math.round(min)}m`;
  if (min < 1440) return `${(min / 60).toFixed(1)}h`;
  return `${(min / 1440).toFixed(1)}d`;
}

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="tk-stat-card">
      <div className="tk-stat-top">
        <span style={{ color }}>{icon}</span>
        <span className="tk-stat-label">{label}</span>
      </div>
      <div className="tk-stat-value">{value}</div>
      <div className="tk-stat-sub">{sub}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.open;
  return (
    <span className="tk-status-badge" style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

function PriorityDot({ priority }) {
  const p = PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium;
  return (
    <div className="tk-priority">
      <span className="tk-priority-dot" style={{ background: p.color }} />
      <span className="tk-priority-label">{p.label}</span>
    </div>
  );
}

function SlaIndicator({ sla }) {
  if (sla.responseMet == null && sla.resolutionMet == null)
    return <span className="tk-sla-dash">—</span>;

  const responseFailed   = sla.responseMet   === false;
  const resolutionFailed = sla.resolutionMet === false;
  const allMet = (sla.responseMet === true || sla.responseMet == null)
              && (sla.resolutionMet === true || sla.resolutionMet == null);

  if (allMet) return (
    <span className="tk-sla tk-sla--met">
      <CheckCircle2 size={12} /> Met
    </span>
  );
  return (
    <span className="tk-sla tk-sla--breach">
      <XCircle size={12} />
      {responseFailed && resolutionFailed ? 'Both' : responseFailed ? 'Response' : 'Resolution'}
    </span>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="tk-filter-select">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 0 });

  const [statusFilter,   setStatusFilter]   = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [search,         setSearch]         = useState('');
  const [searchInput,    setSearchInput]    = useState('');
  const [period,         setPeriod]         = useState('mtd');
  const { selectedTenantId, loading: tenantLoading } = useTenantSwitcher();
  const fetchTickets = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams();
      params.set('page', page); params.set('limit', '25');
      if (statusFilter)   params.set('status',   statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (search)         params.set('search',   search);
      params.set('tenantId', selectedTenantId);
      const res = await fetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTickets(json.tickets);
      setPagination(json.pagination);
    } catch (err) { setError(err.message); }
  }, [statusFilter, priorityFilter, search, selectedTenantId]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/stats?period=${period}&tenantId=${selectedTenantId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (err) { console.error('Stats fetch failed:', err.message); }
  }, [period, selectedTenantId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchTickets(1), fetchStats()]);
      setLoading(false);
    };
    load();
  }, [fetchTickets, fetchStats]);

  if (loading && !stats) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
    </div>
  );

  if (error && !stats) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <AlertTriangle className="w-8 h-8 text-severity-high" />
      <p className="text-vemio-text-muted text-sm">Failed to load tickets: {error}</p>
    </div>
  );

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="tk-root">

        {/* ── Header ── */}
<motion.div variants={fadeUp} className="tk-header">
          <div>
            <h1 className="tk-title">Tickets & SLA</h1>
            <p className="tk-subtitle">Service desk metrics and ticket tracking</p>
          </div>
          <div className="tk-header-actions">
            <ExportButton
              data={tickets}
              filename="vemio-tickets"
              columns={['sourceId', 'title', 'status', 'priority', 'site', 'age']}
              headers={{ sourceId: 'Ticket ID', site: 'Site' }}
              label="Export CSV"
            />
          {/* Period selector: scrollable row on mobile */}
          <div className="tk-period-row">
            {['7d', 'mtd', '30d', '90d'].map(p => (
              <button key={p} onClick={() => setPeriod(p)} className="tk-period-btn"
                style={{
                  background:   period === p ? 'rgba(245,158,11,0.15)' : 'transparent',
                  borderColor:  period === p ? 'rgba(245,158,11,0.3)'  : 'rgba(255,255,255,0.06)',
                  color:        period === p ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-muted)',
                }}>
                {p.toUpperCase()}
              </button>
             ))}
          </div>
          </div>
        </motion.div>

        {/* ── Summary Cards ── */}
        {stats && (
          <motion.div variants={fadeUp} className="tk-stats">
            <StatCard label="Open tickets"
              value={stats.allTime.open + stats.allTime.pending}
              sub={`${stats.period.total} this period`}
              icon={<Ticket size={16} />}
              color="var(--color-vemio-amber)" />
            <StatCard label="Avg response"
              value={stats.avgResponseMinutes != null ? formatMinutes(stats.avgResponseMinutes) : '—'}
              sub={stats.sla.responseCompliance != null ? `${stats.sla.responseCompliance}% SLA met` : 'No data'}
              icon={<Clock size={16} />}
              color="#10b981" />
            <StatCard label="SLA compliance"
              value={stats.sla.resolutionCompliance != null ? `${stats.sla.resolutionCompliance}%` : '—'}
              sub={`${stats.sla.resolutionBreaches} breaches`}
              icon={stats.sla.resolutionCompliance >= 90 ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              color={stats.sla.resolutionCompliance >= 90 ? '#10b981' : '#ef4444'} />
            <StatCard label="MTTR"
              value={stats.avgResolutionMinutes != null ? formatMinutes(stats.avgResolutionMinutes) : '—'}
              sub={`${stats.allTime.resolved + stats.allTime.closed} resolved total`}
              icon={<RefreshCw size={16} />}
              color="#a78bfa" />
          </motion.div>
        )}

        {/* ── Filters + Search ── */}
        <motion.div variants={fadeUp} className="tk-filters">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="tk-search-wrap">
            <Search size={14} className="tk-search-icon" />
            <input
              type="text"
              placeholder="Search tickets…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="tk-search-input"
            />
          </form>
          <div className="tk-selects">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={[
              { value: '', label: 'All status' },
              { value: 'open',     label: 'Open'     },
              { value: 'pending',  label: 'Pending'  },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed',   label: 'Closed'   },
            ]} />
            <FilterSelect value={priorityFilter} onChange={setPriorityFilter} options={[
              { value: '',         label: 'All priority' },
              { value: 'critical', label: 'Critical' },
              { value: 'high',     label: 'High'     },
              { value: 'medium',   label: 'Medium'   },
              { value: 'low',      label: 'Low'      },
            ]} />
          </div>
        </motion.div>

        {/* ── Table ── */}
        <motion.div variants={fadeUp} className="tk-table-panel">
          <div className="tk-table-scroll">
            <table className="tk-table">
              <thead>
                <tr className="tk-thead-row">
                  <th className="tk-th">ID</th>
                  <th className="tk-th tk-th--wide">Title</th>
                  <th className="tk-th">Status</th>
                  <th className="tk-th">Priority</th>
                  <th className="tk-th tk-th--lg-only">Site</th>
                  <th className="tk-th tk-th--md-only">SLA</th>
                  <th className="tk-th">Age</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => (
                  <tr key={t.id} className="tk-tr">
                    <td className="tk-td tk-td--mono">#{t.sourceId || '—'}</td>
                    <td className="tk-td">
                      <div className="tk-ticket-title">{t.title}</div>
                      {t.requester && <div className="tk-ticket-req">{t.requester}</div>}
                    </td>
                    <td className="tk-td"><StatusBadge status={t.status} /></td>
                    <td className="tk-td"><PriorityDot priority={t.priority} /></td>
                    <td className="tk-td tk-td--lg-only tk-td--muted">{t.site}</td>
                    <td className="tk-td tk-td--md-only"><SlaIndicator sla={t.sla} /></td>
                    <td className="tk-td tk-td--mono tk-td--muted">{t.age || '—'}</td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr>
                    <td colSpan={7} className="tk-empty-cell">No tickets found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="tk-pagination">
              <span className="tk-pagination-info">
                {pagination.total} tickets · Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="tk-pagination-btns">
                <button onClick={() => fetchTickets(pagination.page - 1)}
                  disabled={pagination.page <= 1} className="tk-page-btn">
                  <ChevronLeft size={14} />
                </button>
                <button onClick={() => fetchTickets(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages} className="tk-page-btn">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      <style>{`
      .tk-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}
        .tk-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }
        @media (max-width: 767px) { .tk-root { gap: 14px; } }

        /* Header */
        .tk-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .tk-title    { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .tk-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }

        /* Period selector — overflow-x on mobile so all 4 buttons stay on one row */
        .tk-period-row {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          flex-shrink: 0;
          padding-bottom: 2px;   /* prevent clipping of scroll indicator */
        }
        .tk-period-btn {
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-family: monospace;
          font-weight: 500;
          border: 1px solid;
          cursor: pointer;
          white-space: nowrap;
          min-height: 30px;
          transition: background 0.15s, color 0.15s;
        }

        /* Stats: 4-col desktop, 2-col tablet/mobile */
        .tk-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 1023px) { .tk-stats { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 479px)  { .tk-stats { gap: 8px; } }

        .tk-stat-card {
          border-radius: 12px;
          padding: 14px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .tk-stat-top {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .tk-stat-label {
          font-size: 11px;
          color: var(--vemio-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tk-stat-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--vemio-text);
          font-variant-numeric: tabular-nums;
        }
        .tk-stat-sub {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin-top: 4px;
        }
        @media (max-width: 479px) { .tk-stat-value { font-size: 18px; } }

        /* Filters: search full-width, selects beside each other */
        .tk-filters {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }
        .tk-search-wrap {
          flex: 1;
          min-width: 180px;
          position: relative;
        }
        .tk-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--vemio-text-muted);
          pointer-events: none;
        }
        .tk-search-input {
          width: 100%;
          padding: 8px 10px 8px 30px;
          font-size: 13px;
          border-radius: 8px;
          background: var(--color-vemio-surface);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--vemio-text);
          outline: none;
          transition: border-color 0.15s;
        }
        .tk-search-input::placeholder { color: rgba(148,163,184,0.5); }
        .tk-search-input:focus { border-color: rgba(245,158,11,0.3); }

        .tk-selects { display: flex; gap: 8px; flex-wrap: wrap; }
        .tk-filter-select {
          padding: 8px 10px;
          font-size: 12px;
          border-radius: 8px;
          background: var(--color-vemio-surface);
          border: 1px solid rgba(255,255,255,0.06);
          color: var(--vemio-text-muted);
          outline: none;
          cursor: pointer;
        }
        .tk-filter-select:focus { border-color: rgba(245,158,11,0.3); }

        /* Table panel */
        .tk-table-panel {
          border-radius: 12px;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid rgba(255,255,255,0.06);
        }
        .tk-table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .tk-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 560px;
        }
        .tk-thead-row { border-bottom: 1px solid rgba(255,255,255,0.06); }
        .tk-th {
          padding: 10px 14px;
          text-align: left;
          font-size: 10px;
          font-weight: 500;
          color: var(--vemio-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          white-space: nowrap;
        }
        /* Hide certain columns at breakpoints */
        .tk-th--lg-only,
        .tk-td--lg-only { display: none; }
        @media (min-width: 1024px) {
          .tk-th--lg-only,
          .tk-td--lg-only { display: table-cell; }
        }
        .tk-th--md-only,
        .tk-td--md-only { display: none; }
        @media (min-width: 768px) {
          .tk-th--md-only,
          .tk-td--md-only { display: table-cell; }
        }

        .tk-tr {
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.12s;
        }
        .tk-tr:hover { background: rgba(255,255,255,0.02); }
        .tk-td {
          padding: 10px 14px;
          font-size: 13px;
          vertical-align: middle;
        }
        .tk-td--mono  { font-family: monospace; font-size: 11px; }
        .tk-td--muted { color: var(--vemio-text-muted); font-size: 12px; }
        .tk-ticket-title {
          color: var(--vemio-text);
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 260px;
        }
        .tk-ticket-req {
          font-size: 11px;
          color: var(--vemio-text-muted);
          margin-top: 2px;
        }
        .tk-status-badge {
          display: inline-flex;
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .tk-priority {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tk-priority-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tk-priority-label { font-size: 12px; color: var(--vemio-text-muted); }
        .tk-sla {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
        }
        .tk-sla--met   { color: #10b981; }
        .tk-sla--breach { color: #ef4444; }
        .tk-sla-dash   { font-size: 12px; color: var(--vemio-text-muted); }

        .tk-empty-cell {
          padding: 48px 14px;
          text-align: center;
          font-size: 13px;
          color: var(--vemio-text-muted);
        }

        /* Pagination */
        .tk-pagination {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
          gap: 8px;
        }
        .tk-pagination-info {
          font-size: 11px;
          color: var(--vemio-text-muted);
        }
        .tk-pagination-btns { display: flex; gap: 4px; }
        .tk-page-btn {
          padding: 6px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--vemio-text-muted);
          cursor: pointer;
          transition: background 0.12s;
          display: flex;
          align-items: center;
        }
        .tk-page-btn:hover     { background: rgba(255,255,255,0.05); }
        .tk-page-btn:disabled  { opacity: 0.3; cursor: not-allowed; }
      `}</style>
    </>
  );
}