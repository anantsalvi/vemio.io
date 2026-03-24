'use client';

import { Ticket } from 'lucide-react';

export default function TicketsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'var(--color-vemio-amber-soft)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
        }}
      >
        <Ticket className="w-7 h-7 text-vemio-amber" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-semibold text-vemio-text">Tickets & SLA</h2>
        <p className="text-sm text-vemio-text-muted mt-1">
          Coming in Phase 3 — Frappe Helpdesk integration with SLA tracking
        </p>
      </div>
    </div>
  );
}
