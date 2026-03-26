'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, RefreshCw, Save, Plus, Trash2, Mail } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const SEVERITIES  = ['critical', 'high', 'medium', 'low'];
const FREQUENCIES = [
  { value: 'immediate', label: 'Immediate',     desc: 'Send email as soon as alert fires' },
  { value: 'hourly',    label: 'Hourly digest',  desc: 'Bundle alerts into one email per hour' },
  { value: 'daily',     label: 'Daily digest',   desc: 'One summary email per day at set time' },
];
const NOTIFY_LABELS = {
  device_down:    'Device goes offline',
  sla_breach:     'SLA breach detected',
  bcs_drop:       'BCS score drops',
  alert_critical: 'Critical alert fires',
};

const SEV_COLORS = {
  critical: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', color: 'var(--color-severity-critical)' },
  high:     { bg: 'rgba(234,88,12,0.12)', border: 'rgba(234,88,12,0.3)', color: 'var(--color-severity-high)' },
  medium:   { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', color: 'var(--color-vemio-amber)' },
  low:      { bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.3)', color: 'var(--color-status-up)' },
};

/* ── Shared sub-components ───────────────────────────────────────────────── */

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="relative w-[42px] h-6 rounded-full shrink-0 transition-colors duration-200 cursor-pointer border-none"
      style={{ background: value ? 'var(--color-vemio-amber)' : 'var(--color-vemio-border)' }}
    >
      <span
        className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  );
}

function SaveButton({ saving, saved, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold
                 shrink-0 whitespace-nowrap cursor-pointer border-none
                 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      style={{ background: 'var(--color-vemio-amber)', color: '#0F172A' }}
    >
      {saving
        ? <RefreshCw className="w-4 h-4 animate-spin" />
        : <Save className="w-4 h-4" />}
      {saved ? 'Saved!' : 'Save Changes'}
    </button>
  );
}

