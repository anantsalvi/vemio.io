/**
 * VEMIO™ — Login Page
 * Phase 7.1: SSO support added.
 * 
 * Flow:
 * 1. User types email → debounced SSO discovery check
 * 2. If SSO available: show "Sign in with [Provider]" button
 * 3. If SSO enforced: hide password field, only show SSO button
 * 4. If no SSO: standard email/password login
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

const ERROR_MESSAGES = {
  sso_tenant_not_found: 'No organization found for your SSO account. Contact your administrator.',
  CredentialsSignin: 'Invalid email or password.',
  default: 'An error occurred during sign in.',
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError ? (ERROR_MESSAGES[urlError] || decodeURIComponent(urlError)) : '');

  // SSO state
  const [ssoInfo, setSsoInfo] = useState(null);
  const [ssoChecking, setSsoChecking] = useState(false);
  const ssoDebounceRef = useRef(null);

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
    ssoDebounceRef.current = setTimeout(() => checkSSO(val), 500);
  };

  // ── Credentials Login ──
  const handleCredentialsLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        window.location.href = '/overview';
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
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

  const showPasswordField = !ssoInfo?.enforce_sso;
  const showSSOButton = ssoInfo?.sso_available;

  const providerLabels = {
    'azure-ad': 'Microsoft',
    'google': 'Google',
    'okta': 'Okta',
    'saml': 'SSO',
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoWrap}>
          <img
            src="/vemio-logo.svg"
            alt="VEMIO"
            style={styles.logo}
          />
        </div>

        <h1 style={styles.title}>Sign in to VEMIO</h1>
        <p style={styles.subtitle}>
          {ssoInfo?.tenant_name
            ? `Signing in to ${ssoInfo.tenant_name}`
            : 'Network intelligence dashboard'
          }
        </p>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <span style={styles.errorIcon}>!</span>
            {error}
          </div>
        )}

        <form onSubmit={handleCredentialsLogin} style={styles.form}>
          {/* Email */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <div style={styles.inputWrap}>
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="you@company.com"
                style={styles.input}
                required
                autoComplete="email"
                autoFocus
              />
              {ssoChecking && (
                <div style={styles.ssoIndicator}>
                  <div style={styles.spinner} />
                </div>
              )}
              {ssoInfo?.sso_available && !ssoChecking && (
                <div style={styles.ssoIndicator}>
                  <div style={styles.ssoBadge}>SSO</div>
                </div>
              )}
            </div>
          </div>

          {/* Password (hidden when SSO enforced) */}
          {showPasswordField && (
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="Enter your password"
                style={styles.input}
                required={!showSSOButton}
                autoComplete="current-password"
              />
            </div>
          )}

          {/* SSO Button */}
          {showSSOButton && (
            <button
              type="button"
              onClick={handleSSOLogin}
              disabled={loading}
              style={styles.ssoButton}
            >
              {ssoInfo.provider === 'azure-ad' && (
                <svg style={styles.msIcon} viewBox="0 0 21 21">
                  <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                </svg>
              )}
              Sign in with {providerLabels[ssoInfo.provider] || 'SSO'}
            </button>
          )}

          {/* Divider when both options available */}
          {showSSOButton && showPasswordField && (
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or use password</span>
              <span style={styles.dividerLine} />
            </div>
          )}

          {/* Password submit button */}
          {showPasswordField && (
            <button
              type="submit"
              disabled={loading || (!password && !showSSOButton)}
              style={{
                ...styles.submitButton,
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          )}

          {/* SSO-enforced message */}
          {ssoInfo?.enforce_sso && (
            <p style={styles.enforceNote}>
              Your organization requires SSO authentication.
              Password login is disabled.
            </p>
          )}
        </form>

        <p style={styles.footer}>
          VEMIO™ by Vinay Enterprises
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--vemio-bg, #0C0C0E)',
    padding: '24px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--vemio-surface, #141418)',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.06))',
    borderRadius: '12px',
    padding: '40px 32px',
  },
  logoWrap: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logo: {
    height: '32px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    textAlign: 'center',
    color: 'var(--vemio-text, #E8E6E1)',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    textAlign: 'center',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
    marginBottom: '28px',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(226, 75, 74, 0.1)',
    border: '1px solid rgba(226, 75, 74, 0.2)',
    color: '#E24B4A',
    fontSize: '13px',
    marginBottom: '20px',
  },
  errorIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#E24B4A',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-bg, #0C0C0E)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  ssoIndicator: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  ssoBadge: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(29, 158, 117, 0.15)',
    color: '#1D9E75',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(255,255,255,0.1)',
    borderTopColor: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  ssoButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '11px 16px',
    borderRadius: '8px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-bg, #0C0C0E)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  msIcon: {
    width: '18px',
    height: '18px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    margin: '4px 0',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'var(--vemio-border, rgba(255,255,255,0.06))',
  },
  dividerText: {
    fontSize: '11px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.35))',
    whiteSpace: 'nowrap',
  },
  submitButton: {
    padding: '11px 16px',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--vemio-amber, #C89700)',
    color: '#0C0C0E',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  enforceNote: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.35))',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  footer: {
    fontSize: '11px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.25))',
    textAlign: 'center',
    marginTop: '28px',
  },
};