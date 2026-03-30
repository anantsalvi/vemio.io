// app/components/layout/Sidebar.jsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useBranding } from "@/hooks/useBranding";
import VemioRibbonLogo from "@/app/components/VemioRibbonLogo";
import {
  LayoutDashboard,
  Activity,
  Monitor,
  Network,
  Ticket,
  Bell,
  BellDot,
  MapPin,
  FileSearch,
  FileBarChart,
  LogOut,
  Clock,
  ChevronDown,
  Shield,
  Settings,
  Palette,
  User,
  Webhook,
  Signal,
  KeyRound,
  ScrollText,
} from "lucide-react";

/* ── Nav structure with collapsible groups ── */
const NAV_STRUCTURE = [
  { href: "/overview",     label: "Overview",      icon: LayoutDashboard },
  { href: "/intelligence", label: "Intelligence",  icon: Activity },
  {
    group: "Monitoring",
    icon: Shield,
    children: [
      { href: "/devices",      label: "Device Health",  icon: Monitor },
      { href: "/availability", label: "Availability",   icon: Signal },
      { href: "/alerts",       label: "Alerts",         icon: BellDot },
    ],
  },
  { href: "/topology",    label: "Topology",      icon: Network },
  { href: "/tickets",     label: "Tickets & SLA", icon: Ticket },
  { href: "/sites",       label: "Sites",         icon: MapPin },
  {
    group: "Reports",
    icon: FileBarChart,
    children: [
      { href: "/reports",          label: "Reports",         icon: FileBarChart },
      { href: "/rca",              label: "RCA Reports",     icon: FileSearch },
      { href: "/settings/reports", label: "Report Schedule", icon: Clock },
    ],
  },
  {
    group: "Settings",
    icon: Settings,
    children: [
      { href: "/settings/account",       label: "Account",       icon: User },
      { href: "/settings/notifications", label: "Notifications", icon: Bell },
      { href: "/settings/branding",      label: "Branding",      icon: Palette, adminOnly: true },
      { href: "/settings/sso",           label: "Single Sign-On", icon: KeyRound, adminOnly: true },
      { href: "/settings/audit-log",     label: "Audit Log",     icon: ScrollText, adminOnly: true },
      { href: '/settings/webhooks',      label: 'Webhook Log',   icon: Webhook, adminOnly: true },
    ],
  },
];

