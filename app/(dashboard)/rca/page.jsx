'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronRight, ChevronDown, Clock, LinkIcon } from 'lucide-react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const CAUSE_LABELS = {
  hardware_failure: 'Hardware Failure',
  software_bug: 'Software Bug',
  configuration_error: 'Config Error',
  capacity: 'Capacity',
  external_dependency: 'External',
  human_error: 'Human Error',
  security_incident: 'Security',
  environmental: 'Environmental',
  isp_outage: 'ISP Outage',
  power_failure: 'Power Failure',
  other: 'Other',
};

const FOLLOWUP_STYLES = {
  pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: 'text-vemio-amber' },
  completed: { label: 'Completed', bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)', text: 'text-status-up' },
  overdue:   { label: 'Overdue',   bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)',  text: 'text-severity-high' },
};

function formatDuration(ms) {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

// ── RCA Detail (expandable) ─────────────────────────────────────────────────

function RCADetail({ rcaId }) {
  const [detail, setDetail] = useState(null);
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
      <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid var(--color-vemio-border)' }}>
        {/* Root Cause */}
        <div className="pt-4">
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-1.5">Root Cause</p>
          <p className="text-sm text-vemio-text leading-relaxed">{rca.root_cause}</p>
        </div>

        {/* Impact */}
        {rca.impact_description && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-1.5">Impact</p>
            <p className="text-sm text-vemio-text-muted leading-relaxed">{rca.impact_description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rca.immediate_action && (
            <div className="rounded-lg p-3" style={{ background: 'var(--color-vemio-surface-raised)' }}>
              <p className="text-[10px] text-vemio-amber uppercase tracking-widest mb-1.5">Immediate Action</p>
              <p className="text-xs text-vemio-text-muted leading-relaxed">{rca.immediate_action}</p>
            </div>
          )}
          {rca.preventive_action && (
            <div className="rounded-lg p-3" style={{ background: 'var(--color-vemio-surface-raised)' }}>
              <p className="text-[10px] text-status-up uppercase tracking-widest mb-1.5">Preventive Action</p>
              <p className="text-xs text-vemio-text-muted leading-relaxed">{rca.preventive_action}</p>
            </div>
          )}
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">Timeline</p>
            <div className="space-y-2">
              {timeline.map((entry, i) => (
                <div key={i} className="flex gap-3 text-xs">
                  <span className="text-vemio-text-dim font-mono whitespace-nowrap min-w-[4.5rem]">
                    {entry.time}
                  </span>
                  <div className="flex-shrink-0 w-px relative" style={{ background: 'var(--color-vemio-border)' }}>
                    <div className="absolute top-1 -left-[3px] w-[7px] h-[7px] rounded-full"
                      style={{ background: 'var(--color-vemio-surface-raised)', border: '1px solid var(--color-vemio-border)' }} />
                  </div>
                  <span className="text-vemio-text-muted leading-relaxed">{entry.event}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Linked Tickets */}
        {detail.linked_tickets?.length > 0 && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">
              <LinkIcon className="w-3 h-3 inline mr-1" />
              Linked Tickets
            </p>
            <div className="space-y-1">
              {detail.linked_tickets.map(tk => (
                <div key={tk.id} className="flex items-center gap-3 text-xs text-vemio-text-muted rounded px-3 py-1.5"
                  style={{ background: 'var(--color-vemio-surface-raised)' }}>
                  <span className="text-vemio-text-dim font-mono">#{tk.glpi_ticket_id}</span>
                  <span className="flex-1 truncate">{tk.title}</span>
                  <span className={`text-[10px] uppercase ${
                    tk.status === 'resolved' || tk.status === 'closed' ? 'text-status-up' : 'text-vemio-amber'
                  }`}>{tk.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Alerts */}
        {detail.related_alerts?.length > 0 && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">
              Related Alerts ({detail.related_alerts.length})
            </p>
            <div className="space-y-1">
              {detail.related_alerts.slice(0, 5).map(al => (
                <div key={al.id} className="flex items-center gap-3 text-xs text-vemio-text-muted rounded px-3 py-1.5"
                  style={{ background: 'var(--color-vemio-surface-raised)', opacity: 0.8 }}>
                  <span className={`text-[10px] uppercase font-semibold ${
                    al.severity === 'critical' ? 'text-severity-critical' :
                    al.severity === 'high' ? 'text-severity-high' : 'text-vemio-amber'
                  }`}>{al.severity}</span>
                  <span className="flex-1 truncate">{al.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Followup */}
        {rca.followup_due_date && (
          <div className="rounded-lg p-3" style={{ background: 'var(--color-vemio-surface-raised)' }}>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-1">Follow-up</p>
            <p className="text-xs text-vemio-text-muted">
              <Clock className="w-3 h-3 inline mr-1" />
              Due: {new Date(rca.followup_due_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
            {rca.followup_notes && <p className="text-xs text-vemio-text-dim mt-1">{rca.followup_notes}</p>}
          </div>
        )}

        <p className="text-[10px] text-vemio-text-dim pt-2" style={{ borderTop: '1px solid var(--color-vemio-border)' }}>
          Created by {rca.created_by} · {new Date(rca.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
        </p>
      </div>
    </motion.div>
  );
}

// ── RCA Card ────────────────────────────────────────────────────────────────

function RCACard({ rca, isSelected, onSelect }) {
  const cause = CAUSE_LABELS[rca.cause_category] || 'Other';
  const followup = FOLLOWUP_STYLES[rca.followup_status] || FOLLOWUP_STYLES.pending;

  const duration = rca.incident_start_at && rca.incident_end_at
    ? formatDuration(new Date(rca.incident_end_at) - new Date(rca.incident_start_at))
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{
        background: isSelected ? 'var(--color-vemio-surface)' : 'var(--color-vemio-surface)',
        border: isSelected ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--color-vemio-border)',
      }}
      onClick={() => onSelect(isSelected ? null : rca.id)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${followup.text}`}
                style={{ background: followup.bg, border: `1px solid ${followup.border}` }}
              >
                {followup.label}
              </span>
              <span className="text-[10px] text-vemio-text-dim">{cause}</span>
            </div>
            <h3 className="text-sm font-semibold text-vemio-text leading-snug">{rca.incident_title}</h3>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-vemio-text-muted">
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
            ? <ChevronDown className="w-4 h-4 text-vemio-text-dim shrink-0" />
            : <ChevronRight className="w-4 h-4 text-vemio-text-dim shrink-0" />
          }
        </div>
      </div>

      <AnimatePresence>
        {isSelected && <RCADetail rcaId={rca.id} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function RCAPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    async function fetchRCAs() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set('status', statusFilter);
        params.set('limit', '20');
        const res = await fetch(`/api/rca?${params}`);
        if (res.ok) setData(await res.json());
      } catch (err) { console.error('RCA fetch:', err); }
      finally { setLoading(false); }
    }
    fetchRCAs();
  }, [statusFilter]);

  const rcas = data?.rca_reports || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Root Cause Analysis</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">Incident investigations and corrective actions</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex items-center gap-2">
        <span className="text-[10px] text-vemio-text-dim uppercase tracking-wider mr-2">Status:</span>
        {[
          { val: '', label: 'All' },
          { val: 'pending', label: 'Pending' },
          { val: 'completed', label: 'Completed' },
          { val: 'overdue', label: 'Overdue' },
        ].map(s => {
          const fs = s.val ? FOLLOWUP_STYLES[s.val] : null;
          return (
            <button key={s.val} onClick={() => setStatusFilter(s.val)}
              className="px-2.5 py-1 text-[10px] rounded uppercase tracking-wider transition-all"
              style={{
                background: statusFilter === s.val
                  ? (fs ? fs.bg : 'rgba(245,158,11,0.08)')
                  : 'transparent',
                border: statusFilter === s.val
                  ? `1px solid ${fs ? fs.border : 'rgba(245,158,11,0.2)'}`
                  : '1px solid transparent',
                color: statusFilter === s.val
                  ? undefined
                  : 'var(--color-vemio-text-dim)',
              }}>
              <span className={statusFilter === s.val && fs ? fs.text : ''}>{s.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* RCA List */}
      <div className="space-y-3">
        {rcas.length === 0 ? (
          <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-vemio-text-muted text-sm">No RCA reports found</p>
            <p className="text-vemio-text-dim text-xs">
              RCA reports are created by the NOC team after significant incidents
            </p>
          </motion.div>
        ) : (
          rcas.map(rca => (
            <RCACard key={rca.id} rca={rca} isSelected={selectedId === rca.id} onSelect={setSelectedId} />
          ))
        )}
      </div>

      {data?.pagination?.total > 20 && (
        <p className="text-center text-[10px] text-vemio-text-dim uppercase tracking-wider">
          Showing {rcas.length} of {data.pagination.total} reports
        </p>
      )}
    </motion.div>
  );
}