'use client';

import { AlertTriangle, CheckCircle2, Bell, Wrench, FileText } from 'lucide-react';

const eventIcons = {
  alert: { icon: Bell, color: 'var(--color-severity-high)' },
  resolved: { icon: CheckCircle2, color: 'var(--color-status-up)' },
  maintenance: { icon: Wrench, color: 'var(--color-vemio-text-dim)' },
  report: { icon: FileText, color: 'var(--color-vemio-teal)' },
};

const severityColors = {
  critical: 'var(--color-severity-critical)',
  high: 'var(--color-severity-high)',
  medium: 'var(--color-severity-medium)',
  low: 'var(--color-severity-low)',
  info: 'var(--color-severity-info)',
};

export default function RecentEvents({ events }) {
  const items = events || [];

  return (
    <div
      className="rounded-2xl p-6 h-full flex flex-col"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      <h3 className="text-sm font-semibold text-vemio-text mb-4">Recent Activity</h3>

      {items.length > 0 ? (
        <div className="space-y-1 flex-1 overflow-auto">
          {items.map((event, i) => {
            const config = eventIcons[event.type] || eventIcons.alert;
            const Icon = config.icon;

            return (
              <div
                key={i}
                className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-vemio-surface-hover"
              >
                {/* Icon */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{
                    background: `${config.color}15`,
                  }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-vemio-text leading-relaxed">{event.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-vemio-text-dim font-mono">{event.time}</span>
                    <span className="text-[10px] text-vemio-text-dim">·</span>
                    <span className="text-[10px] text-vemio-text-dim">{event.site}</span>
                    {event.severity && event.severity !== 'info' && (
                      <>
                        <span className="text-[10px] text-vemio-text-dim">·</span>
                        <span
                          className="text-[10px] font-medium uppercase tracking-wider"
                          style={{ color: severityColors[event.severity] }}
                        >
                          {event.severity}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-vemio-text-dim">
          No recent events
        </div>
      )}
    </div>
  );
}