function Panel({ children, className = '' }) {
  return (
    <motion.div
      variants={fadeUp}
      className={`rounded-[14px] p-5 max-sm:p-3.5 ${className}`}
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function NotificationsSettingsPage() {
  const [settings,    setSettings]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [emailInput,  setEmailInput]  = useState('');
  const [emailError,  setEmailError]  = useState('');

  /* ── data fetch ── */
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setSettings(json.settings.notifications);
      } catch { /* defaults handled by guard below */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  /* ── save ── */
  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ settings: { notifications: settings } }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* TODO: toast */ }
    finally { setSaving(false); }
  }

  /* ── helpers ── */
  function update(path, value) {
    setSettings(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      if (parts.length === 1) {
        next[path] = value;
      } else {
        next[parts[0]] = { ...next[parts[0]], [parts[1]]: value };
      }
      return next;
    });
  }

  function addEmail() {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Invalid email address');
      return;
    }
    if (settings.email_recipients.includes(email)) {
      setEmailError('Already in list');
      return;
    }
    update('email_recipients', [...settings.email_recipients, email]);
    setEmailInput('');
    setEmailError('');
  }

  function removeEmail(email) {
    update('email_recipients', settings.email_recipients.filter(e => e !== email));
  }

  /* ── loading state ── */
  if (loading || !settings) return (
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

      {/* ── Header ── */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold m-0 text-vemio-text">Notification Preferences</h1>
          <p className="text-[13px] mt-1 m-0 text-vemio-text-muted">
            Configure how and when alert emails are sent to your team
          </p>
        </div>
        <SaveButton saving={saving} saved={saved} onClick={save} />
      </motion.div>

      {/* ── Master toggle ── */}
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-vemio-amber" />
            <div>
              <p className="text-[13px] font-semibold m-0 text-vemio-text">Email Notifications</p>
              <p className="text-xs mt-0.5 m-0 text-vemio-text-dim">
                Master switch — disabling stops all alert emails
              </p>
            </div>
          </div>
          <Toggle value={settings.enabled} onChange={v => update('enabled', v)} />
        </div>
      </Panel>

      {/* ── Recipients ── */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-1 text-vemio-text">Email Recipients</p>
        <p className="text-xs m-0 mb-4 text-vemio-text-dim">
          These addresses receive all alert notifications for this tenant
        </p>

        {/* list */}
        <div className="flex flex-col gap-1.5 mb-3">
          {settings.email_recipients.length === 0 && (
            <p className="text-xs m-0 text-vemio-text-dim">No recipients added yet</p>
          )}
          {settings.email_recipients.map(email => (
            <div
              key={email}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
              style={{ background: 'var(--color-vemio-surface-raised)' }}
            >
              <Mail className="w-3.5 h-3.5 text-vemio-text-dim shrink-0" />
              <span className="flex-1 text-[13px] text-vemio-text truncate">{email}</span>
              <button
                onClick={() => removeEmail(email)}
                className="p-1 rounded-md bg-transparent border-none cursor-pointer
                           text-vemio-text-dim hover:text-severity-high transition-colors shrink-0 flex"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* add input */}
        <div className="flex gap-2 items-center">
          <input
            type="email"
            placeholder="name@company.com"
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
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold
                       whitespace-nowrap cursor-pointer transition-colors border shrink-0"
            style={{
              background: 'rgba(245,158,11,0.1)',
              borderColor: 'rgba(245,158,11,0.25)',
              color: 'var(--color-vemio-amber)',
            }}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        {emailError && (
          <p className="text-[11px] mt-1.5 m-0 text-severity-high">{emailError}</p>
        )}
      </Panel>

      {/* ── Severity threshold ── */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-1 text-vemio-text">Minimum Severity</p>
        <p className="text-xs m-0 mb-4 text-vemio-text-dim">
          Only alerts at this level or above trigger notifications
        </p>
        <div className="flex gap-2 flex-wrap mb-1">
          {SEVERITIES.map(sev => {
            const active = settings.min_severity === sev;
            const c = SEV_COLORS[sev];
            return (
              <button
                key={sev}
                onClick={() => update('min_severity', sev)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider
                           cursor-pointer transition-colors min-h-[34px] border"
                style={{
                  background: active ? c.bg : 'transparent',
                  borderColor: active ? c.border : 'var(--color-vemio-border)',
                  color: active ? c.color : 'var(--color-vemio-text-dim)',
                }}
              >
                {sev}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] mt-2 m-0 text-vemio-text-dim">
          Currently notifying on: {SEVERITIES.slice(0, SEVERITIES.indexOf(settings.min_severity) + 1).join(', ')}
        </p>
      </Panel>

      {/* ── Delivery frequency ── */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-1 text-vemio-text">Delivery Frequency</p>
        <p className="text-xs m-0 mb-4 text-vemio-text-dim">
          How often should alert notifications be sent
        </p>

        <div className="grid grid-cols-3 max-sm:grid-cols-1 gap-2.5 mb-3">
          {FREQUENCIES.map(f => {
            const active = settings.digest_frequency === f.value;
            return (
              <button
                key={f.value}
                onClick={() => update('digest_frequency', f.value)}
                className="p-3 rounded-[10px] text-left cursor-pointer transition-colors border"
                style={{
                  background: active
                    ? 'rgba(245,158,11,0.08)'
                    : 'var(--color-vemio-surface-raised)',
                  borderColor: active
                    ? 'rgba(245,158,11,0.3)'
                    : 'var(--color-vemio-border)',
                }}
              >
                <p
                  className="text-[13px] font-semibold m-0 mb-1"
                  style={{ color: active ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text)' }}
                >
                  {f.label}
                </p>
                <p className="text-[11px] leading-snug m-0 text-vemio-text-dim">{f.desc}</p>
              </button>
            );
          })}
        </div>

        {settings.digest_frequency === 'daily' && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs whitespace-nowrap text-vemio-text-muted">
              Daily digest time (IST)
            </label>
            <input
              type="time"
              value={settings.digest_time_ist}
              onChange={e => update('digest_time_ist', e.target.value)}
              className="px-2.5 py-1.5 rounded-lg text-[13px] outline-none cursor-pointer"
              style={{
                background: 'var(--color-vemio-surface-raised)',
                border: '1px solid var(--color-vemio-border)',
                color: 'var(--color-vemio-text)',
              }}
            />
          </div>
        )}
      </Panel>

      {/* ── Notify on ── */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-1 text-vemio-text">Notify On</p>
        <p className="text-xs m-0 mb-4 text-vemio-text-dim">
          Choose which event types trigger notifications
        </p>
        <div className="flex flex-col gap-1">
          {Object.entries(NOTIFY_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--color-vemio-surface-raised)' }}
            >
              <span className="text-[13px] text-vemio-text">{label}</span>
              <Toggle
                value={settings.notify_on?.[key] ?? true}
                onChange={v => update(`notify_on.${key}`, v)}
              />
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Mute windows ── */}
      <Panel>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div>
            <p className="text-[13px] font-semibold m-0 mb-1 text-vemio-text">Mute Windows</p>
            <p className="text-xs m-0 text-vemio-text-dim">
              Suppress notifications during these time periods
            </p>
          </div>
          <button
            onClick={() => update('mute_windows', [
              ...settings.mute_windows,
              { start: '22:00', end: '07:00', days: [0, 6] },
            ])}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold
                       whitespace-nowrap cursor-pointer transition-colors shrink-0 border"
            style={{
              background: 'var(--color-vemio-surface-raised)',
              borderColor: 'var(--color-vemio-border)',
              color: 'var(--color-vemio-text-muted)',
            }}
          >
            <Plus className="w-3.5 h-3.5" /> Add window
          </button>
        </div>

        {settings.mute_windows.length === 0 && (
          <p className="text-xs mt-3 m-0 text-vemio-text-dim">No mute windows configured</p>
        )}

        {settings.mute_windows.map((w, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-[10px] mt-2.5 flex-wrap"
            style={{ background: 'var(--color-vemio-surface-raised)' }}
          >
            {/* Time pickers */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs whitespace-nowrap text-vemio-text-muted">From</label>
              <input
                type="time"
                value={w.start}
                className="px-2.5 py-1.5 rounded-lg text-[13px] outline-none cursor-pointer"
                style={{
                  background: 'var(--color-vemio-surface-raised)',
                  border: '1px solid var(--color-vemio-border)',
                  color: 'var(--color-vemio-text)',
                }}
                onChange={e => {
                  const updated = [...settings.mute_windows];
                  updated[i] = { ...updated[i], start: e.target.value };
                  update('mute_windows', updated);
                }}
              />
              <label className="text-xs whitespace-nowrap text-vemio-text-muted">To</label>
              <input
                type="time"
                value={w.end}
                className="px-2.5 py-1.5 rounded-lg text-[13px] outline-none cursor-pointer"
                style={{
                  background: 'var(--color-vemio-surface-raised)',
                  border: '1px solid var(--color-vemio-border)',
                  color: 'var(--color-vemio-text)',
                }}
                onChange={e => {
                  const updated = [...settings.mute_windows];
                  updated[i] = { ...updated[i], end: e.target.value };
                  update('mute_windows', updated);
                }}
              />
            </div>

            {/* Day pills */}
            <div className="flex gap-1 flex-wrap">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, di) => {
                const active = w.days.includes(di);
                return (
                  <button
                    key={di}
                    onClick={() => {
                      const updated = [...settings.mute_windows];
                      const days = updated[i].days.includes(di)
                        ? updated[i].days.filter(x => x !== di)
                        : [...updated[i].days, di];
                      updated[i] = { ...updated[i], days };
                      update('mute_windows', updated);
                    }}
                    className="w-[30px] h-[30px] rounded-md text-[10px] font-semibold
                               cursor-pointer transition-colors border"
                    style={{
                      background: active ? 'rgba(245,158,11,0.15)' : 'transparent',
                      borderColor: active ? 'rgba(245,158,11,0.3)' : 'var(--color-vemio-border)',
                      color: active ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {/* Delete */}
            <button
              onClick={() => update('mute_windows', settings.mute_windows.filter((_, j) => j !== i))}
              className="p-1 rounded-md bg-transparent border-none cursor-pointer
                         text-vemio-text-dim hover:text-severity-high transition-colors shrink-0 flex"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </Panel>

      {/* ── Bottom save ── */}
      <motion.div variants={fadeUp} className="flex items-center gap-3.5 pb-6">
        <SaveButton saving={saving} saved={saved} onClick={save} />
        {saved && <p className="text-xs m-0 text-status-up">Settings saved successfully</p>}
      </motion.div>
    </motion.div>
  );
}
