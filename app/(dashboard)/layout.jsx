'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import AuthProvider from '@/app/components/auth/AuthProvider';
import Sidebar from '@/app/components/layout/Sidebar';
import DashboardHeader from '@/app/components/layout/DashboardHeader';
import { Loader2 } from 'lucide-react';

function DashboardShell({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vemio-bg">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-vemio-amber animate-spin" />
          <p className="text-vemio-text-muted text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen flex bg-vemio-bg">
      <Sidebar currentPath={pathname} />
      <div className="flex-1 flex flex-col min-w-0 ml-[260px]">
        <DashboardHeader session={session} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
