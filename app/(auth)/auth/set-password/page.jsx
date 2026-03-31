'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertTriangle, Loader2, Sun, Moon, Monitor, CheckCircle, Lock } from 'lucide-react';
import VemioRibbonLogo from '@/app/components/VemioRibbonLogo';

const THEME_KEY = 'vemio-theme-preference';
function getSystemTheme() { if (typeof window === 'undefined') return 'dark'; return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
function useLoginTheme() {
  const [preference, setPreference] = useState('system');
  const [resolved, setResolved] = useState('dark');
  useEffect(() => { const stored = localStorage.getItem(THEME_KEY); const pref = stored && ['dark','light','system'].includes(stored) ? stored : 'system'; setPreference(pref); const res = pref === 'system' ? getSystemTheme() : pref; setResolved(res); document.documentElement.setAttribute('data-theme', res); }, []);
  useEffect(() => { if (preference !== 'system') return; const mq = window.matchMedia('(prefers-color-scheme: light)'); const handler = (e) => { const res = e.matches ? 'light' : 'dark'; setResolved(res); document.documentElement.setAttribute('data-theme', res); }; mq.addEventListener('change', handler); return () => mq.removeEventListener('change', handler); }, [preference]);
  const setTheme = (pref) => { setPreference(pref); localStorage.setItem(THEME_KEY, pref); const res = pref === 'system' ? getSystemTheme() : pref; setResolved(res); document.documentElement.setAttribute('data-theme', res); };
  return { preference, resolved, setTheme };
}
function LoginThemeToggle({ preference, onSetTheme }) {
  const modes = [{ key: 'light', icon: Sun }, { key: 'dark', icon: Moon }, { key: 'system', icon: Monitor }];
  return (<div className="login-theme-toggle">{modes.map(({ key, icon: Icon }) => (<button key={key} onClick={() => onSetTheme(key)} className={`login-theme-btn ${preference === key ? 'login-theme-btn--active' : ''}`} title={key.charAt(0).toUpperCase() + key.slice(1)} aria-label={`${key} theme`}><Icon className="w-3.5 h-3.5" /></button>))}</div>);
}

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++; if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++; if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++; if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return { label: 'Weak', color: '#EF4444', width: '25%' };
  if (score <= 3) return { label: 'Fair', color: '#F59E0B', width: '50%' };
  if (score <= 4) return { label: 'Good', color: '#22C55E', width: '75%' };
  return { label: 'Strong', color: '#10B981', width: '100%' };
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState('loading');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setState('error'); setError('No invite token provided.'); return; }
    fetch(`/api/auth/set-password?token=${token}`)
      .then(r => r.json())
      .then(data => { if (data.valid) { setTokenInfo(data); setState('form'); } else { setState('error'); setError(data.error || 'Invalid or expired invite link.'); } })
      .catch(() => { setState('error'); setError('Unable to verify invite. Please try again.'); });
  }, [token]);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const canSubmit = password.length >= 8 && passwordsMatch && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault(); if (!canSubmit) return;
    setSubmitting(true); setError('');
    try {
      const res = await fetch('/api/auth/set-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      const data = await res.json();
      if (data.success) { setState('success'); setTimeout(() => router.push('/auth/login'), 3000); }
      else { setError(data.error || 'Failed to set password.'); setSubmitting(false); }
    } catch { setError('Connection error. Please try again.'); setSubmitting(false); }
  };

  return (
    <div className="login-form">
      {state === 'loading' && (
        <div className="sp-center"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-vemio-amber)' }} /><p className="sp-center-text">Verifying your invite...</p></div>
      )}
      {state === 'error' && (
        <div className="sp-center">
          <div className="sp-icon-circle sp-icon-circle--error"><AlertTriangle className="w-5 h-5" /></div>
          <h3 className="sp-heading">Invite Link Invalid</h3>
          <p className="sp-center-text">{error}</p>
          <p className="sp-center-sub">Please contact your administrator for a new invite.</p>
          <button onClick={() => router.push('/auth/login')} className="sp-text-btn">Go to Sign In</button>
        </div>
      )}
      {state === 'success' && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="sp-center">
          <div className="sp-icon-circle sp-icon-circle--success"><CheckCircle className="w-6 h-6" /></div>
          <h3 className="sp-heading">Password Set Successfully</h3>
          <p className="sp-center-text">Your account is ready. Redirecting to sign in...</p>
          <div className="sp-progress-track"><div className="sp-progress-fill" /></div>
        </motion.div>
      )}
      {state === 'form' && (
        <>
          <div className="login-email-bar">
            <Lock className="w-4 h-4" style={{ color: 'var(--color-vemio-amber)', flexShrink: 0 }} />
            <div>
              <span className="login-email-display">Welcome, {tokenInfo.name}</span>
              <span className="sp-email-sub">{tokenInfo.email} {'\u00b7'} {tokenInfo.tenantName}</span>
            </div>
          </div>
          <AnimatePresence>
            {error && (<motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="login-error"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span></motion.div>)}
          </AnimatePresence>
          <form onSubmit={handleSubmit} className="login-step">
            <div className="login-field">
              <label className="login-label">New Password</label>
              <div className="login-input-wrap">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoFocus autoComplete="new-password" placeholder="Minimum 8 characters" className="login-input login-input--pw" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="login-pw-toggle">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {password && (<div className="sp-strength"><div className="sp-strength-track"><div className="sp-strength-bar" style={{ width: strength.width, background: strength.color }} /></div><span className="sp-strength-label" style={{ color: strength.color }}>{strength.label}</span></div>)}
            </div>
            <div className="login-field">
              <label className="login-label">Confirm Password</label>
              <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" placeholder="Re-enter your password" className="login-input" />
              {confirmPassword && !passwordsMatch && <span className="sp-mismatch">Passwords do not match</span>}
            </div>
            <button type="submit" disabled={!canSubmit} className="login-submit">
              {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" /> Setting password...</>) : ('Set Password & Activate Account')}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function SetPasswordPage() {
  const { preference, resolved, setTheme } = useLoginTheme();
  return (
    <>
      <div className="login-root">
        <div className="login-grid" />
        <div className="login-glow" />
        <div className="login-theme-corner"><LoginThemeToggle preference={preference} onSetTheme={setTheme} /></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="login-container">
          <div className="login-branding">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }} className="login-logo-wrap"><VemioRibbonLogo width={160} /></motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
              <h1 className="login-brand-name">VEMIO<span className="login-tm">{'\u2122'}</span></h1>
              <p className="login-brand-sub">Network Intelligence Platform</p>
            </motion.div>
          </div>
          <div className="login-card">
            <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-vemio-amber)' }} /></div>}>
              <SetPasswordForm />
            </Suspense>
          </div>
          <p className="login-footer">Secured by{' '}<a href="https://vinayenterprises.co.in" target="_blank" rel="noopener noreferrer" className="login-footer-link">Vinay Enterprises</a>{' '}{'\u00b7'} Est. 1993</p>
        </motion.div>
      </div>
      <style>{`
        .login-root{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;background:var(--color-vemio-bg);transition:background .3s}
        .login-grid{position:absolute;inset:0;opacity:.2;background-image:radial-gradient(circle at center,var(--color-vemio-amber) 1px,transparent 1px),linear-gradient(to right,rgba(245,158,11,.15) 1px,transparent 1px),linear-gradient(to bottom,rgba(245,158,11,.15) 1px,transparent 1px);background-size:40px 40px,80px 80px,80px 80px;background-position:20px 20px,0 0,0 0}
        .login-glow{position:absolute;top:20%;left:50%;transform:translateX(-50%);width:600px;height:600px;border-radius:50%;opacity:.04;background:radial-gradient(circle,#f59e0b 0%,transparent 70%);pointer-events:none}
        .login-theme-corner{position:absolute;top:16px;right:16px;z-index:20}
        .login-theme-toggle{display:flex;gap:2px;padding:3px;border-radius:10px;background:var(--color-vemio-surface);border:1px solid var(--color-vemio-border)}
        .login-theme-btn{display:flex;align-items:center;justify-content:center;width:32px;height:28px;border-radius:7px;border:none;background:transparent;color:var(--color-vemio-text-dim);cursor:pointer;transition:background .15s,color .15s}
        .login-theme-btn:hover{color:var(--color-vemio-text-muted)}
        .login-theme-btn--active{background:var(--color-vemio-surface-raised);color:var(--color-vemio-amber)}
        .login-container{position:relative;z-index:10;width:100%;max-width:420px;margin:0 16px}
        .login-branding{text-align:center;margin-bottom:32px}
        .login-logo-wrap{display:inline-block;margin-bottom:12px}
        .login-brand-name{font-size:28px;font-weight:700;letter-spacing:.15em;color:var(--color-vemio-amber);margin:0;font-family:'Anton',sans-serif}
        .login-tm{font-size:12px;font-weight:500;color:var(--color-vemio-text-dim);vertical-align:super;margin-left:2px}
        .login-brand-sub{font-size:13px;color:var(--color-vemio-text-muted);margin:4px 0 0;letter-spacing:.02em}
        .login-card{border-radius:16px;padding:32px;background:var(--color-vemio-surface);border:1px solid var(--color-vemio-border);box-shadow:0 4px 24px rgba(0,0,0,.15);transition:background .3s,border-color .3s}
        @media(max-width:479px){.login-card{padding:24px}}
        .login-form{display:flex;flex-direction:column;gap:20px}
        .login-step{display:flex;flex-direction:column;gap:20px}
        .login-error{display:flex;align-items:flex-start;gap:8px;padding:12px;border-radius:10px;font-size:13px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);color:var(--color-severity-high)}
        .login-field{display:flex;flex-direction:column;gap:6px}
        .login-label{font-size:11px;font-weight:500;color:var(--color-vemio-text-muted);text-transform:uppercase;letter-spacing:.06em}
        .login-input{width:100%;padding:12px 16px;border-radius:10px;font-size:14px;background:var(--color-vemio-surface-raised);border:1px solid var(--color-vemio-border);color:var(--color-vemio-text);outline:none;transition:border-color .2s;font-family:inherit;box-sizing:border-box}
        .login-input::placeholder{color:var(--color-vemio-text-dim);opacity:.6}
        .login-input:focus{border-color:var(--color-vemio-amber)}
        .login-input--pw{padding-right:44px}
        .login-input-wrap{position:relative}
        .login-pw-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--color-vemio-text-dim);background:none;border:none;cursor:pointer;padding:4px;transition:color .15s}
        .login-pw-toggle:hover{color:var(--color-vemio-text)}
        .login-email-bar{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:var(--color-vemio-surface-raised);border:1px solid var(--color-vemio-border)}
        .login-email-display{font-size:14px;color:var(--color-vemio-text);font-weight:500;display:block}
        .login-submit{width:100%;padding:12px;border-radius:10px;font-size:14px;font-weight:600;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .2s,transform .1s;background:linear-gradient(135deg,#f59e0b,#d97706);color:#0a0e17;box-shadow:0 2px 12px rgba(245,158,11,.25);font-family:inherit}
        .login-submit:hover:not(:disabled){opacity:.9;transform:translateY(-1px)}
        .login-submit:active:not(:disabled){transform:translateY(0)}
        .login-submit:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
        .login-footer{text-align:center;font-size:11px;color:var(--color-vemio-text-dim);margin-top:24px}
        .login-footer-link{color:var(--color-vemio-text-muted);text-decoration:none;transition:color .15s}
        .login-footer-link:hover{color:var(--color-vemio-amber)}
        [data-theme="light"] .login-grid{opacity:.55}
        .sp-center{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:12px 0}
        .sp-center-text{font-size:13px;color:var(--color-vemio-text-muted);margin:0;line-height:1.5}
        .sp-center-sub{font-size:12px;color:var(--color-vemio-text-dim);margin:0}
        .sp-heading{font-size:16px;font-weight:600;color:var(--color-vemio-text);margin:0}
        .sp-icon-circle{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center}
        .sp-icon-circle--error{background:rgba(239,68,68,.1);color:#ef4444}
        .sp-icon-circle--success{background:rgba(34,197,94,.1);color:#22c55e}
        .sp-text-btn{padding:8px 20px;border-radius:8px;font-size:13px;font-weight:500;border:1px solid var(--color-vemio-border);background:transparent;color:var(--color-vemio-amber);cursor:pointer;margin-top:4px;font-family:inherit}
        .sp-text-btn:hover{background:rgba(245,158,11,.06)}
        .sp-progress-track{width:180px;height:3px;border-radius:2px;background:rgba(34,197,94,.15);overflow:hidden;margin-top:6px}
        .sp-progress-fill{width:100%;height:100%;background:#22c55e;border-radius:2px;animation:sp-bar 3s linear forwards}
        @keyframes sp-bar{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        .sp-email-sub{font-size:11px;color:var(--color-vemio-text-dim);display:block;margin-top:1px}
        .sp-strength{display:flex;align-items:center;gap:8px}
        .sp-strength-track{flex:1;height:3px;border-radius:2px;background:rgba(148,163,184,.1);overflow:hidden}
        .sp-strength-bar{height:100%;border-radius:2px;transition:width .3s,background .3s}
        .sp-strength-label{font-size:10px;font-weight:600;flex-shrink:0}
        .sp-mismatch{font-size:11px;color:#ef4444}
      `}</style>
    </>
  );
}