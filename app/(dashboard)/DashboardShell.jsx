'use client';

import { SessionProvider } from 'next-auth/react';
import { useSidebar } from '@/hooks/useSidebar';
import { BrandingProvider } from '@/hooks/useBranding';
import Sidebar from '@/app/components/layout/Sidebar';
import TopBar from '@/components/TopBar';

export default function DashboardShell({ children }) {
  const sidebar = useSidebar();

  return (
    <SessionProvider>
      <BrandingProvider>
        <div className="flex min-h-screen relative" style={{ background: 'var(--color-vemio-bg)' }}>

          {/* Backdrop (mobile drawer overlay) */}
          {sidebar.isMobile && sidebar.drawerOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40"
              onClick={sidebar.closeDrawer}
              aria-hidden="true"
            />
          )}

          {/* Sidebar */}
          <aside
            className="fixed top-0 left-0 h-screen shrink-0 overflow-hidden z-50
                       transition-[transform,width] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{
              width: sidebar.sidebarWidth,
              background: 'var(--color-vemio-surface)',
              borderRight: '1px solid var(--color-vemio-border)',
              transform: sidebar.isMobile && !sidebar.drawerOpen
                ? 'translateX(-100%)'
                : 'translateX(0)',
            }}
          >
            <Sidebar
              isRail={sidebar.isRail}
              onNavigate={sidebar.isMobile ? sidebar.closeDrawer : undefined}
            />
          </aside>

          {/* Main area */}
          <div
            className="flex-1 min-w-0 flex flex-col transition-[margin-left] duration-[250ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ marginLeft: sidebar.isMobile ? 0 : sidebar.sidebarWidth }}
          >
            <TopBar onMenuClick={sidebar.toggleDrawer} isMobile={sidebar.isMobile} />
            <main className="flex-1 p-6 max-sm:px-3 max-sm:py-4 md:max-lg:px-4 md:max-lg:py-5 overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
      </BrandingProvider>
    </SessionProvider>
  );
}