export default function Sidebar({ isRail = false, onNavigate }) {
  const pathname = usePathname();
  const sessionData = useSession();
  const session = sessionData?.data;
  const branding = useBranding();
  const [showSignout, setShowSignout] = useState(false);

  const userRole = session?.user?.role;

  // Track which groups are expanded
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand group that contains the active path
    const openGroups = new Set();
    for (const item of NAV_STRUCTURE) {
      if (item.group && item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + "/"))) {
        openGroups.add(item.group);
      }
    }
    return openGroups;
  });

  // Auto-expand group when navigating into it
  useEffect(() => {
    for (const item of NAV_STRUCTURE) {
      if (item.group && item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + "/"))) {
        setExpanded(prev => {
          const next = new Set(prev);
          next.add(item.group);
          return next;
        });
      }
    }
  }, [pathname]);

  function isActive(href) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  function toggleGroup(group) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // Filter out adminOnly items for non-admin users
  function filterChildren(children) {
    if (userRole === 'admin') return children;
    return children.filter(c => !c.adminOnly);
  }

  const hasLogo = branding.loaded && branding.logo_url;
  const companyName = branding.loaded
    ? branding.company_name || "VEMIO"
    : null; // null while loading — prevents flash

  return (
    <nav className={`sidebar ${isRail ? "sidebar--rail" : ""}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon-wrap">
          {hasLogo ? (
            <Image
              src={branding.logo_url}
              alt={branding.company_name || "Logo"}
              width={isRail ? 34 : 56}
              height={isRail ? 34 : 56}
              className="logo-img"
              unoptimized
            />
          ) : (
            <VemioRibbonLogo width={isRail ? 34 : 56} />
          )}
        </div>
        {!isRail && (
          <span className="logo-text">
            {companyName || (
              <span className="logo-skeleton" />
            )}
          </span>
        )}
      </div>

      {/* Nav items */}
      <ul className="sidebar-nav">
        {NAV_STRUCTURE.map((item) => {
          // ── Collapsible group ──
          if (item.group) {
            const visibleChildren = filterChildren(item.children);
            if (visibleChildren.length === 0) return null;

            const isOpen = expanded.has(item.group);
            const GroupIcon = item.icon;
            const hasActiveChild = visibleChildren.some(c => isActive(c.href));

            // Rail mode: show children as flat items
            if (isRail) {
              return visibleChildren.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    className={`nav-item ${isActive(href) ? "nav-item--active" : ""}`}
                    title={label}
                  >
                    <Icon size={18} className="nav-icon" />
                    {isActive(href) && <span className="rail-active-dot" aria-hidden="true" />}
                  </Link>
                </li>
              ));
            }

            return (
              <li key={item.group} className="nav-group">
                <button
                  className={`nav-group-btn ${hasActiveChild ? "nav-group-btn--active" : ""}`}
                  onClick={() => toggleGroup(item.group)}
                >
                  <GroupIcon size={18} className="nav-icon" />
                  <span className="nav-label">{item.group}</span>
                  <ChevronDown
                    size={14}
                    className={`nav-group-chevron ${isOpen ? "nav-group-chevron--open" : ""}`}
                  />
                </button>
                <ul className={`nav-group-children ${isOpen ? "nav-group-children--open" : ""}`}>
                  {visibleChildren.map(({ href, label, icon: Icon }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        className={`nav-item nav-item--child ${isActive(href) ? "nav-item--active" : ""}`}
                      >
                        <Icon size={16} className="nav-icon" />
                        <span className="nav-label">{label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }

          // ── Regular nav item ──
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={`nav-item ${isActive(item.href) ? "nav-item--active" : ""}`}
                title={isRail ? item.label : undefined}
              >
                <Icon size={18} className="nav-icon" />
                {!isRail && <span className="nav-label">{item.label}</span>}
                {isRail && isActive(item.href) && (
                  <span className="rail-active-dot" aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="sidebar-footer">
        {!isRail && session?.user && (
          <button
            className="sidebar-user"
            onClick={() => setShowSignout(prev => !prev)}
          >
            <div className="user-avatar">
              {session.user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <p className="user-name">{session.user.name}</p>
              <p className="user-role">{session.user.role ?? "viewer"}</p>
            </div>
            <ChevronDown
              size={14}
              className={`user-chevron ${showSignout ? 'user-chevron--open' : ''}`}
            />
          </button>
        )}
        {showSignout && !isRail && (
          <button
            className="signout-btn"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
        {/* Fallback sign out if session hasn't loaded yet */}
        {!isRail && !session?.user && (
          <button
            className="signout-btn"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
        {isRail && (
          <button
            className="signout-btn signout-btn--rail"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        )}

        {/* Powered by */}
        {!isRail && branding.show_powered_by && branding.powered_by_text && (
          <p className="powered-by">{branding.powered_by_text}</p>
        )}
      </div>

      <style>{`
        .sidebar {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* ── Logo area ── */
        .sidebar-logo {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px 20px 16px;
          border-bottom: 1px solid var(--vemio-border);
          flex-shrink: 0;
        }

        @media (max-height: 700px) {
          .sidebar-logo {
            padding: 12px 20px 10px;
            gap: 4px;
          }
        }

        .sidebar--rail .sidebar-logo {
          padding: 16px 6px 12px;
        }

        .logo-icon-wrap {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-img {
          flex-shrink: 0;
          object-fit: contain;
          border-radius: 4px;
        }

        .logo-text {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--vemio-text-muted);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
          min-height: 16px;
        }

        .logo-skeleton {
          display: inline-block;
          width: 80px;
          height: 12px;
          border-radius: 4px;
          background: var(--vemio-surface-raised);
          animation: logo-pulse 1.2s ease-in-out infinite;
        }
        @keyframes logo-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.15; }
        }

        /* ── Nav ── */
        .sidebar-nav {
          list-style: none;
          margin: 0;
          padding: 12px 10px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
          scrollbar-width: thin;
          scrollbar-color: var(--vemio-border) transparent;
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
          min-height: 40px;
        }

        .nav-item--child {
          padding: 7px 12px 7px 22px;
          font-size: 13px;
          min-height: 36px;
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

        /* ── Collapsible groups ── */
        .nav-group {
          list-style: none;
        }

        .nav-group-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 8px;
          color: var(--vemio-text-muted);
          font-size: 13.5px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          min-height: 40px;
          transition: background 0.15s, color 0.15s;
        }

        .nav-group-btn:hover {
          background: var(--vemio-surface-raised);
          color: var(--vemio-text);
        }

        .nav-group-btn--active {
          color: var(--vemio-amber);
        }

        .nav-group-chevron {
          margin-left: auto;
          color: var(--vemio-text-dim);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }

        .nav-group-chevron--open {
          transform: rotate(180deg);
        }

        .nav-group-children {
          list-style: none;
          margin: 0;
          padding: 0;
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.2s ease;
        }

        .nav-group-children--open {
          max-height: 300px;
        }

        /* ── Footer ── */
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
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          color: inherit;
          transition: background 0.15s;
          font-family: inherit;
        }
        .sidebar-user:hover {
          background: var(--vemio-surface-raised);
        }

        .user-chevron {
          margin-left: auto;
          color: var(--vemio-text-dim);
          transition: transform 0.2s ease;
          flex-shrink: 0;
        }
        .user-chevron--open {
          transform: rotate(180deg);
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