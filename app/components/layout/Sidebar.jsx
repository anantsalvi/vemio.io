'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Server,
  Ticket,
  MapPin,
  FileText,
  Shield,
  Settings,
  Activity,
} from 'lucide-react';

const navItems = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/devices', label: 'Device Health', icon: Server },
  { href: '/tickets', label: 'Tickets & SLA', icon: Ticket },
  // Phase 2+
  // { href: '/sites', label: 'Sites', icon: MapPin },
  // { href: '/rca', label: 'RCA Reports', icon: FileText },
  // { href: '/reports', label: 'Reports', icon: FileText },
];

export default function Sidebar({ currentPath }) {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[260px] flex flex-col z-40"
      style={{
        background: 'var(--color-vemio-surface)',
        borderRight: '1px solid var(--color-vemio-border)',
      }}
    >
      {/* Brand */}
      <div className="px-6 py-5 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(20,184,166,0.1))',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <Shield className="w-5 h-5 text-vemio-amber" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight leading-none">
            <span className="text-vemio-amber">VEMIO</span>
            <span className="text-vemio-text-dim text-[10px] font-medium align-super ml-0.5">™</span>
          </h1>
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mt-0.5">
            Network Intelligence
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: 'var(--color-vemio-border)' }} />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || currentPath?.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group"
              style={{
                color: isActive ? 'var(--color-vemio-text)' : 'var(--color-vemio-text-muted)',
                background: isActive ? 'var(--color-vemio-surface-raised)' : 'transparent',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: 'var(--color-vemio-amber)' }}
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon
                className="w-[18px] h-[18px] shrink-0 transition-colors duration-150"
                style={{
                  color: isActive ? 'var(--color-vemio-amber)' : undefined,
                }}
              />
              <span className="group-hover:text-vemio-text transition-colors duration-150">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* System status indicator */}
      <div className="px-4 py-4">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'var(--color-vemio-surface-raised)',
            border: '1px solid var(--color-vemio-border)',
          }}
        >
          <Activity className="w-3.5 h-3.5 text-status-up" />
          <span className="text-vemio-text-muted">System</span>
          <span className="text-status-up font-medium ml-auto">Operational</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3" style={{ borderTop: '1px solid var(--color-vemio-border)' }}>
        <p className="text-[10px] text-vemio-text-dim">
          Powered by Vinay Enterprises
        </p>
      </div>
    </aside>
  );
}
