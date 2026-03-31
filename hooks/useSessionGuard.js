/**
 * VEMIO™ — Session Expiry Handler
 * hooks/useSessionGuard.js
 *
 * Global 401 interceptor. Wraps the native fetch to detect expired sessions
 * and redirect to login with a user-friendly message.
 *
 * Usage: Add <SessionGuard /> once in your dashboard layout (DashboardShell.jsx).
 *
 * How it works:
 * - Patches window.fetch to intercept 401 responses from /api/* routes
 * - On first 401, shows a toast/overlay and redirects to /auth/login after a short delay
 * - Debounced: multiple 401s (from parallel API calls) only trigger one redirect
 * - Does NOT intercept /api/auth/* routes (NextAuth handles those)
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';

export default function SessionGuard() {
  const [expired, setExpired] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      // Only intercept /api/* routes (not /api/auth/*)
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (
        response.status === 401 &&
        url.includes('/api/') &&
        !url.includes('/api/auth/')
      ) {
        if (!handledRef.current) {
          handledRef.current = true;
          setExpired(true);

          // Redirect to login after showing the message briefly
          setTimeout(async () => {
            await signOut({ redirect: false });
            window.location.href = '/auth/login?reason=session_expired';
          }, 2500);
        }
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (!expired) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: 'var(--color-vemio-surface, #1a1a2e)',
        border: '1px solid var(--color-vemio-border, #2a2a3e)',
        borderRadius: '16px', padding: '32px 40px',
        textAlign: 'center', maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: 'rgba(245,158,11,0.12)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <h3 style={{
          fontSize: '16px', fontWeight: 600, margin: '0 0 8px',
          color: 'var(--color-vemio-text, #e2e8f0)',
        }}>
          Session Expired
        </h3>
        <p style={{
          fontSize: '13px', margin: '0 0 16px',
          color: 'var(--color-vemio-text-muted, #94a3b8)', lineHeight: '1.5',
        }}>
          Your session has expired for security. Redirecting you to sign in again...
        </p>
        <div style={{
          width: '100%', height: '3px', borderRadius: '2px',
          background: 'rgba(245,158,11,0.15)', overflow: 'hidden',
        }}>
          <div style={{
            width: '100%', height: '100%', background: '#F59E0B',
            borderRadius: '2px',
            animation: 'session-expire-bar 2.5s linear forwards',
          }} />
        </div>
        <style>{`
          @keyframes session-expire-bar {
            from { transform: translateX(-100%); }
            to { transform: translateX(0); }
          }
        `}</style>
      </div>
    </div>
  );
}