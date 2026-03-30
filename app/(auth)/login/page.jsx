'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, EyeOff, AlertTriangle, Loader2, Sun, Moon, Monitor } from 'lucide-react';
import VemioRibbonLogo from '@/app/components/VemioRibbonLogo';

// ── Theme management for login page (standalone, no ThemeProvider needed) ────

const THEME_KEY = 'vemio-theme-preference';

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function useLoginTheme() {
  const [preference, setPreference] = useState('system');
  const [resolved, setResolved] = useState('dark');

  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    const pref = stored && ['dark', 'light', 'system'].includes(stored) ? stored : 'system';
    setPreference(pref);
    const res = pref === 'system' ? getSystemTheme() : pref;
    setResolved(res);
    document.documentElement.setAttribute('data-theme', res);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      const res = e.matches ? 'light' : 'dark';
      setResolved(res);
      document.documentElement.setAttribute('data-theme', res);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [preference]);

  const setTheme = (pref) => {
    setPreference(pref);
    localStorage.setItem(THEME_KEY, pref);
    const res = pref === 'system' ? getSystemTheme() : pref;
    setResolved(res);
    document.documentElement.setAttribute('data-theme', res);
  };

  return { preference, resolved, setTheme };
}

// ── Theme Toggle ────────────────────────────────────────────────────────────

function LoginThemeToggle({ preference, onSetTheme }) {
  const modes = [
    { key: 'light', icon: Sun },
    { key: 'dark', icon: Moon },
    { key: 'system', icon: Monitor },
  ];

  return (
    <div className="login-theme-toggle">
      {modes.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onSetTheme(key)}
          className={`login-theme-btn ${preference === key ? 'login-theme-btn--active' : ''}`}
          title={key.charAt(0).toUpperCase() + key.slice(1)}
          aria-label={`${key} theme`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      ))}
    </div>
  );
}

// ── SSO Error Messages ──────────────────────────────────────────────────────

const SSO_ERROR_MESSAGES = {
  sso_tenant_not_found: 'No organization found for your SSO account. Contact your administrator.',
};

// ── Login Form ──────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // SSO state
  const [ssoInfo, setSsoInfo] = useState(null);
  const [ssoChecking, setSsoChecking] = useState(false);
  const ssoDebounceRef = useRef(null);

  // Error handling — check for SSO errors in URL
  const urlError = searchParams.get('error');
  const [error, setError] = useState(() => {
    if (!urlError) return '';
    return SSO_ERROR_MESSAGES[urlError] || (urlError === 'CredentialsSignin' ? 'Invalid email or password' : decodeURIComponent(urlError));
  });

  // ── SSO Discovery ──
  const checkSSO = useCallback(async (emailValue) => {
    if (!emailValue || !emailValue.includes('@') || emailValue.split('@')[1].length < 3) {
      setSsoInfo(null);
      return;
    }

    setSsoChecking(true);
    try {
      const res = await fetch('/api/auth/sso/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue }),
      });
      const data = await res.json();
      setSsoInfo(data.sso_available ? data : null);
    } catch {
      setSsoInfo(null);
    } finally {
      setSsoChecking(false);
    }
  }, []);

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setError('');

    // Debounce SSO check
    if (ssoDebounceRef.current) clearTimeout(ssoDebounceRef.current);
    ssoDebounceRef.current = setTimeout(() => checkSSO(val), 600);
  };

  // ── SSO Login ──
  const handleSSOLogin = async () => {
    setLoading(true);
    setError('');
    try {
      if (ssoInfo?.provider === 'azure-ad') {
        await signIn('azure-ad', {
          callbackUrl: '/overview',
          login_hint: email,
        });
      }
    } catch {
      setError('SSO sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error === 'CredentialsSignin'
          ? 'Invalid email or password'
          : result.error);
        setLoading(false);
      } else {
        router.push('/overview');
        router.refresh();
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const providerLabels = {
    'azure-ad': 'Microsoft',
    'google': 'Google',
    'okta': 'Okta',
  };

  const showPasswordField = !ssoInfo?.enforce_sso;
  const showSSOButton = ssoInfo?.sso_available;

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="login-error"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="login-field">
        <label className="login-label">Email</label>
        <div className="login-input-wrap">
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            required
            autoFocus
            autoComplete="email"
            placeholder="Email address"
            className="login-input"
            style={ssoInfo?.sso_available ? { paddingRight: '54px' } : undefined}
          />
          {/* SSO indicator */}
          {ssoChecking && (
            <span className="login-sso-indicator">
              <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--color-vemio-text-dim)' }} />
            </span>
          )}
          {ssoInfo?.sso_available && !ssoChecking && (
            <span className="login-sso-indicator">
              <span className="login-sso-badge">SSO</span>
            </span>
          )}
        </div>
      </div>

      {/* SSO Button */}
      {showSSOButton && (
        <button
          type="button"
          onClick={handleSSOLogin}
          disabled={loading}
          className="login-sso-btn"
        >
          {ssoInfo.provider === 'azure-ad' && (
            <svg width="18" height="18" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
          )}
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            `Sign in with ${providerLabels[ssoInfo.provider] || 'SSO'}`
          )}
        </button>
      )}

      {/* Divider when both SSO and password available */}
      {showSSOButton && showPasswordField && (
        <div className="login-divider">
          <span className="login-divider-line" />
          <span className="login-divider-text">or use password</span>
          <span className="login-divider-line" />
        </div>
      )}

      {/* SSO-enforced message */}
      {ssoInfo?.enforce_sso && (
        <p className="login-enforce-note">
          Your organization requires SSO authentication. Password login is disabled.
        </p>
      )}

      {/* Password field — hidden when SSO is enforced */}
      {showPasswordField && (
        <>
          <div className="login-field">
            <label className="login-label">Password</label>
            <div className="login-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!showSSOButton}
                autoComplete="current-password"
                placeholder="Password"
                className="login-input login-input--pw"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="login-pw-toggle"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || (!password && !showSSOButton)}
            className="login-submit"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </>
      )}
    </form>
  );
}

