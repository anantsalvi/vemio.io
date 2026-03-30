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

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function SSOCompletePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/overview');
    } else if (status === 'unauthenticated') {
      // Session cookie didn't work -- retry once then give up
      const timer = setTimeout(() => {
        router.replace('/login?error=sso_session_failed');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

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