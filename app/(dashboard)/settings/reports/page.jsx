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

/* ── Shared button styles ──────────────────────────────────────────────── */

function AmberButton({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold
                  cursor-pointer border-none whitespace-nowrap shrink-0 transition-opacity
                  disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ background: 'var(--color-vemio-amber)', color: '#0F172A' }}
    >
      {children}
    </button>
  );
}

function ChipButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg text-xs font-medium
                 cursor-pointer transition-colors min-h-[34px] border"
      style={{
        background: active ? 'rgba(245,158,11,0.10)' : 'var(--color-vemio-surface-raised)',
        borderColor: active ? 'rgba(245,158,11,0.3)' : 'var(--color-vemio-border)',
        color: active ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-muted)',
      }}
    >
      {children}
    </button>
  );
}

/* ── New Schedule Form ─────────────────────────────────────────────────── */

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
    <div
      className="rounded-[14px] p-5 flex flex-col gap-4"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid rgba(245,158,11,0.25)',
      }}
    >
      <p className="text-sm font-bold m-0 text-vemio-text">New Scheduled Report</p>

      {/* Report type */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-vemio-text-muted">
          Report Type
        </label>
        <div className="flex gap-2 flex-wrap">
          {REPORT_TYPES.map(rt => {
            const Icon = rt.icon;
            return (
              <ChipButton
                key={rt.key}
                active={form.report_type === rt.key}
                onClick={() => setForm(f => ({ ...f, report_type: rt.key }))}
              >
                <Icon className="w-3.5 h-3.5" />
                {rt.label}
              </ChipButton>
            );
          })}
        </div>
      </div>

      {/* Frequency */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-vemio-text-muted">
          Frequency
        </label>
        <div className="flex gap-2 flex-wrap">
          {FREQUENCIES.map(f => (
            <ChipButton
              key={f.value}
              active={form.frequency === f.value}
              onClick={() => setForm(fr => ({ ...fr, frequency: f.value }))}
            >
              {f.label}
            </ChipButton>
          ))}
        </div>
      </div>

      {/* Day picker */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-vemio-text-muted">
          {form.frequency === 'weekly' ? 'Day of Week' : 'Day of Month'}
        </label>
        {form.frequency === 'weekly' ? (
          <select
            value={form.day_of_week}
            onChange={e => setForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}
            className="px-3 py-2 rounded-lg text-[13px] outline-none cursor-pointer w-fit min-w-[180px]"
            style={{
              background: 'var(--color-vemio-surface-raised)',
              border: '1px solid var(--color-vemio-border)',
              color: 'var(--color-vemio-text)',
            }}
          >
            {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        ) : (
          <select
            value={form.day_of_month}
            onChange={e => setForm(f => ({ ...f, day_of_month: parseInt(e.target.value) }))}
            className="px-3 py-2 rounded-lg text-[13px] outline-none cursor-pointer w-fit min-w-[180px]"
            style={{
              background: 'var(--color-vemio-surface-raised)',
              border: '1px solid var(--color-vemio-border)',
              color: 'var(--color-vemio-text)',
            }}
          >
            {DAYS_OF_MONTH.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Recipients */}
      <div className="flex flex-col gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-vemio-text-muted">
          Recipients
        </label>

        {/* Chips */}
        {form.recipients.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {form.recipients.map(email => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 pl-2.5 pr-2 py-0.5 rounded-full text-xs"
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  color: 'var(--color-vemio-amber)',
                }}
              >
                {email}
                <button
                  onClick={() => setForm(f => ({ ...f, recipients: f.recipients.filter(e => e !== email) }))}
                  className="bg-transparent border-none cursor-pointer text-sm leading-none p-0 opacity-70
                             hover:opacity-100"
                  style={{ color: 'var(--color-vemio-amber)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Email input */}
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="recipient@company.com"
            value={emailInput}
            onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
            onKeyDown={e => e.key === 'Enter' && addEmail()}
            className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none transition-[border-color]"
            style={{
              background: 'var(--color-vemio-surface-raised)',
              border: emailError
                ? '1px solid rgba(239,68,68,0.5)'
                : '1px solid var(--color-vemio-border)',
              color: 'var(--color-vemio-text)',
            }}
            onFocus={e => { if (!emailError) e.target.style.borderColor = 'rgba(245,158,11,0.4)'; }}
            onBlur={e =>  { if (!emailError) e.target.style.borderColor = 'var(--color-vemio-border)'; }}
          />
          <button
            onClick={addEmail}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap
                       cursor-pointer transition-colors border"
            style={{
              background: 'var(--color-vemio-surface-raised)',
              borderColor: 'var(--color-vemio-border)',
              color: 'var(--color-vemio-text-muted)',
            }}
          >
            Add
          </button>
        </div>
        {emailError && <p className="text-[11px] m-0 text-severity-high">{emailError}</p>}
      </div>

      {/* Actions */}
      <div
        className="flex gap-2.5 justify-end pt-1"
        style={{ borderTop: '1px solid var(--color-vemio-border)' }}
      >
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer
                     bg-transparent transition-colors border"
          style={{
            borderColor: 'var(--color-vemio-border)',
            color: 'var(--color-vemio-text-muted)',
          }}
        >
          Cancel
        </button>
        <AmberButton onClick={handleSave} disabled={saving}>
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
          Save Schedule
        </AmberButton>
      </div>
    </div>
  );
}

/* ── Schedule Card ─────────────────────────────────────────────────────── */

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
      className="rounded-xl p-4 transition-opacity"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
        opacity: schedule.is_active ? 1 : 0.55,
      }}
    >
      {/* Top row: icon + name + meta | actions */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-start gap-3 min-w-0">
          {/* Icon badge */}
          <div
            className="w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <ReportTypeIcon type={schedule.report_type} className="w-4 h-4 text-vemio-amber" />
          </div>
          <div>
            <p className="text-sm font-semibold m-0 mb-1.5 text-vemio-text">
              {rt?.label ?? schedule.report_type}
            </p>
            <div className="flex gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md text-vemio-text-muted"
                style={{ background: 'var(--color-vemio-surface-raised)' }}
              >
                <Calendar className="w-3 h-3" />
                {schedule.frequency === 'weekly'
                  ? `Every ${DAYS_OF_WEEK[schedule.day_of_week] ?? 'Monday'}`
                  : `Monthly on day ${schedule.day_of_month}`}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md text-vemio-text-muted"
                style={{ background: 'var(--color-vemio-surface-raised)' }}
              >
                <Clock className="w-3 h-3" />
                08:00 IST
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleToggle}
            className="bg-transparent border-none cursor-pointer p-1 flex items-center rounded-md
                       transition-colors hover:bg-vemio-surface-raised"
            title={schedule.is_active ? 'Pause' : 'Resume'}
          >
            {schedule.is_active
              ? <ToggleRight className="w-5 h-5 text-vemio-amber" />
              : <ToggleLeft  className="w-5 h-5 text-vemio-text-dim" />}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-md bg-transparent cursor-pointer flex items-center
                       transition-colors disabled:opacity-40 border
                       text-vemio-text-dim hover:text-severity-high"
            style={{ borderColor: 'var(--color-vemio-border)' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recipients */}
      <div className="flex items-start gap-2 mb-1.5">
        <Mail className="w-3 h-3 text-vemio-text-dim shrink-0 mt-0.5" />
        <p className="text-xs m-0 break-all text-vemio-text-muted">
          {schedule.recipients.join(', ')}
        </p>
      </div>

      {/* Next run */}
      <p className="text-[11px] m-0 text-vemio-text-dim">
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

/* ── Main Page ─────────────────────────────────────────────────────────── */

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
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5 max-sm:gap-3.5 max-w-[860px]"
    >

      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold m-0 text-vemio-text">Report Scheduling</h1>
          <p className="text-[13px] mt-1 m-0 text-vemio-text-muted">
            Automatically generate and email PDF reports to your team
          </p>
        </div>
        {!showForm && (
          <AmberButton onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> New Schedule
          </AmberButton>
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
        <motion.div variants={fadeUp} className="flex flex-col items-center justify-center py-14 gap-2.5 text-center">
          <Calendar className="w-10 h-10 text-vemio-text-dim opacity-40" />
          <p className="text-vemio-text-muted text-sm">No scheduled reports yet</p>
          <p className="text-vemio-text-dim text-xs">Click &quot;New Schedule&quot; to set up automatic PDF delivery</p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence mode="popLayout">
            {schedules.map(s => (
              <ScheduleCard key={s.id} schedule={s}
                onToggle={handleToggle} onDelete={handleDelete} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Info box */}
      <motion.div
        variants={fadeUp}
        className="rounded-[10px] px-4 py-3.5"
        style={{
          background: 'var(--color-vemio-surface-raised)',
          border: '1px solid var(--color-vemio-border)',
        }}
      >
        <p className="text-xs font-semibold m-0 mb-1.5 text-vemio-text-muted">
          How scheduled reports work
        </p>
        <p className="text-xs leading-relaxed m-0 text-vemio-text-dim">
          Reports are generated at 08:00 IST on the configured day. The PDF is emailed to all
          recipients via Azure Communication Services and saved to the report history.
          Reports cover the previous calendar month for monthly schedules, or the previous
          7 days for weekly schedules.
        </p>
      </motion.div>
    </motion.div>
  );
}
