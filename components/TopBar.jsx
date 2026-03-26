// app/components/TopBar.jsx
"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const PAGE_TITLES = {
  "/": "Overview",
  "/overview": "Overview",
  "/intelligence": "Business Continuity Score",
  "/devices": "Device Health",
  "/tickets": "Tickets & SLA",
  "/alerts": "Alerts",
  "/sites": "Sites",
  "/rca": "RCA Reports",
  "/reports": "Reports",
  "/settings/notifications": "Notification Preferences",
  "/settings/reports": "Report Scheduling",
};

export default function TopBar({ onMenuClick, isMobile }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const title = PAGE_TITLES[pathname] ?? "VEMIO";
  const tenant = session?.user?.tenantName ?? "";

  return (
    <header className="vemio-topbar">
      {/* Left: hamburger (mobile only) + page title */}
      <div className="topbar-left">
        {isMobile && (
          <button
            className="topbar-menu-btn"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="topbar-title-group">
          <h1 className="topbar-title">{title}</h1>
          {tenant && <span className="topbar-tenant">{tenant}</span>}
        </div>
      </div>

      {/* Right: breadcrumb / user info */}
      <div className="topbar-right">
        {session?.user?.name && (
          <div className="topbar-user">
            <div className="topbar-avatar">
              {session.user.name.charAt(0).toUpperCase()}
            </div>
            <span className="topbar-username">{session.user.name}</span>
          </div>
        )}
      </div>

      <style>{`
        .vemio-topbar {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: var(--vemio-surface);
          border-bottom: 1px solid var(--vemio-border);
          position: sticky;
          top: 0;
          z-index: 30;
          gap: 12px;
        }

        @media (max-width: 767px) {
          .vemio-topbar {
            padding: 0 12px;
          }
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .topbar-menu-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: var(--vemio-surface-raised);
          border: 1px solid var(--vemio-border);
          color: var(--vemio-text);
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.15s;
        }
        .topbar-menu-btn:hover {
          background: var(--vemio-border);
        }

        .topbar-title-group {
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 10px;
        }

        .topbar-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--vemio-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin: 0;
        }

        .topbar-tenant {
          font-size: 12px;
          color: var(--vemio-text-muted);
          background: var(--vemio-surface-raised);
          border: 1px solid var(--vemio-border);
          padding: 2px 8px;
          border-radius: 20px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        @media (max-width: 479px) {
          .topbar-tenant { display: none; }
        }

        .topbar-right {
          display: flex;
          align-items: center;
          flex-shrink: 0;
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
          background: var(--vemio-amber);
          color: #000;
          font-size: 13px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .topbar-username {
          font-size: 13px;
          color: var(--vemio-text-muted);
        }

        @media (max-width: 479px) {
          .topbar-username { display: none; }
        }
      `}</style>
    </header>
  );
}
