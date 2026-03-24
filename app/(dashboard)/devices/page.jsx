'use client';

import { Server } from 'lucide-react';

export default function DevicesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'var(--color-vemio-teal-soft)',
          border: '1px solid rgba(20, 184, 166, 0.2)',
        }}
      >
        <Server className="w-7 h-7 text-vemio-teal" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-vemio-text">Device Health</h2>
        <p className="text-sm text-vemio-text-muted mt-1">
          Coming in Phase 2 — real-time device inventory with uptime history
        </p>
      </div>
    </div>
  );
}