// ── Login Page ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { preference, resolved, setTheme } = useLoginTheme();

  return (
    <>
      <div className="login-root">
        {/* Background grid */}
        <div className="login-grid" />

        {/* Ambient glow */}
        <div className="login-glow" />

        {/* Theme toggle — top right */}
        <div className="login-theme-corner">
          <LoginThemeToggle preference={preference} onSetTheme={setTheme} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="login-container"
        >
          {/* Ribbon logo + branding */}
          <div className="login-branding">
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="login-logo-wrap"
            >
              <VemioRibbonLogo width={160} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              <h1 className="login-brand-name">
                VEMIO<span className="login-tm">™</span>
              </h1>
              <p className="login-brand-sub">Network Intelligence Platform</p>
            </motion.div>
          </div>

          {/* Login card */}
          <div className="login-card">
            <Suspense fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-vemio-amber)' }} />
              </div>
            }>
              <LoginForm />
            </Suspense>
          </div>

          {/* Footer */}
          <p className="login-footer">
            Secured by{' '}
            <a
              href="https://vinayenterprises.co.in"
              target="_blank"
              rel="noopener noreferrer"
              className="login-footer-link"
            >
              Vinay Enterprises
            </a>
            {' '}· Est. 1993
          </p>
        </motion.div>
      </div>

      <style>{`
        .login-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: var(--color-vemio-bg);
          transition: background 0.3s;
        }

        .login-grid {
  position: absolute;
  inset: 0;
  opacity: 0.2;
  background-image:
    radial-gradient(circle at center, var(--color-vemio-amber) 1px, transparent 1px),
    linear-gradient(to right, rgba(245, 158, 11, 0.15) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(245, 158, 11, 0.15) 1px, transparent 1px);
  background-size: 40px 40px, 80px 80px, 80px 80px;
  background-position: 20px 20px, 0 0, 0 0;
}

        .login-glow {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          border-radius: 50%;
          opacity: 0.04;
          background: radial-gradient(circle, #f59e0b 0%, transparent 70%);
          pointer-events: none;
        }

        .login-theme-corner {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 20;
        }

        .login-theme-toggle {
          display: flex;
          gap: 2px;
          padding: 3px;
          border-radius: 10px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }

        .login-theme-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 28px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }

        .login-theme-btn:hover {
          color: var(--color-vemio-text-muted);
        }

        .login-theme-btn--active {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-amber);
        }

        .login-container {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 0 16px;
        }

        /* ── Branding ── */
        .login-branding {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo-wrap {
          display: inline-block;
          margin-bottom: 12px;
        }

        .login-brand-name {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: var(--color-vemio-amber);
          margin: 0;
          font-family: 'Anton', sans-serif;
        }

        .login-tm {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-vemio-text-dim);
          vertical-align: super;
          margin-left: 2px;
        }

        .login-brand-sub {
          font-size: 13px;
          color: var(--color-vemio-text-muted);
          margin: 4px 0 0;
          letter-spacing: 0.02em;
        }

        /* ── Card ── */
        .login-card {
          border-radius: 16px;
          padding: 32px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
          transition: background 0.3s, border-color 0.3s;
        }
        @media (max-width: 479px) {
          .login-card { padding: 24px; }
        }

        /* ── Form ── */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .login-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 12px;
          border-radius: 10px;
          font-size: 13px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.15);
          color: var(--color-severity-high);
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-vemio-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .login-input {
          width: 100%;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
          box-sizing: border-box;
        }

        .login-input::placeholder {
          color: var(--color-vemio-text-dim);
          opacity: 0.6;
        }

        .login-input:focus {
          border-color: var(--color-vemio-amber);
        }

        .login-input--pw {
          padding-right: 44px;
        }

        .login-input-wrap {
          position: relative;
        }

        .login-pw-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-vemio-text-dim);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          transition: color 0.15s;
        }

        .login-pw-toggle:hover {
          color: var(--color-vemio-text);
        }

        /* ── SSO additions ── */
        .login-sso-indicator {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
        }

        .login-sso-badge {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          padding: 2px 7px;
          border-radius: 5px;
          background: rgba(29, 158, 117, 0.15);
          color: #1D9E75;
        }

        .login-sso-btn {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          border: 1px solid var(--color-vemio-border);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.15s, border-color 0.15s;
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text);
          font-family: inherit;
        }

        .login-sso-btn:hover:not(:disabled) {
          background: var(--color-vemio-bg);
          border-color: var(--color-vemio-text-dim);
        }

        .login-sso-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .login-divider-line {
          flex: 1;
          height: 1px;
          background: var(--color-vemio-border);
        }

        .login-divider-text {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .login-enforce-note {
          font-size: 12px;
          color: var(--color-vemio-text-muted);
          text-align: center;
          line-height: 1.5;
          margin: 0;
        }

        /* ── Submit ── */
        .login-submit {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s, transform 0.1s;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: #0a0e17;
          box-shadow: 0 2px 12px rgba(245, 158, 11, 0.25);
          font-family: inherit;
        }

        .login-submit:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .login-submit:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-submit:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* ── Footer ── */
        .login-footer {
          text-align: center;
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin-top: 24px;
        }

        .login-footer-link {
          color: var(--color-vemio-text-muted);
          text-decoration: none;
          transition: color 0.15s;
        }

        .login-footer-link:hover {
          color: var(--color-vemio-amber);
        }
          [data-theme="light"] .login-grid {
  opacity: 0.55;
}
      `}</style>
    </>
  );
}