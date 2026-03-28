'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useBranding } from '@/hooks/useBranding';
import ThemeToggle from '@/app/components/ThemeToggle';
import AlertNotificationToggle from '@/app/components/AlertNotificationToggle';
import DeviceCategoryToggle from '@/app/components/DeviceCategoryToggle';

const PAGE_TITLES = {
  '/':                      'Overview',
  '/overview':              'Overview',
  '/intelligence':          'Business Continuity Score',
  '/devices':               'Device Health',
  '/topology':              'Network Topology',
  '/tickets':               'Tickets & SLA',
  '/alerts':                'Alerts',
  '/sites':                 'Sites',
  '/rca':                   'RCA Reports',
  '/reports':               'Reports',
  '/settings/notifications': 'Notification Preferences',
  '/settings/reports':       'Report Scheduling',
  '/settings/branding':      'Branding',
  '/settings/account':       'Account Settings',
  '/settings/webhooks':      'Webhook Log',
};

/* Shorter titles for mobile to prevent truncation */
const PAGE_TITLES_SHORT = {
  '/intelligence':          'BCS',
  '/settings/notifications': 'Notifications',
  '/settings/reports':       'Report Schedule',
  '/settings/account':       'Account',
  '/settings/webhooks':      'Webhooks',
};

export default function TopBar({ onMenuClick, isMobile }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const branding = useBranding();

  const title = PAGE_TITLES[pathname] ?? 'VEMIO';
  const shortTitle = PAGE_TITLES_SHORT[pathname] || title;
  const tenantDisplay = branding.company_name || session?.user?.tenantName || '';
  const user = session?.user;
  const isLoading = status === 'loading';

  return (
    <>
      <header className="topbar">
        {/* Left: hamburger + page title */}
        <div className="topbar-left">
          {isMobile && (
            <button
              onClick={onMenuClick}
              aria-label="Open navigation"
              className="topbar-menu-btn"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="topbar-title-wrap">
            <h1 className="topbar-title topbar-title--full">{title}</h1>
            <h1 className="topbar-title topbar-title--short">{shortTitle}</h1>
            {tenantDisplay && (
              <span className="topbar-tenant">{tenantDisplay}</span>
            )}
          </div>
        </div>

        {/* Right: category toggle + notification + theme + avatar */}
        <div className="topbar-right">
          <DeviceCategoryToggle />
          <AlertNotificationToggle />
          <ThemeToggle compact />

          {isLoading ? (
            <div className="topbar-avatar-skeleton" />
          ) : user?.name ? (
            <div className="topbar-user">
              <div
                className="topbar-avatar"
                style={{ background: branding.primary_color }}
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <style>{`
        .topbar {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 30;
          gap: 12px;
          background: var(--color-vemio-surface);
          border-bottom: 1px solid var(--color-vemio-border);
        }

        @media (max-width: 639px) {
          .topbar { padding: 0 12px; gap: 8px; }
        }

        /* ── Left side ── */
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          flex: 1;
        }

        .topbar-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          flex-shrink: 0;
          cursor: pointer;
          transition: background 0.15s;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
        }
        .topbar-menu-btn:hover { background: var(--color-vemio-surface); }

        .topbar-title-wrap {
          display: flex;
          align-items: baseline;
          gap: 10px;
          min-width: 0;
        }

        .topbar-title {
          font-size: 15px;
          font-weight: 600;
          margin: 0;
          white-space: nowrap;
          color: var(--vemio-text);
        }

        /* Full title on desktop, short on mobile */
        .topbar-title--short { display: none; }
        .topbar-title--full { display: block; }

        @media (max-width: 639px) {
          .topbar-title--short { display: block; }
          .topbar-title--full { display: none; }
        }

        .topbar-tenant {
          font-size: 12px;
          padding: 1px 8px;
          border-radius: 12px;
          white-space: nowrap;
          flex-shrink: 0;
          color: var(--color-vemio-text-muted);
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
        }

        @media (max-width: 639px) {
          .topbar-tenant { display: none; }
        }

        /* ── Right side ── */
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        @media (max-width: 639px) {
          .topbar-right { gap: 4px; }
        }

        .topbar-user {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .topbar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: #000;
        }

        .topbar-avatar-skeleton {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--color-vemio-surface-raised);
          animation: topbar-pulse 1.2s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes topbar-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.2; }
        }

        .topbar-username {
          font-size: 13px;
          color: var(--color-vemio-text-muted);
        }

        /* Hide username and avatar on very small screens */
        @media (max-width: 639px) {
          .topbar-username { display: none; }
        }

        @media (max-width: 374px) {
          .topbar-avatar { display: none; }
          .topbar-avatar-skeleton { display: none; }
        }
      `}</style>
    </>
  );
}