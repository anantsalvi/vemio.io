/**
 * VEMIO™ — SSO Redirect Landing
 * Route: /auth/sso-complete
 * 
 * The SSO callback sets the session cookie and redirects here.
 * This page waits for the session to be recognized, then navigates to /overview.
 * This avoids the 404 flash that happens when redirecting directly to /overview
 * before the cookie is propagated.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SSOCompletePage() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    // Poll the session endpoint until it returns authenticated
    const check = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (data?.user?.tenantId) {
          router.replace('/overview');
          return;
        }
      } catch {}

      if (attempts < 10) {
        setTimeout(() => setAttempts(a => a + 1), 500);
      } else {
        router.replace('/login?error=sso_session_failed');
      }
    };
    check();
  }, [attempts, router]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      background: 'var(--color-vemio-bg, #0C0C0E)',
    }}>
      <Loader2
        size={28}
        style={{
          color: 'var(--color-vemio-amber, #C89700)',
          animation: 'spin 1s linear infinite',
        }}
      />
      <p style={{
        fontSize: '14px',
        color: 'var(--color-vemio-text-muted, rgba(232,230,225,0.55))',
      }}>
        Completing sign-in...
      </p>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}