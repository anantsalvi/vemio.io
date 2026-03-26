// app/components/layout/Sidebar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useBranding } from "@/hooks/useBranding";
import VemioRibbonLogo from "@/app/components/VemioRibbonLogo";
import ThemeToggle from '@/app/components/ThemeToggle';
import {
  LayoutDashboard,
  Activity,
  Monitor,
  Ticket,
  Bell,
  MapPin,
  FileSearch,
  FileBarChart,
  LogOut,
  Clock
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/overview",      label: "Overview",       icon: LayoutDashboard },
  { href: "/intelligence",  label: "Intelligence",   icon: Activity },
  { href: "/devices",       label: "Device Health",  icon: Monitor },
  { href: "/tickets",       label: "Tickets & SLA",  icon: Ticket },
  { href: "/alerts",        label: "Alerts",         icon: Bell },
  { href: "/sites",         label: "Sites",          icon: MapPin },
  { href: "/rca",           label: "RCA Reports",    icon: FileSearch },
  { href: "/reports",       label: "Reports",        icon: FileBarChart },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell     },
  { href: '/settings/reports',       label: 'Report Schedule', icon: Clock },
];

export default function Sidebar({ isRail = false, onNavigate }) {
  const pathname = usePathname();
  const sessionData = useSession();
  const session = sessionData?.data;
  const branding = useBranding();

  function isActive(href) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const hasLogo = branding.loaded && branding.logo_url;

  return (
    <nav className={`sidebar ${isRail ? "sidebar--rail" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        {hasLogo ? (
          <Image
            src={branding.logo_url}
            alt={branding.company_name || "Logo"}
            width={isRail ? 28 : 24}
            height={isRail ? 28 : 24}
            className="logo-img"
            unoptimized
          />
        ) : (
          <VemioRibbonLogo width={isRail ? 28 : 24} />
        )}
        {!isRail && (
          <span className="logo-text">
            {branding.loaded ? branding.company_name || "VEMIO" : "VEMIO"}
          </span>
        )}
      </div>

      {/* Nav items */}
      <ul className="sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              className={`nav-item ${isActive(href) ? "nav-item--active" : ""}`}
              title={isRail ? label : undefined}
            >
              <Icon size={18} className="nav-icon" />
              {!isRail && <span className="nav-label">{label}</span>}
              {isRail && isActive(href) && (
                <span className="rail-active-dot" aria-hidden="true" />
              )}
            </Link>
          </li>
        ))}
      </ul>

      {/* Footer */}
      <div className="sidebar-footer">
      {!isRail && <ThemeToggle />}
        {/* Powered by */}
        {!isRail && branding.show_powered_by && branding.powered_by_text && (
          <p className="powered-by">{branding.powered_by_text}</p>
        )}

        {!isRail && session?.user && (
          <div className="sidebar-user">
            <div className="user-avatar">
              {session.user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <p className="user-name">{session.user.name}</p>
              <p className="user-role">{session.user.role ?? "viewer"}</p>
            </div>
          </div>
        )}
        <button
          className={`signout-btn ${isRail ? "signout-btn--rail" : ""}`}
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Sign out"
        >
          <LogOut size={16} />
          {!isRail && <span>Sign out</span>}
        </button>
      </div>

      <style>{`
        .sidebar {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .sidebar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 20px;
          height: 56px;
          border-bottom: 1px solid var(--vemio-border);
          flex-shrink: 0;
        }

        .sidebar--rail .sidebar-logo {
          justify-content: center;
          padding: 0;
        }

        .logo-img {
          flex-shrink: 0;
          object-fit: contain;
          border-radius: 4px;
        }

        .logo-text {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--vemio-text);
        }

        .sidebar-nav {
          list-style: none;
          margin: 0;
          padding: 12px 10px;
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar--rail .sidebar-nav {
          padding: 12px 6px;
          align-items: center;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          color: var(--vemio-text-muted);
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 500;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          position: relative;
          min-height: 44px;
        }

        .sidebar--rail .nav-item {
          padding: 10px;
          justify-content: center;
          width: 48px;
          height: 48px;
          min-height: unset;
          border-radius: 10px;
          gap: 0;
        }

        .nav-item:hover {
          background: var(--vemio-surface-raised);
          color: var(--vemio-text);
        }

        .nav-item--active {
          background: color-mix(in srgb, var(--vemio-amber) 12%, transparent);
          color: var(--vemio-amber);
        }

        .nav-item--active:hover {
          background: color-mix(in srgb, var(--vemio-amber) 18%, transparent);
          color: var(--vemio-amber);
        }

        .nav-icon {
          flex-shrink: 0;
        }

        .nav-label {
          flex: 1;
        }

        .rail-active-dot {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--vemio-amber);
        }

        .sidebar-footer {
          padding: 12px 10px;
          border-top: 1px solid var(--vemio-border);
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-shrink: 0;
        }

        .sidebar--rail .sidebar-footer {
          align-items: center;
          padding: 12px 6px;
        }

        .powered-by {
          font-size: 10px;
          color: var(--vemio-text-dim);
          text-align: center;
          margin: 0 0 4px;
          opacity: 0.6;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 4px;
        }

        .user-avatar {
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

        .user-info {
          min-width: 0;
        }

        .user-name {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--vemio-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin: 0;
        }

        .user-role {
          font-size: 11px;
          color: var(--vemio-text-dim);
          text-transform: capitalize;
          margin: 0;
        }

        .signout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid var(--vemio-border);
          color: var(--vemio-text-muted);
          font-size: 13px;
          cursor: pointer;
          width: 100%;
          min-height: 36px;
          transition: background 0.15s, color 0.15s;
        }

        .signout-btn:hover {
          background: var(--vemio-surface-raised);
          color: var(--vemio-text);
        }

        .signout-btn--rail {
          width: 40px;
          height: 40px;
          min-height: unset;
          padding: 0;
          border-radius: 10px;
        }
      `}</style>
    </nav>
  );
}