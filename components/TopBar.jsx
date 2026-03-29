'use client';

import { useState, useRef, useEffect } from 'react';
import { Menu, User, LogOut, Settings } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useBranding } from '@/hooks/useBranding';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';
import ThemeToggle from '@/app/components/ThemeToggle';
import AlertNotificationToggle from '@/app/components/AlertNotificationToggle';
import DeviceCategoryToggle from '@/app/components/DeviceCategoryToggle';
import TenantSwitcher from '@/app/components/dashboard/TenantSwitcher';

const PAGE_TITLES = {
  '/':                      'Overview',
  '/overview':              'Overview',
  '/intelligence':          'Business Continuity Score',
  '/devices':               'Device Health',
  '/availability':          'Availability',
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

const PAGE_TITLES_SHORT = {
  '/intelligence':          'BCS',
  '/settings/notifications': 'Notifications',
  '/settings/reports':       'Report Schedule',
  '/settings/account':       'Account',
  '/settings/webhooks':      'Webhooks',
};

export default function TopBar({ onMenuClick, isMobile }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const branding = useBranding();
  const { isMSP, selectedTenantName, isAllTenants } = useTenantSwitcher();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  const title = PAGE_TITLES[pathname] ?? 'VEMIO';
  const shortTitle = PAGE_TITLES_SHORT[pathname] || title;

  const tenantDisplay = isMSP
    ? null
    : (branding.company_name || session?.user?.tenantName || '');

  const user = session?.user;
  const isLoading = status === 'loading';

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  // Close on escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') setUserMenuOpen(false);
    }
    if (userMenuOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [userMenuOpen]);

  return (
    <>
      <header className="topbar">
        {/* Left: hamburger + page title + tenant switcher */}
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

            {isMSP ? (
              <TenantSwitcher />
            ) : tenantDisplay ? (
              <span className="topbar-tenant">{tenantDisplay}</span>
            ) : null}
          </div>
        </div>

        {/* Right: category toggle + notification + theme + avatar menu */}
        <div className="topbar-right">
          <DeviceCategoryToggle />
          <AlertNotificationToggle />
          <ThemeToggle compact />

          {isLoading ? (
            <div className="topbar-avatar-skeleton" />
          ) : user?.name ? (
            <div className="topbar-user-wrap" ref={userMenuRef}>
              <button
                className="topbar-avatar-btn"
                onClick={() => setUserMenuOpen(p => !p)}
                aria-expanded={userMenuOpen}
                aria-label="User menu"
                title={user.name}
              >
                <div
                  className="topbar-avatar"
                  style={{ background: branding.primary_color }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </button>

              {userMenuOpen && (
                <div className="topbar-user-menu">
                  <div className="topbar-user-info">
                    <p className="topbar-user-name">{user.name}</p>
                    <p className="topbar-user-role">{user.role || 'viewer'}</p>
                  </div>
                  <div className="topbar-user-divider" />
                  <button
                    className="topbar-user-option"
                    onClick={() => { setUserMenuOpen(false); router.push('/settings/account'); }}
                  >
                    <Settings size={14} />
                    <span>Account Settings</span>
                  </button>
                  <button
                    className="topbar-user-option topbar-user-option--danger"
                    onClick={() => signOut({ callbackUrl: '/login' })}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
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
          align-items: center;
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

        .topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        @media (max-width: 639px) {
          .topbar-right { gap: 4px; }
        }

        /* ── Avatar + User Menu ── */
        .topbar-user-wrap {
          position: relative;
        }

        .topbar-avatar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 2px solid transparent;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .topbar-avatar-btn:hover {
          border-color: var(--color-vemio-border);
        }
        .topbar-avatar-btn[aria-expanded="true"] {
          border-color: var(--color-vemio-amber);
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

        .topbar-user-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          padding: 6px;
          border-radius: 10px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
          animation: topbar-menu-in 0.15s ease;
          z-index: 50;
        }

        @keyframes topbar-menu-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .topbar-user-info {
          padding: 8px 10px;
        }
        .topbar-user-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-vemio-text);
          margin: 0;
        }
        .topbar-user-role {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          text-transform: capitalize;
          margin: 2px 0 0;
        }

        .topbar-user-divider {
          height: 1px;
          background: var(--color-vemio-border);
          margin: 4px 6px;
        }

        .topbar-user-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 7px;
          cursor: pointer;
          width: 100%;
          text-align: left;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--color-vemio-text-muted);
          background: transparent;
          border: none;
          transition: background 0.12s, color 0.12s;
          font-family: inherit;
        }
        .topbar-user-option:hover {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text);
        }
        .topbar-user-option--danger:hover {
          color: #EF4444;
        }

        @media (max-width: 374px) {
          .topbar-avatar-btn { display: none; }
          .topbar-avatar-skeleton { display: none; }
        }
      `}</style>
    </>
  );
}