'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useBranding } from '@/hooks/useBranding';

const PAGE_TITLES = {
  '/':                      'Overview',
  '/overview':              'Overview',
  '/intelligence':          'Business Continuity Score',
  '/devices':               'Device Health',
  '/tickets':               'Tickets & SLA',
  '/alerts':                'Alerts',
  '/sites':                 'Sites',
  '/rca':                   'RCA Reports',
  '/reports':               'Reports',
  '/settings/notifications': 'Notification Preferences',
  '/settings/reports':       'Report Scheduling',
  '/settings/branding':      'Branding',
};

export default function TopBar({ onMenuClick, isMobile }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const branding = useBranding();

  const title = PAGE_TITLES[pathname] ?? 'VEMIO';
  const tenantDisplay = branding.company_name || session?.user?.tenantName || '';
  const user = session?.user;
  const isLoading = status === 'loading';

  return (
    <header
      className="h-14 flex items-center justify-between px-6 max-sm:px-3 sticky top-0 z-30 gap-3"
      style={{
        background: 'var(--color-vemio-surface)',
        borderBottom: '1px solid var(--color-vemio-border)',
      }}
    >
      {/* Left: hamburger + page title */}
      <div className="flex items-center gap-3 min-w-0">
        {isMobile && (
          <button
            onClick={onMenuClick}
            aria-label="Open navigation"
            className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0
                       cursor-pointer transition-colors border"
            style={{
              background: 'var(--color-vemio-surface-raised)',
              borderColor: 'var(--color-vemio-border)',
              color: 'var(--color-vemio-text)',
            }}
          >
            <Menu size={20} />
          </button>
        )}
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-[15px] font-semibold m-0 whitespace-nowrap truncate text-vemio-text">
            {title}
          </h1>
          {tenantDisplay && (
            <span
              className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0
                         max-sm:hidden text-vemio-text-muted"
              style={{
                background: 'var(--color-vemio-surface-raised)',
                border: '1px solid var(--color-vemio-border)',
              }}
            >
              {tenantDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Right: user info */}
      <div className="flex items-center shrink-0">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full animate-pulse"
              style={{ background: 'var(--color-vemio-surface-raised)' }}
            />
            <div
              className="h-3 w-16 rounded animate-pulse max-sm:hidden"
              style={{ background: 'var(--color-vemio-surface-raised)' }}
            />
          </div>
        ) : user?.name ? (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full text-[13px] font-bold
                         flex items-center justify-center shrink-0"
              style={{
                background: branding.primary_color,
                color: '#000',
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="text-[13px] max-sm:hidden text-vemio-text-muted">
              {user.name}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}