'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Bell, Wrench, FileText,
  ChevronDown, ChevronUp, ArrowRight, Clock, Filter,
} from 'lucide-react';

const eventIcons = {
  alert:       { icon: Bell,         color: 'var(--color-severity-high)' },
  resolved:    { icon: CheckCircle2, color: 'var(--color-status-up)' },
  maintenance: { icon: Wrench,       color: 'var(--color-vemio-text-dim)' },
  report:      { icon: FileText,     color: 'var(--color-vemio-teal)' },
};

const severityColors = {
  critical: 'var(--color-severity-critical)',
  high:     'var(--color-severity-high)',
  medium:   'var(--color-severity-medium)',
  low:      'var(--color-severity-low)',
  info:     'var(--color-severity-info)',
};

function isUnknownDevice(event) {
  const name = event.device_name || event.message || '';
  return (
    /unidentified/i.test(name) ||
    /^device@/i.test(name) ||
    /unknown device/i.test(name) ||
    /^[\d.]+$/.test(name)
  );
}

function relativeTime(timeStr) {
  if (!timeStr) return '';
  const now = new Date();
  const [h, m] = timeStr.split(':').map(Number);
  const eventDate = new Date(now);
  eventDate.setHours(h, m, 0, 0);
  if (eventDate > now) eventDate.setDate(eventDate.getDate() - 1);
  const diffMs = now - eventDate;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ${diffMin % 60}m ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

const FILTER_OPTIONS = [
  { value: 'all',     label: 'All' },
  { value: 'known',   label: 'Known' },
  { value: 'unknown', label: 'Unknown' },
];

export default function RecentEvents({ events }) {
  const router = useRouter();
  const items = events || [];
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [deviceFilter, setDeviceFilter] = useState('all');

  const toggleExpand = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const filteredItems = useMemo(() => {
    if (deviceFilter === 'all') return items;
    if (deviceFilter === 'known') return items.filter(e => !isUnknownDevice(e));
    if (deviceFilter === 'unknown') return items.filter(e => isUnknownDevice(e));
    return items;
  }, [items, deviceFilter]);

  const knownCount = useMemo(() => items.filter(e => !isUnknownDevice(e)).length, [items]);
  const unknownCount = useMemo(() => items.filter(e => isUnknownDevice(e)).length, [items]);

  return (
    <div className="re-card">
      {/* Header */}
      <div className="re-header">
        <div className="re-header-left">
          <h3 className="re-title">Recent Activity</h3>
          {filteredItems.length > 0 && (
            <span className="re-count">{filteredItems.length}</span>
          )}
        </div>
        {items.length > 0 && (
          <button className="re-view-all" onClick={() => router.push('/alerts')}>
            View all <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Filter bar */}
      {items.length > 0 && (
        <div className="re-filter-bar">
          {FILTER_OPTIONS.map(opt => {
            const count = opt.value === 'all' ? items.length : opt.value === 'known' ? knownCount : unknownCount;
            return (
              <button
                key={opt.value}
                className={`re-filter-btn ${deviceFilter === opt.value ? 're-filter-btn--active' : ''}`}
                onClick={() => { setDeviceFilter(opt.value); setExpandedIndex(null); }}
              >
                {opt.label} <span className="re-filter-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Event list */}
      {filteredItems.length > 0 ? (
        <div className="re-scroll">
          {filteredItems.map((event, i) => {
            const config = eventIcons[event.type] || eventIcons.alert;
            const isExpanded = expandedIndex === i;
            const hasDetails = event.device_name || event.duration || event.details || event.deviceType;
            const relative = relativeTime(event.time);

            return (
              <div key={i} className="re-item-wrap">
                <button
                  className={`re-item ${event.type === 'alert' ? 're-item--alert' : ''}`}
                  onClick={hasDetails ? () => toggleExpand(i) : undefined}
                  style={{ cursor: hasDetails ? 'pointer' : 'default' }}
                >
                  <div className="re-timeline">
                    <div className="re-dot" style={{ background: config.color }} />
                    {i < filteredItems.length - 1 && <div className="re-line" />}
                  </div>
                  <div className="re-content">
                    <p className="re-message">{event.message}</p>
                    <div className="re-meta">
                      <span className="re-time">
                        <Clock className="w-2.5 h-2.5" style={{ opacity: 0.5 }} />
                        {relative || event.time}
                      </span>
                      {event.site && (
                        <>
                          <span className="re-meta-sep">·</span>
                          <span className="re-site">{event.site}</span>
                        </>
                      )}
                      {event.severity && event.severity !== 'info' && (
                        <span className="re-severity" style={{
                          color: severityColors[event.severity],
                          background: `${severityColors[event.severity]}12`,
                        }}>
                          {event.severity}
                        </span>
                      )}
                    </div>
                  </div>
                  {hasDetails && (
                    <div className="re-expand-icon">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  )}
                </button>

                {isExpanded && hasDetails && (
                  <div className="re-detail">
                    {event.device_name && (
                      <div className="re-detail-row">
                        <span className="re-detail-label">Device</span>
                        {event.device_id ? (
                          <button className="re-detail-link"
                            onClick={(e) => { e.stopPropagation(); router.push(`/devices/${event.device_id}`); }}>
                            {event.device_name}
                          </button>
                        ) : (
                          <span className="re-detail-value">{event.device_name}</span>
                        )}
                      </div>
                    )}
                    {event.ip_address && (
                      <div className="re-detail-row">
                        <span className="re-detail-label">IP</span>
                        <span className="re-detail-value re-detail-mono">{event.ip_address}</span>
                      </div>
                    )}
                    {event.deviceType && (
                      <div className="re-detail-row">
                        <span className="re-detail-label">Type</span>
                        <span className="re-detail-value">{event.deviceType}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : items.length > 0 ? (
        <div className="re-empty">
          <Filter className="w-5 h-5" style={{ color: 'var(--color-vemio-text-dim)', opacity: 0.4 }} />
          <p className="re-empty-title">No {deviceFilter} device events</p>
          <p className="re-empty-sub">Try a different filter</p>
        </div>
      ) : (
        <div className="re-empty">
          <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--color-status-up)', opacity: 0.4 }} />
          <p className="re-empty-title">All quiet</p>
          <p className="re-empty-sub">No status changes in the last 24 hours</p>
        </div>
      )}

      <style>{`
        .re-card {
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          height: 340px;
        }

        .re-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .re-header-left { display: flex; align-items: center; gap: 8px; }
        .re-title { font-size: 13px; font-weight: 600; color: var(--vemio-text); margin: 0; }
        .re-count {
          font-size: 10px; color: var(--color-vemio-text-dim);
          background: var(--color-vemio-surface-raised);
          padding: 2px 7px; border-radius: 10px; font-variant-numeric: tabular-nums;
        }
        .re-view-all {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; color: var(--color-vemio-amber); background: transparent;
          border: none; cursor: pointer; padding: 4px 8px; border-radius: 6px;
          font-family: inherit; font-weight: 500; transition: background 0.12s;
        }
        .re-view-all:hover { background: rgba(245, 158, 11, 0.06); }

        .re-filter-bar { display: flex; gap: 4px; margin-bottom: 10px; flex-shrink: 0; }
        .re-filter-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 500;
          cursor: pointer; border: 1px solid var(--color-vemio-border);
          background: transparent; color: var(--color-vemio-text-dim);
          font-family: inherit; transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .re-filter-btn:hover { background: var(--color-vemio-surface-raised); color: var(--color-vemio-text-muted); }
        .re-filter-btn--active {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.2);
          color: var(--color-vemio-amber);
        }
        .re-filter-count { font-size: 9px; font-weight: 600; opacity: 0.6; }

        .re-scroll {
          flex: 1; overflow-y: auto; min-height: 0;
          display: flex; flex-direction: column;
          scrollbar-width: thin; scrollbar-color: var(--color-vemio-border) transparent;
        }
        .re-scroll::-webkit-scrollbar { width: 4px; }
        .re-scroll::-webkit-scrollbar-track { background: transparent; }
        .re-scroll::-webkit-scrollbar-thumb { background: var(--color-vemio-border); border-radius: 4px; }

        .re-item-wrap { position: relative; }
        .re-item {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 7px 6px; border-radius: 8px; width: 100%;
          background: transparent; border: none; transition: background 0.12s;
          font-family: inherit; text-align: left;
        }
        .re-item:hover { background: var(--color-vemio-surface-raised); }

        .re-timeline { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; padding-top: 3px; width: 10px; }
        .re-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .re-item--alert .re-dot { animation: re-dot-pulse 2s ease-in-out infinite; }
        @keyframes re-dot-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0); }
        }
        .re-line { width: 1px; flex: 1; min-height: 14px; background: var(--color-vemio-border); margin-top: 2px; }

        .re-content { flex: 1; min-width: 0; }
        .re-message { font-size: 12px; color: var(--vemio-text); margin: 0; line-height: 1.35; }
        .re-meta { display: flex; align-items: center; gap: 5px; margin-top: 2px; flex-wrap: wrap; }
        .re-time { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: var(--color-vemio-text-dim); font-variant-numeric: tabular-nums; }
        .re-meta-sep { font-size: 10px; color: var(--color-vemio-text-dim); opacity: 0.4; }
        .re-site { font-size: 10px; color: var(--color-vemio-text-dim); }
        .re-severity { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; padding: 1px 5px; border-radius: 3px; }
        .re-expand-icon { flex-shrink: 0; color: var(--color-vemio-text-dim); padding-top: 2px; }

        .re-detail { padding: 2px 6px 8px 27px; display: flex; flex-direction: column; gap: 2px; }
        .re-detail-row { display: flex; align-items: baseline; gap: 8px; }
        .re-detail-label { font-size: 9px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.05em; width: 42px; flex-shrink: 0; }
        .re-detail-value { font-size: 11px; color: var(--color-vemio-text-muted); }
        .re-detail-mono { font-family: monospace; font-size: 10px; }
        .re-detail-link {
          font-size: 11px; color: var(--color-vemio-amber); background: none; border: none;
          cursor: pointer; padding: 0; font-family: inherit; font-weight: 500;
        }
        .re-detail-link:hover { opacity: 0.8; }

        .re-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 6px;
        }
        .re-empty-title { font-size: 13px; font-weight: 500; color: var(--color-vemio-text-muted); margin: 0; }
        .re-empty-sub { font-size: 11px; color: var(--color-vemio-text-dim); margin: 0; }

        @media (max-width: 767px) {
          .re-card { height: auto; max-height: 340px; }
        }
      `}</style>
    </div>
  );
}