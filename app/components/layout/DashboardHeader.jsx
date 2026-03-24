'use client';

import { signOut } from 'next-auth/react';
import { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, User, Clock } from 'lucide-react';

export default function DashboardHeader({ session }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const user = session?.user;

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-6 py-3"
      style={{
        background: 'rgba(10, 14, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-vemio-border)',
      }}
    >
      {/* Left: Tenant name + live indicator */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold text-vemio-text">
          {user?.tenantName || 'Dashboard'}
        </h2>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            color: 'var(--color-status-up)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-status-up animate-pulse-dot" />
          Live
        </div>
      </div>

      {/* Right: Clock + notifications + user menu */}
      <div className="flex items-center gap-4">
        {/* Clock — IST */}
        <LiveClock />

        {/* Notifications (placeholder) */}
        <button
          className="relative p-2 rounded-lg transition-colors hover:bg-vemio-surface-hover"
          title="Notifications"
        >
          <Bell className="w-4 h-4 text-vemio-text-muted" />
          {/* Notification dot */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-severity-high" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-vemio-surface-hover"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(20,184,166,0.15))',
                color: 'var(--color-vemio-amber)',
              }}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-vemio-text-muted hidden sm:block">
              {user?.name || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-vemio-text-dim" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden shadow-xl"
              style={{
                background: 'var(--color-vemio-surface)',
                border: '1px solid var(--color-vemio-border)',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--color-vemio-border)' }}>
                <p className="text-sm font-medium text-vemio-text">{user?.name}</p>
                <p className="text-xs text-vemio-text-dim mt-0.5">{user?.email}</p>
                <p className="text-[10px] text-vemio-text-dim mt-1 uppercase tracking-wider">
                  {user?.role} · {user?.vemioPlan}
                </p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-vemio-text-muted hover:text-vemio-text hover:bg-vemio-surface-hover transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Kolkata',
        })
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs text-vemio-text-dim font-mono tabular-nums">
      <Clock className="w-3.5 h-3.5" />
      <span>{time || '--:--:--'}</span>
      <span className="text-[10px] opacity-60">IST</span>
    </div>
  );
}
