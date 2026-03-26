'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Bell, Wrench, FileText, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="recent-events-card">
      <h3 className="text-sm font-semibold text-vemio-text mb-3 px-1 shrink-0">
        Recent Activity
      </h3>

      {items.length > 0 ? (
        <div className="recent-events-scroll">
          {items.map((event, i) => {
            const config = eventIcons[event.type] || eventIcons.alert;
            const Icon = config.icon;
            const isExpanded = expandedIndex === i;
            const hasDetails = event.device_name || event.duration || event.details;

            return (
              <div key={i} className="recent-events-item-wrapper">
                <button
                  className="recent-events-item"
                  onClick={hasDetails ? () => toggleExpand(i) : undefined}
                  style={{ cursor: hasDetails ? 'pointer' : 'default' }}
                >
                  {/* Icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${config.color}15` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
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

                  {/* Expand chevron */}
                  {hasDetails && (
                    <div className="shrink-0 text-vemio-text-dim">
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5" />
                        : <ChevronDown className="w-3.5 h-3.5" />
                      }
                    </div>
                  )}
                </button>

                {/* Expanded detail panel */}
                {isExpanded && hasDetails && (
                  <div className="recent-events-detail">
                    {event.device_name && (
                      <div className="detail-row">
                        <span className="detail-label">Device</span>
                        <span className="detail-value">{event.device_name}</span>
                      </div>
                    )}
                    {event.duration && (
                      <div className="detail-row">
                        <span className="detail-label">Duration</span>
                        <span className="detail-value">{event.duration}</span>
                      </div>
                    )}
                    {event.details && (
                      <div className="detail-row">
                        <span className="detail-label">Details</span>
                        <span className="detail-value">{event.details}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-vemio-text-dim">
          No recent events
        </div>
      )}

      <style>{`
        .recent-events-card {
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          /* Match UptimeChart height — adjust if your chart differs */
          height: 340px;
        }

        .recent-events-scroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
          /* Subtle scrollbar */
          scrollbar-width: thin;
          scrollbar-color: var(--color-vemio-border) transparent;
        }

        .recent-events-scroll::-webkit-scrollbar {
          width: 4px;
        }

        .recent-events-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .recent-events-scroll::-webkit-scrollbar-thumb {
          background: var(--color-vemio-border);
          border-radius: 4px;
        }

        .recent-events-item-wrapper {
          border-radius: 8px;
        }

        .recent-events-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 10px;
          border-radius: 8px;
          width: 100%;
          background: transparent;
          border: none;
          transition: background 0.15s;
          font-family: inherit;
        }

        .recent-events-item:hover {
          background: var(--color-vemio-surface-raised);
        }

        /* Expanded detail */
        .recent-events-detail {
          padding: 6px 10px 10px 49px; /* 7 icon + 12 gap + 30 offset */
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .detail-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          width: 56px;
          flex-shrink: 0;
        }

        .detail-value {
          font-size: 11px;
          color: var(--color-vemio-text-muted);
        }

        @media (max-width: 767px) {
          .recent-events-card {
            height: auto;
            max-height: 320px;
          }
        }
      `}</style>
    </div>
  );
}