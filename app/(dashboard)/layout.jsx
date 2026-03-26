// app/(dashboard)/layout.jsx
"use client";

import { useSidebar } from "@/hooks/useSidebar";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function DashboardLayout({ children }) {
  const sidebar = useSidebar();

  return (
    <div className="vemio-layout">
      {/* ── Backdrop (mobile drawer overlay) ── */}
      {sidebar.isMobile && sidebar.drawerOpen && (
        <div
          className="vemio-backdrop"
          onClick={sidebar.closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className="vemio-sidebar"
        data-mode={sidebar.mode}
        data-open={sidebar.drawerOpen}
        style={{ width: sidebar.sidebarWidth }}
      >
        <Sidebar
          isRail={sidebar.isRail}
          onNavigate={sidebar.isMobile ? sidebar.closeDrawer : undefined}
        />
      </aside>

      {/* ── Main area ── */}
      <div
        className="vemio-main"
        style={{
          marginLeft:
            sidebar.isMobile ? 0 : sidebar.sidebarWidth,
        }}
      >
        <TopBar onMenuClick={sidebar.toggleDrawer} isMobile={sidebar.isMobile} />
        <main className="vemio-content">{children}</main>
      </div>

      <style>{`
        .vemio-layout {
          display: flex;
          min-height: 100vh;
          background: var(--vemio-bg);
          position: relative;
        }

        /* Backdrop */
        .vemio-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px);
          z-index: 40;
        }

        /* Sidebar */
        .vemio-sidebar {
          position: fixed;
          top: 0;
          left: 0;
          height: 100vh;
          background: var(--vemio-surface);
          border-right: 1px solid var(--vemio-border);
          z-index: 50;
          overflow: hidden;
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
                      width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          flex-shrink: 0;
        }

        /* Mobile: hidden by default, slide in when open */
        .vemio-sidebar[data-mode="mobile"] {
          transform: translateX(-100%);
        }
        .vemio-sidebar[data-mode="mobile"][data-open="true"] {
          transform: translateX(0);
        }

        /* Tablet / Desktop: always visible */
        .vemio-sidebar[data-mode="tablet"],
        .vemio-sidebar[data-mode="desktop"] {
          transform: translateX(0);
        }

        /* Main */
        .vemio-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          transition: margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .vemio-content {
          flex: 1;
          padding: 24px;
          overflow-x: hidden;
        }

        @media (max-width: 767px) {
          .vemio-content {
            padding: 16px 12px;
          }
        }

        @media (min-width: 768px) and (max-width: 1023px) {
          .vemio-content {
            padding: 20px 16px;
          }
        }
      `}</style>
    </div>
  );
}