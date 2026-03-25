'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2 } from 'lucide-react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const SEVERITY_STYLES = {
  critical: { dot: 'bg-severity-critical', text: 'text-severity-critical', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  high:     { dot: 'bg-severity-high', text: 'text-severity-high', bg: 'rgba(234,88,12,0.08)', border: 'rgba(234,88,12,0.2)' },
  medium:   { dot: 'bg-vemio-amber', text: 'text-vemio-amber', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  low:      { dot: 'bg-status-up', text: 'text-status-up', bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)' },
};

function getTimeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function AlertRow({ alert, onAction }) {
  const [acting, setActing] = useState(false);
  const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.medium;

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
      className="group rounded-xl p-4 transition-all"
      style={{
        background: alert.state === 'active' ? 'var(--color-vemio-surface)' : 'var(--color-vemio-surface-raised)',
        border: `1px solid ${alert.state === 'active' ? 'var(--color-vemio-border)' : 'transparent'}`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            {/* Severity badge */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: sev.bg, border: `1px solid ${sev.border}` }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sev.dot} ${alert.severity === 'critical' ? 'animate-pulse' : ''}`} />
              <span className={sev.text}>{alert.severity}</span>
            </span>
            {/* State */}
            <span className={`text-[10px] font-medium uppercase tracking-wider ${
              alert.state === 'active' ? 'text-severity-high' :
              alert.state === 'acknowledged' ? 'text-vemio-amber' :
              alert.state === 'resolved' ? 'text-status-up' : 'text-vemio-text-dim'
            }`}>
              {alert.state === 'acknowledged' ? 'Ack' : alert.state}
            </span>
            <span className="text-[10px] text-vemio-text-dim">{getTimeAgo(alert.triggered_at)}</span>
          </div>
          <p className="text-sm text-vemio-text font-medium truncate">{alert.title}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-vemio-text-muted">
            {alert.device_name && <span>{alert.device_name}</span>}
            {alert.site_name && <span>{alert.site_name}</span>}
            <span className="text-vemio-text-dim">{alert.alert_type?.replace(/_/g, ' ')}</span>
          </div>
        </div>

        {(alert.state === 'active' || alert.state === 'acknowledged') && (
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {alert.state === 'active' && (
              <button onClick={() => handleAction('acknowledge')} disabled={acting}
                className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-vemio-amber rounded transition-all disabled:opacity-50"
                style={{ border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
                Ack
              </button>
            )}
            <button onClick={() => handleAction('resolve')} disabled={acting}
              className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-status-up rounded transition-all disabled:opacity-50"
              style={{ border: '1px solid rgba(20,184,166,0.3)', background: 'rgba(20,184,166,0.05)' }}>
              Resolve
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AlertsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ state: '', severity: '', type: '' });

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.state) params.set('state', filters.state);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.type) params.set('type', filters.type);
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
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action }),
      });
      if (res.ok) await fetchAlerts();
    } catch (err) { console.error('Action failed:', err); }
  }

  const summary = data?.summary || {};
  const alerts = data?.alerts || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Alerts</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">Real-time infrastructure alerts and notifications</p>
        </div>
        <button onClick={fetchAlerts}
          className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-vemio-text-muted rounded-md transition-all"
          style={{ border: '1px solid var(--color-vemio-border)' }}>
          Refresh
        </button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Active', value: summary.active || 0, color: 'text-severity-high', key: 'active' },
          { label: 'Critical', value: summary.critical_active || 0, color: 'text-severity-critical', key: '' },
          { label: 'Acknowledged', value: summary.acknowledged || 0, color: 'text-vemio-amber', key: 'acknowledged' },
          { label: 'Resolved 24h', value: summary.resolved_24h || 0, color: 'text-status-up', key: 'resolved' },
          { label: 'Suppressed', value: summary.suppressed || 0, color: 'text-vemio-text-dim', key: 'suppressed' },
        ].map(c => (
          <button key={c.label}
            onClick={() => c.key && setFilters(f => ({ ...f, state: f.state === c.key ? '' : c.key }))}
            className="rounded-xl p-3 text-left transition-all"
            style={{
              background: filters.state === c.key ? 'rgba(245,158,11,0.06)' : 'var(--color-vemio-surface)',
              border: filters.state === c.key ? '1px solid rgba(245,158,11,0.2)' : '1px solid var(--color-vemio-border)',
            }}>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${c.color}`}>{c.value}</p>
          </button>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-vemio-text-dim uppercase tracking-wider mr-2">Filter:</span>
        {['critical', 'high', 'medium', 'low'].map(sev => {
          const s = SEVERITY_STYLES[sev] || SEVERITY_STYLES.medium;
          return (
            <button key={sev}
              onClick={() => setFilters(f => ({ ...f, severity: f.severity === sev ? '' : sev }))}
              className="px-2.5 py-1 text-[10px] rounded uppercase tracking-wider transition-all"
              style={{
                background: filters.severity === sev ? s.bg : 'transparent',
                border: filters.severity === sev ? `1px solid ${s.border}` : '1px solid transparent',
                color: filters.severity === sev ? undefined : 'var(--color-vemio-text-dim)',
              }}>
              <span className={filters.severity === sev ? s.text : ''}>{sev}</span>
            </button>
          );
        })}
        <span className="text-vemio-border mx-1">|</span>
        {['device_down', 'sla_breach', 'bcs_drop'].map(t => (
          <button key={t}
            onClick={() => setFilters(f => ({ ...f, type: f.type === t ? '' : t }))}
            className="px-2.5 py-1 text-[10px] rounded uppercase tracking-wider transition-all"
            style={{
              background: filters.type === t ? 'rgba(245,158,11,0.08)' : 'transparent',
              border: filters.type === t ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
              color: filters.type === t ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)',
            }}>
            {t.replace(/_/g, ' ')}
          </button>
        ))}
        {(filters.state || filters.severity || filters.type) && (
          <button onClick={() => setFilters({ state: '', severity: '', type: '' })}
            className="px-2.5 py-1 text-[10px] text-vemio-text-muted hover:text-vemio-text transition-colors">
            ✕ Clear
          </button>
        )}
      </motion.div>

      {/* Alert List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {alerts.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 gap-3">
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
        <p className="text-center text-[10px] text-vemio-text-dim uppercase tracking-wider">
          Showing {alerts.length} of {data.pagination.total} alerts
        </p>
      )}
    </motion.div>
  );
}