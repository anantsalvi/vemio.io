'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Shield, Server, RefreshCw, Plus, Trash2,
  Calendar, Mail, ToggleLeft, ToggleRight, Clock,
} from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const REPORT_TYPES = [
  { key: 'sla',           label: 'SLA Compliance',  icon: FileText },
  { key: 'bcs',           label: 'BCS Summary',      icon: Shield   },
  { key: 'device_health', label: 'Device Health',    icon: Server   },
];

const FREQUENCIES = [
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
];

const DAYS_OF_WEEK  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

function formatNextRun(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  }) + ' IST';
}

function ReportTypeIcon({ type, className }) {
  const rt = REPORT_TYPES.find(r => r.key === type);
  if (!rt) return null;
  const Icon = rt.icon;
  return <Icon className={className} />;
}

// ── New Schedule Form ─────────────────────────────────────────────────────────

function NewScheduleForm({ onSave, onCancel }) {
  const [form, setForm] = useState({
    report_type:  'sla',
    frequency:    'monthly',
    day_of_week:  1,
    day_of_month: 1,
    recipients:   [],
  });
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);

  function addEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Invalid email'); return; }
    if (form.recipients.includes(email)) { setEmailError('Already added'); return; }
    setForm(f => ({ ...f, recipients: [...f.recipients, email] }));
    setEmailInput('');
    setEmailError('');
  }

  async function handleSave() {
    if (form.recipients.length === 0) { setEmailError('Add at least one recipient'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/reports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      onSave(json.scheduled_report);
    } catch { /* TODO toast */ }
    finally { setSaving(false); }
  }

  return (
    <div className="rs-form">
      <p className="rs-form-title">New Scheduled Report</p>

      {/* Report type */}
      <div className="rs-field">
        <label className="rs-label">Report Type</label>
        <div className="rs-type-row">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            return (
              <button key={rt.key}
                onClick={() => setForm(f => ({ ...f, report_type: rt.key }))}
                className={`rs-type-btn ${form.report_type === rt.key ? 'rs-type-btn--active' : ''}`}>
                <Icon className="w-3.5 h-3.5" />
                {rt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Frequency */}
      <div className="rs-field">
        <label className="rs-label">Frequency</label>
        <div className="rs-type-row">
          {FREQUENCIES.map(f => (
            <button key={f.value}
              onClick={() => setForm(fr => ({ ...fr, frequency: f.value }))}
              className={`rs-type-btn ${form.frequency === f.value ? 'rs-type-btn--active' : ''}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Day picker */}
      <div className="rs-field">
        <label className="rs-label">
          {form.frequency === 'weekly' ? 'Day of Week' : 'Day of Month'}
        </label>
        {form.frequency === 'weekly' ? (
          <select value={form.day_of_week}
            onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
            className="rs-select">
            {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        ) : (
          <select value={form.day_of_month}
            onChange={e => setForm(f => ({ ...f, day_of_month: parseInt(e.target.value) }))}
            className="rs-select">
            {DAYS_OF_MONTH.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Recipients */}
      <div className="rs-field">
        <label className="rs-label">Recipients</label>
        <div className="rs-recipient-list">
          {form.recipients.map(email => (
            <span key={email} className="rs-recipient-chip">
              {email}
              <button onClick={() => setForm(f => ({ ...f, recipients: f.recipients.filter(e => e !== email) }))}
                className="rs-chip-remove">×</button>
            </span>
          ))}
        </div>
        <div className="rs-email-add">
          <input type="email" placeholder="recipient@company.com"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
            onKeyDown={e => e.key === 'Enter' && addEmail()}
            className={`rs-email-input ${emailError ? 'rs-email-input--error' : ''}`} />
          <button onClick={addEmail} className="rs-add-email-btn">Add</button>
        </div>
        {emailError && <p className="rs-error">{emailError}</p>}
      </div>

      {/* Actions */}
      <div className="rs-form-actions">
        <button onClick={onCancel} className="rs-cancel-btn">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="rs-save-btn">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          Save Schedule
        </button>
      </div>
    </div>
  );
}

// ── Schedule Card ─────────────────────────────────────────────────────────────

function ScheduleCard({ schedule, onToggle, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const rt = REPORT_TYPES.find(r => r.key === schedule.report_type);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/settings/reports/${schedule.id}`, { method: 'DELETE' });
      onDelete(schedule.id);
    } catch { /* TODO toast */ }
    finally { setDeleting(false); }
  }

  async function handleToggle() {
    try {
      await fetch(`/api/settings/reports/${schedule.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ is_active: !schedule.is_active }),
      });
      onToggle(schedule.id, !schedule.is_active);
    } catch { /* TODO toast */ }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rs-card"
      style={{ opacity: schedule.is_active ? 1 : 0.55 }}
    >
      <div className="rs-card-top">
        <div className="rs-card-left">
          <div className="rs-card-icon-wrap">
            <ReportTypeIcon type={schedule.report_type} className="w-4 h-4 text-vemio-amber" />
          </div>
          <div>
            <p className="rs-card-name">{rt?.label ?? schedule.report_type}</p>
            <div className="rs-card-meta">
              <span className="rs-meta-chip">
                <Calendar className="w-3 h-3" />
                {schedule.frequency === 'weekly'
                  ? `Every ${DAYS_OF_WEEK[schedule.day_of_week] ?? 'Monday'}`
                  : `Monthly on day ${schedule.day_of_month}`}
              </span>
              <span className="rs-meta-chip">
                <Clock className="w-3 h-3" />
                08:00 IST
              </span>
            </div>
          </div>
        </div>

        <div className="rs-card-actions">
          <button onClick={handleToggle} className="rs-toggle-btn" title={schedule.is_active ? 'Pause' : 'Resume'}>
            {schedule.is_active
              ? <ToggleRight className="w-5 h-5 text-vemio-amber" />
              : <ToggleLeft  className="w-5 h-5 text-vemio-text-dim" />}
          </button>
          <button onClick={handleDelete} disabled={deleting} className="rs-delete-btn">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recipients */}
      <div className="rs-card-recipients">
        <Mail className="w-3 h-3 text-vemio-text-dim flex-shrink-0 mt-0.5" />
        <p className="rs-recipients-text">{schedule.recipients.join(', ')}</p>
      </div>

      {/* Next run */}
      <p className="rs-next-run">
        {schedule.is_active
          ? `Next run: ${formatNextRun(schedule.next_run_at)}`
          : 'Paused'}
        {schedule.last_sent_at && (
          <span> · Last sent: {formatNextRun(schedule.last_sent_at)}</span>
        )}
      </p>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportSchedulingPage() {
  const [schedules,   setSchedules]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setSchedules(json.scheduled_reports || []);
      } catch { /* TODO toast */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function handleSaved(newSchedule) {
    setSchedules(s => [...s, newSchedule]);
    setShowForm(false);
  }

  function handleToggle(id, is_active) {
    setSchedules(s => s.map(r => r.id === id ? { ...r, is_active } : r));
  }

  function handleDelete(id) {
    setSchedules(s => s.filter(r => r.id !== id));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-5 h-5 text-vemio-amber animate-spin" />
    </div>
  );

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="rs-root">

        {/* Header */}
        <motion.div variants={fadeUp} className="rs-header">
          <div>
            <h1 className="rs-title">Report Scheduling</h1>
            <p className="rs-subtitle">Automatically generate and email PDF reports to your team</p>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="rs-new-btn">
              <Plus className="w-4 h-4" /> New Schedule
            </button>
          )}
        </motion.div>

        {/* New form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <NewScheduleForm onSave={handleSaved} onCancel={() => setShowForm(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Schedule list */}
        {schedules.length === 0 && !showForm ? (
          <motion.div variants={fadeUp} className="rs-empty">
            <Calendar className="w-10 h-10 text-vemio-text-dim opacity-40" />
            <p className="text-vemio-text-muted text-sm">No scheduled reports yet</p>
            <p className="text-vemio-text-dim text-xs">Click "New Schedule" to set up automatic PDF delivery</p>
          </motion.div>
        ) : (
          <div className="rs-list">
            <AnimatePresence mode="popLayout">
              {schedules.map(s => (
                <ScheduleCard key={s.id} schedule={s}
                  onToggle={handleToggle} onDelete={handleDelete} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Info box */}
        <motion.div variants={fadeUp} className="rs-info-box">
          <p className="rs-info-title">How scheduled reports work</p>
          <p className="rs-info-text">
            Reports are generated at 08:00 IST on the configured day. The PDF is emailed to all
            recipients via Azure Communication Services and saved to the report history.
            Reports cover the previous calendar month for monthly schedules, or the previous
            7 days for weekly schedules.
          </p>
        </motion.div>
      </motion.div>

      <style>{`
        .rs-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 860px;
        }
        @media (max-width: 767px) { .rs-root { gap: 14px; } }

        .rs-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .rs-title    { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .rs-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }

        .rs-new-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-amber);
          color: #0F172A;
          white-space: nowrap;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .rs-new-btn:hover { opacity: 0.88; }

        /* New schedule form */
        .rs-form {
          background: var(--color-vemio-surface);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 14px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .rs-form-title {
          font-size: 14px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
        }
        .rs-field { display: flex; flex-direction: column; gap: 8px; }
        .rs-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--vemio-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
        .rs-type-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .rs-type-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text-muted);
          transition: background 0.15s, border-color 0.15s, color 0.15s;
          min-height: 34px;
        }
        .rs-type-btn--active {
          background: rgba(245,158,11,0.10);
          border-color: rgba(245,158,11,0.3);
          color: var(--vemio-amber);
        }
        .rs-select {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text);
          outline: none;
          cursor: pointer;
          width: fit-content;
          min-width: 180px;
        }
        .rs-recipient-list {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          min-height: 10px;
        }
        .rs-recipient-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px 3px 10px;
          border-radius: 20px;
          font-size: 12px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.2);
          color: var(--vemio-amber);
        }
        .rs-chip-remove {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--vemio-amber);
          font-size: 14px;
          line-height: 1;
          padding: 0 1px;
          opacity: 0.7;
        }
        .rs-chip-remove:hover { opacity: 1; }
        .rs-email-add {
          display: flex;
          gap: 8px;
        }
        .rs-email-input {
          flex: 1;
          padding: 8px 12px;
          font-size: 13px;
          border-radius: 8px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text);
          outline: none;
          transition: border-color 0.15s;
        }
        .rs-email-input:focus { border-color: rgba(245,158,11,0.4); }
        .rs-email-input--error { border-color: rgba(239,68,68,0.5); }
        .rs-add-email-btn {
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text-muted);
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .rs-add-email-btn:hover { background: var(--color-vemio-border); }
        .rs-error {
          font-size: 11px;
          color: var(--color-severity-high);
          margin: 0;
        }
        .rs-form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding-top: 4px;
          border-top: 1px solid var(--color-vemio-border);
        }
        .rs-cancel-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          background: transparent;
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text-muted);
          transition: background 0.15s;
        }
        .rs-cancel-btn:hover { background: var(--color-vemio-surface-raised); }
        .rs-save-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-amber);
          color: #0F172A;
          transition: opacity 0.15s;
        }
        .rs-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Schedule cards */
        .rs-list { display: flex; flex-direction: column; gap: 10px; }
        .rs-card {
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          border-radius: 12px;
          padding: 16px;
          transition: opacity 0.2s;
        }
        .rs-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .rs-card-left {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 0;
        }
        .rs-card-icon-wrap {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .rs-card-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0 0 6px;
        }
        .rs-card-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .rs-meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--vemio-text-muted);
          background: var(--color-vemio-surface-raised);
          padding: 2px 8px;
          border-radius: 6px;
        }
        .rs-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .rs-toggle-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .rs-toggle-btn:hover { background: var(--color-vemio-surface-raised); }
        .rs-delete-btn {
          padding: 6px;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.15s, border-color 0.15s;
        }
        .rs-delete-btn:hover { color: var(--color-severity-high); border-color: rgba(239,68,68,0.3); }
        .rs-delete-btn:disabled { opacity: 0.4; }

        .rs-card-recipients {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin-bottom: 6px;
        }
        .rs-recipients-text {
          font-size: 12px;
          color: var(--vemio-text-muted);
          margin: 0;
          word-break: break-all;
        }
        .rs-next-run {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 0;
        }

        /* Empty state */
        .rs-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 56px 0;
          gap: 10px;
          text-align: center;
        }

        /* Info box */
        .rs-info-box {
          padding: 14px 16px;
          border-radius: 10px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
        }
        .rs-info-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--vemio-text-muted);
          margin: 0 0 6px;
        }
        .rs-info-text {
          font-size: 12px;
          color: var(--color-vemio-text-dim);
          line-height: 1.6;
          margin: 0;
        }
      `}</style>
    </>
  );
}