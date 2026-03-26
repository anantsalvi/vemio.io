'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import ExportButton from '@/app/components/ExportButton';
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const SEVERITY_STYLES = {
  critical: { dot: 'bg-severity-critical', text: 'text-severity-critical', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
  high:     { dot: 'bg-severity-high',     text: 'text-severity-high',     bg: 'rgba(234,88,12,0.08)',   border: 'rgba(234,88,12,0.2)' },
  medium:   { dot: 'bg-vemio-amber',       text: 'text-vemio-amber',       bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.2)' },
  low:      { dot: 'bg-status-up',         text: 'text-status-up',         bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.2)' },
};

function getTimeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function AlertRow({ alert, onAction }) {
  const [acting, setActing] = useState(false);
  const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;
  const actionable = alert.state === 'active' || alert.state === 'acknowledged';

  async function handleAction(action) {
    setActing(true);
    try { await onAction(alert.id, action); } finally { setActing(false); }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="alert-row"
      style={{
        background: alert.state === 'active'
          ? 'var(--color-vemio-surface)'
          : 'var(--color-vemio-surface-raised)',
        border: `1px solid ${alert.state === 'active'
          ? 'var(--color-vemio-border)'
          : 'transparent'}`,
      }}
    >
      {/* Top: badges + time */}
      <div className="alert-meta">
        <span
          className="alert-sev-badge"
          style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
        >
          <span
            className={`alert-sev-dot ${alert.severity === 'critical' ? 'alert-sev-dot--pulse' : ''}`}
            style={{ background: `var(--color-${sev.dot.replace('bg-', '')}, currentColor)` }}
          />
          <span className={sev.text}>{alert.severity}</span>
        </span>

        <span className={`alert-state ${
          alert.state === 'active'       ? 'alert-state--active' :
          alert.state === 'acknowledged' ? 'alert-state--ack'    :
          alert.state === 'resolved'     ? 'alert-state--resolved' :
          'alert-state--dim'
        }`}>
          {alert.state === 'acknowledged' ? 'Ack' : alert.state}
        </span>

        <span className="alert-time">{getTimeAgo(alert.triggered_at)}</span>
      </div>

      {/* Title */}
      <p className="alert-title">{alert.title}</p>

      {/* Device / site / type */}
      <div className="alert-details">
        {alert.device_name && <span>{alert.device_name}</span>}
        {alert.site_name   && <span>{alert.site_name}</span>}
        <span>{alert.alert_type?.replace(/_/g, ' ')}</span>
      </div>

      {/* Actions — always visible on touch, hover-reveal on pointer devices */}
      {actionable && (
        <div className="alert-actions">
          {alert.state === 'active' && (
            <button
              onClick={() => handleAction('acknowledge')}
              disabled={acting}
              className="alert-btn alert-btn--ack"
            >
              Acknowledge
            </button>
          )}
          <button
            onClick={() => handleAction('resolve')}
            disabled={acting}
            className="alert-btn alert-btn--resolve"
          >
            Resolve
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function AlertsPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ state: '', severity: '', type: '' });

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.state)    params.set('state',    filters.state);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.type)     params.set('type',     filters.type);
      params.set('limit', '50');
      const res = await fetch(`/api/alerts?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) { console.error('Alerts fetch:', err); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);
  useEffect(() => {
    const id = setInterval(fetchAlerts, 60000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  async function handleAction(alertId, action) {
    try {
      const res = await fetch('/api/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action }),
      });
      if (res.ok) await fetchAlerts();
    } catch (err) { console.error('Action failed:', err); }
  }

  const summary = data?.summary || {};
  const alerts  = data?.alerts  || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="alerts-root">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} className="alerts-header">
          <div>
            <h1 className="alerts-title">Alerts</h1>
            <p className="alerts-subtitle">Real-time infrastructure alerts and notifications</p>
          </div>
         <div className="alerts-header-actions">
            <ExportButton
              data={alerts}
              filename="vemio-alerts"
              columns={['severity', 'title', 'state', 'alert_type', 'device_name', 'site_name', 'triggered_at']}
              headers={{ alert_type: 'Type', device_name: 'Device', site_name: 'Site', triggered_at: 'Triggered' }}
              label="Export CSV"
            />
            <button onClick={fetchAlerts} className="alerts-refresh-btn">
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── Summary cards ── */}
        <motion.div variants={fadeUp} className="alerts-summary">
          {[
            { label: 'Active',       value: summary.active        || 0, colorClass: 'text-severity-high',    key: 'active'       },
            { label: 'Critical',     value: summary.critical_active|| 0, colorClass: 'text-severity-critical', key: ''            },
            { label: 'Acknowledged', value: summary.acknowledged  || 0, colorClass: 'text-vemio-amber',       key: 'acknowledged' },
            { label: 'Resolved 24h', value: summary.resolved_24h  || 0, colorClass: 'text-status-up',         key: 'resolved'     },
            { label: 'Suppressed',   value: summary.suppressed    || 0, colorClass: 'text-vemio-text-dim',    key: 'suppressed'   },
          ].map(c => (
            <button
              key={c.label}
              onClick={() => c.key && setFilters(f => ({ ...f, state: f.state === c.key ? '' : c.key }))}
              className={`summary-card ${filters.state === c.key ? 'summary-card--active' : ''}`}
            >
              <p className="summary-card-label">{c.label}</p>
              <p className={`summary-card-value ${c.colorClass}`}>{c.value}</p>
            </button>
          ))}
        </motion.div>

        {/* ── Filters ── */}
        <motion.div variants={fadeUp} className="alerts-filters">
          <span className="filters-heading">Filter:</span>

          <div className="filters-group">
            {['critical', 'high', 'medium', 'low'].map(sev => {
              const s = SEVERITY_STYLES[sev];
              const active = filters.severity === sev;
              return (
                <button
                  key={sev}
                  onClick={() => setFilters(f => ({ ...f, severity: active ? '' : sev }))}
                  className="filter-chip"
                  style={{
                    background:   active ? s.bg        : 'transparent',
                    border:       active ? `1px solid ${s.border}` : '1px solid transparent',
                    color:        active ? undefined   : 'var(--color-vemio-text-dim)',
                  }}
                >
                  <span style={active ? { color: s.text.replace('text-', 'var(--color-') + ')' } : {}}>
                    {sev}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="filters-divider">|</span>

          <div className="filters-group">
            {['device_down', 'sla_breach', 'bcs_drop'].map(t => {
              const active = filters.type === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilters(f => ({ ...f, type: active ? '' : t }))}
                  className="filter-chip"
                  style={{
                    background: active ? 'rgba(245,158,11,0.08)' : 'transparent',
                    border:     active ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                    color:      active ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)',
                  }}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>

          {(filters.state || filters.severity || filters.type) && (
            <button
              onClick={() => setFilters({ state: '', severity: '', type: '' })}
              className="filter-clear"
            >
              ✕ Clear
            </button>
          )}
        </motion.div>

        {/* ── Alert list ── */}
        <div className="alerts-list">
          <AnimatePresence mode="popLayout">
            {alerts.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="alerts-empty"
              >
                <CheckCircle2 className="w-10 h-10 text-status-up opacity-50" />
                <p className="text-vemio-text-muted text-sm">
                  {!filters.state && !filters.severity && !filters.type
                    ? 'All clear — no active alerts'
                    : 'No alerts matching current filters'}
                </p>
              </motion.div>
            ) : (
              alerts.map(a => <AlertRow key={a.id} alert={a} onAction={handleAction} />)
            )}
          </AnimatePresence>
        </div>

        {data?.pagination?.total > 50 && (
          <p className="alerts-pagination">
            Showing {alerts.length} of {data.pagination.total} alerts
          </p>
        )}
      </motion.div>

      <style>{`
      .alerts-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
        .alerts-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }

        /* ── Header ── */
        .alerts-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .alerts-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
        }
        .alerts-subtitle {
          font-size: 13px;
          color: var(--vemio-text-muted);
          margin: 3px 0 0;
        }
        .alerts-refresh-btn {
          padding: 6px 14px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--vemio-text-muted);
          border: 1px solid var(--color-vemio-border);
          border-radius: 6px;
          background: transparent;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .alerts-refresh-btn:hover {
          background: var(--color-vemio-surface-raised);
        }

        /* ── Summary cards ──
           5 across on desktop, 3+2 on tablet (auto-fill), 2+3 on mobile */
        .alerts-summary {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
        }
        @media (max-width: 1023px) {
          /* tablet: show as 3 + 2 using auto-fit with a min width */
          .alerts-summary {
            grid-template-columns: repeat(3, 1fr);
          }
          /* last 2 cards span differently — simpler to just allow 3-col wrapping */
        }
        @media (max-width: 767px) {
          .alerts-summary {
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
          }
        }

        .summary-card {
          border-radius: 10px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .summary-card--active {
          background: rgba(245,158,11,0.06);
          border-color: rgba(245,158,11,0.2);
        }
        .summary-card-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin: 0;
        }
        .summary-card-value {
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          margin: 4px 0 0;
        }
        @media (max-width: 479px) {
          .summary-card-value { font-size: 18px; }
        }

        /* ── Filters ── */
        .alerts-filters {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .filters-heading {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-right: 4px;
          white-space: nowrap;
        }
        .filters-group {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-wrap: wrap;
        }
        .filter-chip {
          padding: 4px 10px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          /* min touch target */
          min-height: 30px;
        }
        .filters-divider {
          color: var(--color-vemio-border);
          font-size: 14px;
          padding: 0 2px;
        }
        .filter-clear {
          padding: 4px 10px;
          font-size: 10px;
          color: var(--color-vemio-text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: color 0.15s;
        }
        .filter-clear:hover { color: var(--color-vemio-text); }

        /* ── Alert list ── */
        .alerts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .alerts-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 0;
          gap: 12px;
        }

        /* ── Alert row ── */
        .alert-row {
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          transition: background 0.15s;
        }
        @media (max-width: 479px) {
          .alert-row { padding: 12px; }
        }

        .alert-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .alert-sev-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .alert-sev-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .alert-sev-dot--pulse {
          animation: dsc-pulse 1.5s ease-in-out infinite;
        }
        @keyframes dsc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }

        .alert-state {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .alert-state--active   { color: var(--color-severity-high); }
        .alert-state--ack      { color: var(--vemio-amber); }
        .alert-state--resolved { color: var(--color-status-up); }
        .alert-state--dim      { color: var(--color-vemio-text-dim); }

        .alert-time {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          margin-left: auto;          /* push to far right */
        }

        .alert-title {
          font-size: 13.5px;
          font-weight: 500;
          color: var(--vemio-text);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .alert-details {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--color-vemio-text-muted);
        }
        .alert-details span { white-space: nowrap; }

        /* ── Actions
           On pointer (mouse) devices: hidden until hover via @media hover.
           On touch devices: always visible. ── */
        .alert-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }

        /* Hide on pointer devices until row is hovered */
        @media (hover: hover) and (pointer: fine) {
          .alert-actions {
            opacity: 0;
            transition: opacity 0.15s;
          }
          .alert-row:hover .alert-actions {
            opacity: 1;
          }
        }

        .alert-btn {
          padding: 4px 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.15s;
          min-height: 28px;
        }
        .alert-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .alert-btn--ack {
          color: var(--vemio-amber);
          border: 1px solid rgba(245,158,11,0.3);
          background: rgba(245,158,11,0.05);
        }
        .alert-btn--resolve {
          color: var(--color-status-up);
          border: 1px solid rgba(20,184,166,0.3);
          background: rgba(20,184,166,0.05);
        }

        /* ── Pagination ── */
        .alerts-pagination {
          text-align: center;
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }

        /* ── Mobile tightening ── */
        @media (max-width: 767px) {
          .alerts-root { gap: 14px; }
        }
      `}</style>
    </>
  );
}