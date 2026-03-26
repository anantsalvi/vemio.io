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

const SEVERITIES    = ['critical', 'high', 'medium', 'low'];
const FREQUENCIES   = [
  { value: 'immediate', label: 'Immediate',       desc: 'Send email as soon as alert fires' },
  { value: 'hourly',    label: 'Hourly digest',   desc: 'Bundle alerts into one email per hour' },
  { value: 'daily',     label: 'Daily digest',    desc: 'One summary email per day at set time' },
];
const NOTIFY_LABELS = {
  device_down:    'Device goes offline',
  sla_breach:     'SLA breach detected',
  bcs_drop:       'BCS score drops',
  alert_critical: 'Critical alert fires',
};

export default function NotificationsSettingsPage() {
  const [settings,  setSettings]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setSettings(json.settings.notifications);
      } catch { /* use defaults */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

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
    } catch { /* TODO: show error toast */ }
    finally { setSaving(false); }
  }

  function update(path, value) {
    setSettings(prev => {
      const next = { ...prev };
      // Support one level of nesting e.g. "notify_on.device_down"
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-5 h-5 text-vemio-amber animate-spin" />
    </div>
  );

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="ns-root">

        {/* Header */}
        <motion.div variants={fadeUp} className="ns-header">
          <div>
            <h1 className="ns-title">Notification Preferences</h1>
            <p className="ns-subtitle">Configure how and when alert emails are sent to your team</p>
          </div>
          <button onClick={save} disabled={saving} className="ns-save-btn">
            {saving
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </motion.div>

        {/* Master toggle */}
        <motion.div variants={fadeUp} className="ns-panel">
          <div className="ns-panel-row">
            <div className="ns-panel-row-left">
              <Bell className="w-4 h-4 text-vemio-amber" />
              <div>
                <p className="ns-row-title">Email Notifications</p>
                <p className="ns-row-desc">Master switch — disabling stops all alert emails</p>
              </div>
            </div>
            <Toggle
              value={settings.enabled}
              onChange={v => update('enabled', v)}
            />
          </div>
        </motion.div>

        {/* Recipients */}
        <motion.div variants={fadeUp} className="ns-panel">
          <p className="ns-panel-title">Email Recipients</p>
          <p className="ns-panel-desc">These addresses receive all alert notifications for this tenant</p>

          <div className="ns-email-list">
            {settings.email_recipients.length === 0 && (
              <p className="ns-empty">No recipients added yet</p>
            )}
            {settings.email_recipients.map(email => (
              <div key={email} className="ns-email-row">
                <Mail className="w-3.5 h-3.5 text-vemio-text-dim flex-shrink-0" />
                <span className="ns-email-addr">{email}</span>
                <button onClick={() => removeEmail(email)} className="ns-remove-btn">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="ns-email-add">
            <input
              type="email"
              placeholder="name@company.com"
              value={emailInput}
              onChange={e => { setEmailInput(e.target.value); setEmailError(''); }}
              onKeyDown={e => e.key === 'Enter' && addEmail()}
              className={`ns-email-input ${emailError ? 'ns-email-input--error' : ''}`}
            />
            <button onClick={addEmail} className="ns-add-btn">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {emailError && <p className="ns-email-error">{emailError}</p>}
        </motion.div>

        {/* Severity threshold */}
        <motion.div variants={fadeUp} className="ns-panel">
          <p className="ns-panel-title">Minimum Severity</p>
          <p className="ns-panel-desc">Only alerts at this level or above trigger notifications</p>
          <div className="ns-severity-row">
            {SEVERITIES.map(sev => (
              <button
                key={sev}
                onClick={() => update('min_severity', sev)}
                className={`ns-sev-btn ns-sev-btn--${sev} ${settings.min_severity === sev ? 'ns-sev-btn--active' : ''}`}
              >
                {sev}
              </button>
            ))}
          </div>
          <p className="ns-panel-hint">
            Currently notifying on: {SEVERITIES.slice(0, SEVERITIES.indexOf(settings.min_severity) + 1).join(', ')}
          </p>
        </motion.div>

        {/* Digest frequency */}
        <motion.div variants={fadeUp} className="ns-panel">
          <p className="ns-panel-title">Delivery Frequency</p>
          <div className="ns-freq-grid">
            {FREQUENCIES.map(f => (
              <button
                key={f.value}
                onClick={() => update('digest_frequency', f.value)}
                className={`ns-freq-card ${settings.digest_frequency === f.value ? 'ns-freq-card--active' : ''}`}
              >
                <p className="ns-freq-label">{f.label}</p>
                <p className="ns-freq-desc">{f.desc}</p>
              </button>
            ))}
          </div>
          {settings.digest_frequency === 'daily' && (
            <div className="ns-time-row">
              <label className="ns-time-label">Daily digest time (IST)</label>
              <input
                type="time"
                value={settings.digest_time_ist}
                onChange={e => update('digest_time_ist', e.target.value)}
                className="ns-time-input"
              />
            </div>
          )}
        </motion.div>

        {/* Notify on */}
        <motion.div variants={fadeUp} className="ns-panel">
          <p className="ns-panel-title">Notify On</p>
          <p className="ns-panel-desc">Choose which event types trigger notifications</p>
          <div className="ns-notify-list">
            {Object.entries(NOTIFY_LABELS).map(([key, label]) => (
              <div key={key} className="ns-notify-row">
                <span className="ns-notify-label">{label}</span>
                <Toggle
                  value={settings.notify_on?.[key] ?? true}
                  onChange={v => update(`notify_on.${key}`, v)}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mute windows */}
        <motion.div variants={fadeUp} className="ns-panel">
          <div className="ns-panel-header-row">
            <div>
              <p className="ns-panel-title">Mute Windows</p>
              <p className="ns-panel-desc">Suppress notifications during these time periods</p>
            </div>
            <button
              onClick={() => update('mute_windows', [
                ...settings.mute_windows,
                { start: '22:00', end: '07:00', days: [0, 6] },
              ])}
              className="ns-add-mute-btn"
            >
              <Plus className="w-3.5 h-3.5" /> Add window
            </button>
          </div>

          {settings.mute_windows.length === 0 && (
            <p className="ns-empty" style={{ marginTop: 12 }}>No mute windows configured</p>
          )}

          {settings.mute_windows.map((w, i) => (
            <div key={i} className="ns-mute-row">
              <div className="ns-mute-times">
                <label className="ns-time-label">From</label>
                <input type="time" value={w.start} className="ns-time-input"
                  onChange={e => {
                    const updated = [...settings.mute_windows];
                    updated[i] = { ...updated[i], start: e.target.value };
                    update('mute_windows', updated);
                  }} />
                <label className="ns-time-label">To</label>
                <input type="time" value={w.end} className="ns-time-input"
                  onChange={e => {
                    const updated = [...settings.mute_windows];
                    updated[i] = { ...updated[i], end: e.target.value };
                    update('mute_windows', updated);
                  }} />
              </div>
              <div className="ns-mute-days">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, di) => (
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
                    className={`ns-day-btn ${w.days.includes(di) ? 'ns-day-btn--active' : ''}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <button
                onClick={() => update('mute_windows', settings.mute_windows.filter((_, j) => j !== i))}
                className="ns-remove-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </motion.div>

        {/* Bottom save */}
        <motion.div variants={fadeUp} className="ns-bottom-save">
          <button onClick={save} disabled={saving} className="ns-save-btn">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
          {saved && <p className="ns-saved-msg">Settings saved successfully</p>}
        </motion.div>
      </motion.div>

      <style>{`
        .ns-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 860px;
        }
        @media (max-width: 767px) { .ns-root { gap: 14px; } }

        /* Header */
        .ns-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ns-title    { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .ns-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }

        /* Save button */
        .ns-save-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 18px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-amber);
          color: #0F172A;
          transition: opacity 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .ns-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Panel */
        .ns-panel {
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          border-radius: 14px;
          padding: 20px;
        }
        @media (max-width: 479px) { .ns-panel { padding: 14px; } }

        .ns-panel-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0 0 4px;
        }
        .ns-panel-desc {
          font-size: 12px;
          color: var(--color-vemio-text-dim);
          margin: 0 0 16px;
        }
        .ns-panel-hint {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 8px 0 0;
        }
        .ns-panel-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }

        /* Master toggle row */
        .ns-panel-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .ns-panel-row-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ns-row-title { font-size: 13px; font-weight: 600; color: var(--vemio-text); margin: 0; }
        .ns-row-desc  { font-size: 12px; color: var(--color-vemio-text-dim); margin: 2px 0 0; }

        /* Email list */
        .ns-email-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 12px;
        }
        .ns-email-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 8px;
          background: var(--color-vemio-surface-raised);
        }
        .ns-email-addr {
          flex: 1;
          font-size: 13px;
          color: var(--vemio-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ns-email-add {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ns-email-input {
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
        .ns-email-input:focus { border-color: rgba(245,158,11,0.4); }
        .ns-email-input--error { border-color: rgba(239,68,68,0.5); }
        .ns-email-error {
          font-size: 11px;
          color: var(--color-severity-high);
          margin: 6px 0 0;
        }
        .ns-add-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          color: var(--vemio-amber);
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .ns-add-btn:hover { background: rgba(245,158,11,0.18); }
        .ns-remove-btn {
          padding: 4px;
          border-radius: 6px;
          background: transparent;
          border: none;
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.15s;
          flex-shrink: 0;
        }
        .ns-remove-btn:hover { color: var(--color-severity-high); }

        /* Severity */
        .ns-severity-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .ns-sev-btn {
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          border: 1px solid var(--color-vemio-border);
          background: transparent;
          color: var(--color-vemio-text-dim);
          min-height: 34px;
        }
        .ns-sev-btn--active.ns-sev-btn--critical { background: rgba(239,68,68,0.12);  border-color: rgba(239,68,68,0.3);  color: var(--color-severity-critical); }
        .ns-sev-btn--active.ns-sev-btn--high     { background: rgba(234,88,12,0.12);  border-color: rgba(234,88,12,0.3);  color: var(--color-severity-high);     }
        .ns-sev-btn--active.ns-sev-btn--medium   { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.3); color: var(--vemio-amber);             }
        .ns-sev-btn--active.ns-sev-btn--low      { background: rgba(20,184,166,0.12); border-color: rgba(20,184,166,0.3); color: var(--color-status-up);         }

        /* Frequency */
        .ns-freq-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 12px;
        }
        @media (max-width: 639px) { .ns-freq-grid { grid-template-columns: 1fr; gap: 8px; } }

        .ns-freq-card {
          padding: 12px;
          border-radius: 10px;
          text-align: left;
          cursor: pointer;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          transition: background 0.15s, border-color 0.15s;
        }
        .ns-freq-card--active {
          background: rgba(245,158,11,0.08);
          border-color: rgba(245,158,11,0.3);
        }
        .ns-freq-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0 0 4px;
        }
        .ns-freq-card--active .ns-freq-label { color: var(--vemio-amber); }
        .ns-freq-desc {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 0;
          line-height: 1.4;
        }

        /* Time input */
        .ns-time-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .ns-time-label {
          font-size: 12px;
          color: var(--vemio-text-muted);
          white-space: nowrap;
        }
        .ns-time-input {
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text);
          outline: none;
          cursor: pointer;
        }

        /* Notify on */
        .ns-notify-list { display: flex; flex-direction: column; gap: 4px; }
        .ns-notify-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--color-vemio-surface-raised);
        }
        .ns-notify-label { font-size: 13px; color: var(--vemio-text); }

        /* Mute windows */
        .ns-add-mute-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--vemio-text-muted);
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
          flex-shrink: 0;
        }
        .ns-add-mute-btn:hover { background: var(--color-vemio-border); }

        .ns-mute-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border-radius: 10px;
          background: var(--color-vemio-surface-raised);
          margin-top: 10px;
          flex-wrap: wrap;
        }
        .ns-mute-times {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ns-mute-days {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .ns-day-btn {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--color-vemio-border);
          background: transparent;
          color: var(--color-vemio-text-dim);
          transition: background 0.15s, color 0.15s;
        }
        .ns-day-btn--active {
          background: rgba(245,158,11,0.15);
          border-color: rgba(245,158,11,0.3);
          color: var(--vemio-amber);
        }

        .ns-empty {
          font-size: 12px;
          color: var(--color-vemio-text-dim);
          margin: 0;
        }

        .ns-bottom-save {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-bottom: 24px;
        }
        .ns-saved-msg {
          font-size: 12px;
          color: var(--color-status-up);
          margin: 0;
        }
      `}</style>
    </>
  );
}

// ── Toggle component ──────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="ns-toggle"
      style={{
        background: value ? 'var(--color-vemio-amber)' : 'var(--color-vemio-border)',
      }}
      role="switch"
      aria-checked={value}
    >
      <span className="ns-toggle-thumb" style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }} />
      <style>{`
        .ns-toggle {
          width: 42px;
          height: 24px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          position: relative;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .ns-toggle-thumb {
          position: absolute;
          top: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s cubic-bezier(0.4,0,0.2,1);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
      `}</style>
    </button>
  );
}