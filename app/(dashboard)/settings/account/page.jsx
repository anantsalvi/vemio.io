'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function AccountPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', message }

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isValid = currentPassword && newPassword.length >= 8 && passwordsMatch;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ type: 'success', message: 'Password changed successfully' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setResult({ type: 'error', message: data.error || 'Failed to change password' });
      }
    } catch {
      setResult({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <motion.div
        initial="hidden" animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="acc-root"
      >
        {/* Header */}
        <motion.div variants={fadeUp}>
          <h1 className="acc-title">Account Settings</h1>
          <p className="acc-subtitle">Manage your profile and security</p>
        </motion.div>

        {/* Profile info */}
        <motion.div variants={fadeUp} className="acc-panel">
          <h3 className="acc-panel-title">Profile</h3>
          <div className="acc-profile-grid">
            <div className="acc-field">
              <span className="acc-field-label">Name</span>
              <span className="acc-field-value">{user?.name || '—'}</span>
            </div>
            <div className="acc-field">
              <span className="acc-field-label">Email</span>
              <span className="acc-field-value acc-field-value--mono">{user?.email || '—'}</span>
            </div>
            <div className="acc-field">
              <span className="acc-field-label">Role</span>
              <span className="acc-field-value acc-field-value--cap">{user?.role || '—'}</span>
            </div>
            <div className="acc-field">
              <span className="acc-field-label">Tenant</span>
              <span className="acc-field-value">{user?.tenantName || '—'}</span>
            </div>
          </div>
        </motion.div>

        {/* Password change */}
        <motion.div variants={fadeUp} className="acc-panel">
          <h3 className="acc-panel-title">
            <Lock className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
            Change Password
          </h3>

          <form onSubmit={handleSubmit} className="acc-pw-form">
            {/* Current password */}
            <div className="acc-input-group">
              <label className="acc-input-label">Current Password</label>
              <div className="acc-input-wrap">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="acc-input"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(p => !p)}
                  className="acc-eye-btn"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="acc-input-group">
              <label className="acc-input-label">New Password</label>
              <div className="acc-input-wrap">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="acc-input"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(p => !p)}
                  className="acc-eye-btn"
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {newPassword && newPassword.length < 8 && (
                <span className="acc-hint acc-hint--error">Must be at least 8 characters</span>
              )}
            </div>

            {/* Confirm password */}
            <div className="acc-input-group">
              <label className="acc-input-label">Confirm New Password</label>
              <div className="acc-input-wrap">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="acc-input"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
                {confirmPassword && (
                  <span className="acc-match-indicator">
                    {passwordsMatch ? (
                      <Check className="w-4 h-4" style={{ color: 'var(--color-status-up)' }} />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--color-status-down)' }} />
                    )}
                  </span>
                )}
              </div>
              {confirmPassword && !passwordsMatch && (
                <span className="acc-hint acc-hint--error">Passwords do not match</span>
              )}
            </div>

            {/* Result message */}
            {result && (
              <div className={`acc-result ${result.type === 'success' ? 'acc-result--success' : 'acc-result--error'}`}>
                {result.type === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>{result.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid || loading}
              className="acc-submit-btn"
            >
              {loading ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        </motion.div>
      </motion.div>

      <style>{`
        .acc-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 640px;
        }

        .acc-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
        }
        .acc-subtitle {
          font-size: 13px;
          color: var(--vemio-text-muted);
          margin: 3px 0 0;
        }

        .acc-panel {
          border-radius: 16px;
          padding: 20px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .acc-panel-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .acc-profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 479px) {
          .acc-profile-grid { grid-template-columns: 1fr; }
        }

        .acc-field { display: flex; flex-direction: column; gap: 3px; }
        .acc-field-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
        }
        .acc-field-value {
          font-size: 13px;
          font-weight: 500;
          color: var(--vemio-text);
        }
        .acc-field-value--mono { font-family: var(--font-mono); font-size: 12px; }
        .acc-field-value--cap { text-transform: capitalize; }

        .acc-pw-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .acc-input-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .acc-input-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-vemio-text-muted);
        }

        .acc-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .acc-input {
          width: 100%;
          padding: 10px 40px 10px 14px;
          font-size: 13px;
          border-radius: 8px;
          background: var(--color-vemio-bg);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .acc-input::placeholder { color: var(--color-vemio-text-dim); }
        .acc-input:focus { border-color: rgba(245, 158, 11, 0.4); }

        .acc-eye-btn {
          position: absolute;
          right: 10px;
          padding: 4px;
          border: none;
          background: transparent;
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          display: flex;
          border-radius: 4px;
        }
        .acc-eye-btn:hover { color: var(--color-vemio-text-muted); }

        .acc-match-indicator {
          position: absolute;
          right: 10px;
          display: flex;
        }

        .acc-hint {
          font-size: 11px;
        }
        .acc-hint--error { color: var(--color-status-down); }

        .acc-result {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
        }
        .acc-result--success {
          background: rgba(34, 197, 94, 0.08);
          border: 1px solid rgba(34, 197, 94, 0.2);
          color: var(--color-status-up);
        }
        .acc-result--error {
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: var(--color-status-down);
        }

        .acc-submit-btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-amber);
          color: #000;
          transition: opacity 0.15s;
          align-self: flex-start;
          min-height: 40px;
        }
        .acc-submit-btn:hover:not(:disabled) { opacity: 0.9; }
        .acc-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        @media (max-width: 479px) {
          .acc-panel { padding: 16px; }
          .acc-submit-btn { width: 100%; }
        }
      `}</style>
    </>
  );
}