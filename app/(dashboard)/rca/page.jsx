'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronRight, ChevronDown, Clock, LinkIcon } from 'lucide-react';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const CAUSE_LABELS = {
  hardware_failure:    'Hardware Failure',
  software_bug:        'Software Bug',
  configuration_error: 'Config Error',
  capacity:            'Capacity',
  external_dependency: 'External',
  human_error:         'Human Error',
  security_incident:   'Security',
  environmental:       'Environmental',
  isp_outage:          'ISP Outage',
  power_failure:       'Power Failure',
  other:               'Other',
};

const FOLLOWUP_STYLES = {
  pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: 'text-vemio-amber'      },
  completed: { label: 'Completed', bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)', text: 'text-status-up'        },
  overdue:   { label: 'Overdue',   bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: 'text-severity-high'    },
};

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60)  return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// ── RCA Detail ────────────────────────────────────────────────────────────────

function RCADetail({ rcaId }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/rca/${rcaId}`);
        if (res.ok) setDetail(await res.json());
      } catch (err) { console.error('RCA detail fetch:', err); }
      finally { setLoading(false); }
    }
    fetchDetail();
  }, [rcaId]);

  if (loading) {
    return (
      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
        className="overflow-hidden">
        <div className="px-5 pb-5 pt-2">
          <RefreshCw className="w-4 h-4 text-vemio-amber animate-spin" />
        </div>
      </motion.div>
    );
  }
  if (!detail) return null;

  const rca = detail.rca;
  let timeline = [];
  try {
    timeline = typeof rca.timeline === 'string' ? JSON.parse(rca.timeline) : (rca.timeline || []);
  } catch { timeline = []; }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="rca-detail-body">
        {/* Root Cause */}
        <div className="rca-detail-section">
          <p className="rca-detail-eyebrow">Root Cause</p>
          <p className="rca-detail-text">{rca.root_cause}</p>
        </div>

        {/* Impact */}
        {rca.impact_description && (
          <div className="rca-detail-section">
            <p className="rca-detail-eyebrow">Impact</p>
            <p className="rca-detail-muted">{rca.impact_description}</p>
          </div>
        )}

        {/* Actions — side by side on tablet+, stacked on mobile */}
        <div className="rca-actions-grid">
          {rca.immediate_action && (
            <div className="rca-action-card">
              <p className="rca-action-label rca-action-label--amber">Immediate Action</p>
              <p className="rca-action-text">{rca.immediate_action}</p>
            </div>
          )}
          {rca.preventive_action && (
            <div className="rca-action-card">
              <p className="rca-action-label rca-action-label--green">Preventive Action</p>
              <p className="rca-action-text">{rca.preventive_action}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div className="rca-detail-section">
            <p className="rca-detail-eyebrow">Timeline</p>
            <div className="rca-timeline">
              {timeline.map((entry, i) => (
                <div key={i} className="rca-timeline-row">
                  <span className="rca-timeline-time">{entry.time}</span>
                  <div className="rca-timeline-line">
                    <div className="rca-timeline-dot" />
                  </div>
                  <span className="rca-timeline-event">{entry.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Tickets */}
        {detail.linked_tickets?.length > 0 && (
          <div className="rca-detail-section">
            <p className="rca-detail-eyebrow">
              <LinkIcon className="w-3 h-3 inline mr-1" />
              Linked Tickets
            </p>
            <div className="rca-list">
              {detail.linked_tickets.map(tk => (
                <div key={tk.id} className="rca-list-row">
                  <span className="rca-list-id">#{tk.glpi_ticket_id}</span>
                  <span className="rca-list-title">{tk.title}</span>
                  <span className={`rca-list-status ${
                    tk.status === 'resolved' || tk.status === 'closed'
                      ? 'text-status-up' : 'text-vemio-amber'
                  }`}>{tk.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Alerts */}
        {detail.related_alerts?.length > 0 && (
          <div className="rca-detail-section">
            <p className="rca-detail-eyebrow">Related Alerts ({detail.related_alerts.length})</p>
            <div className="rca-list">
              {detail.related_alerts.slice(0, 5).map(al => (
                <div key={al.id} className="rca-list-row" style={{ opacity: 0.8 }}>
                  <span className={`rca-list-sev ${
                    al.severity === 'critical' ? 'text-severity-critical' :
                    al.severity === 'high'     ? 'text-severity-high'     : 'text-vemio-amber'
                  }`}>{al.severity}</span>
                  <span className="rca-list-title">{al.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up */}
        {rca.followup_due_date && (
          <div className="rca-action-card" style={{ marginTop: 0 }}>
            <p className="rca-detail-eyebrow">Follow-up</p>
            <p className="rca-action-text">
              <Clock className="w-3 h-3 inline mr-1" />
              Due: {new Date(rca.followup_due_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
            {rca.followup_notes && (
              <p className="rca-action-text" style={{ marginTop: 4 }}>{rca.followup_notes}</p>
            )}
          </div>
        )}

        <p className="rca-footer">
          Created by {rca.created_by} ·{' '}
          {new Date(rca.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
        </p>
      </div>

      <style>{`
        .rca-detail-body {
          padding: 16px 20px 20px;
          border-top: 1px solid var(--color-vemio-border);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (max-width: 479px) {
          .rca-detail-body { padding: 12px 14px 16px; }
        }

        .rca-detail-section { display: flex; flex-direction: column; gap: 6px; }

        .rca-detail-eyebrow {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0;
        }
        .rca-detail-text  { font-size: 13px; color: var(--vemio-text); line-height: 1.6; margin: 0; }
        .rca-detail-muted { font-size: 13px; color: var(--vemio-text-muted); line-height: 1.6; margin: 0; }

        /* Actions: 2-col on ≥480px, 1-col on mobile */
        .rca-actions-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 479px) {
          .rca-actions-grid { grid-template-columns: 1fr; }
        }

        .rca-action-card {
          border-radius: 8px;
          padding: 12px;
          background: var(--color-vemio-surface-raised);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .rca-action-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0;
        }
        .rca-action-label--amber { color: var(--vemio-amber); }
        .rca-action-label--green { color: var(--color-status-up); }
        .rca-action-text {
          font-size: 12px;
          color: var(--vemio-text-muted);
          line-height: 1.5;
          margin: 0;
        }

        /* Timeline */
        .rca-timeline { display: flex; flex-direction: column; gap: 8px; }
        .rca-timeline-row {
          display: flex;
          gap: 10px;
          font-size: 12px;
        }
        .rca-timeline-time {
          color: var(--color-vemio-text-dim);
          font-family: monospace;
          white-space: nowrap;
          min-width: 72px;
        }
        .rca-timeline-line {
          flex-shrink: 0;
          width: 1px;
          background: var(--color-vemio-border);
          position: relative;
        }
        .rca-timeline-dot {
          position: absolute;
          top: 4px;
          left: -3px;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
        }
        .rca-timeline-event {
          color: var(--vemio-text-muted);
          line-height: 1.5;
          flex: 1;
        }

        /* Linked lists */
        .rca-list { display: flex; flex-direction: column; gap: 4px; }
        .rca-list-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: var(--vemio-text-muted);
          border-radius: 6px;
          padding: 6px 10px;
          background: var(--color-vemio-surface-raised);
        }
        .rca-list-id {
          font-family: monospace;
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
        }
        .rca-list-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rca-list-status {
          font-size: 10px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .rca-list-sev {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          flex-shrink: 0;
        }

        .rca-footer {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          padding-top: 12px;
          border-top: 1px solid var(--color-vemio-border);
          margin: 0;
        }
      `}</style>
    </motion.div>
  );
}

// ── RCA Card ──────────────────────────────────────────────────────────────────

function RCACard({ rca, isSelected, onSelect }) {
  const cause    = CAUSE_LABELS[rca.cause_category] || 'Other';
  const followup = FOLLOWUP_STYLES[rca.followup_status] || FOLLOWUP_STYLES.pending;

  const duration = rca.incident_start_at && rca.incident_end_at
    ? formatDuration(new Date(rca.incident_end_at) - new Date(rca.incident_start_at))
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rca-card"
      style={{
        border: isSelected
          ? '1px solid rgba(245,158,11,0.25)'
          : '1px solid var(--color-vemio-border)',
      }}
      onClick={() => onSelect(isSelected ? null : rca.id)}
    >
      <div className="rca-card-inner">
        <div className="rca-card-body">
          <div className="rca-card-badges">
            <span
              className={`rca-badge ${followup.text}`}
              style={{ background: followup.bg, border: `1px solid ${followup.border}` }}
            >
              {followup.label}
            </span>
            <span className="rca-cause">{cause}</span>
          </div>

          <h3 className="rca-card-title">{rca.incident_title}</h3>

          <div className="rca-card-meta">
            {rca.site_name && <span>{rca.site_name}</span>}
            {rca.incident_start_at && (
              <span>{new Date(rca.incident_start_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}</span>
            )}
            {duration && <span>{duration}</span>}
            {rca.linked_tickets_count > 0 && (
              <span>{rca.linked_tickets_count} ticket{rca.linked_tickets_count > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {isSelected
          ? <ChevronDown  className="rca-chevron" />
          : <ChevronRight className="rca-chevron" />}
      </div>

      <AnimatePresence>
        {isSelected && <RCADetail rcaId={rca.id} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RCAPage() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const { selectedTenantId } = useTenantSwitcher();
  useEffect(() => {
    async function fetchRCAs() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        params.set('limit', '20');
        params.set('tenantId', selectedTenantId);
        const res = await fetch(`/api/rca?${params}`);
        if (res.ok) setData(await res.json());
      } catch (err) { console.error('RCA fetch:', err); }
      finally { setLoading(false); }
    }
    fetchRCAs();
  }, [statusFilter, selectedTenantId]);

  const rcas = data?.rca_reports || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="rca-root">
        {/* Header */}
        <motion.div variants={fadeUp} className="rca-header">
          <div>
            <h1 className="rca-title">Root Cause Analysis</h1>
            <p className="rca-subtitle">Incident investigations and corrective actions</p>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} className="rca-filters">
          <span className="rca-filter-heading">Status:</span>
          {[
            { val: '', label: 'All' },
            { val: 'pending',   label: 'Pending'   },
            { val: 'completed', label: 'Completed' },
            { val: 'overdue',   label: 'Overdue'   },
          ].map(s => {
            const fs     = s.val ? FOLLOWUP_STYLES[s.val] : null;
            const active = statusFilter === s.val;
            return (
              <button key={s.val} onClick={() => setStatusFilter(s.val)}
                className="rca-filter-btn"
                style={{
                  background: active ? (fs ? fs.bg   : 'rgba(245,158,11,0.08)') : 'transparent',
                  border:     active ? `1px solid ${fs ? fs.border : 'rgba(245,158,11,0.2)'}` : '1px solid transparent',
                  color:      active ? undefined : 'var(--color-vemio-text-dim)',
                }}>
                <span className={active && fs ? fs.text : ''}>{s.label}</span>
              </button>
            );
          })}
        </motion.div>

        {/* RCA List */}
        <div className="rca-list-root">
          {rcas.length === 0 ? (
            <motion.div variants={fadeUp} className="rca-empty">
              <p className="text-vemio-text-muted text-sm">No RCA reports found</p>
              <p className="text-vemio-text-dim text-xs">
                RCA reports are created by the NOC team after significant incidents
              </p>
            </motion.div>
          ) : (
            rcas.map(rca => (
              <RCACard key={rca.id} rca={rca}
                isSelected={selectedId === rca.id}
                onSelect={setSelectedId} />
            ))
          )}
        </div>

        {data?.pagination?.total > 20 && (
          <p className="rca-pagination">
            Showing {rcas.length} of {data.pagination.total} reports
          </p>
        )}
      </motion.div>

      <style>{`
        .rca-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }
        @media (max-width: 767px) { .rca-root { gap: 14px; } }

        .rca-header { display: flex; flex-direction: column; gap: 4px; }
        .rca-title  { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .rca-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }

        /* Filters */
        .rca-filters {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .rca-filter-heading {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-right: 4px;
        }
        .rca-filter-btn {
          padding: 4px 10px;
          font-size: 10px;
          border-radius: 6px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          transition: background 0.15s;
          min-height: 30px;
        }

        /* List */
        .rca-list-root { display: flex; flex-direction: column; gap: 10px; }
        .rca-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px 0;
          gap: 8px;
          text-align: center;
        }

        /* Card */
        .rca-card {
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          background: var(--color-vemio-surface);
          transition: border-color 0.15s;
        }
        .rca-card-inner {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
        }
        @media (max-width: 479px) { .rca-card-inner { padding: 12px 14px; } }

        .rca-card-body { flex: 1; min-width: 0; }

        .rca-card-badges {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .rca-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .rca-cause {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
        }
        .rca-card-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0 0 8px;
          line-height: 1.4;
          /* Allow wrapping — titles can be long */
        }
        .rca-card-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          font-size: 11px;
          color: var(--vemio-text-muted);
        }
        .rca-chevron {
          width: 16px;
          height: 16px;
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .rca-pagination {
          text-align: center;
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
      `}</style>
    </>
  );
}