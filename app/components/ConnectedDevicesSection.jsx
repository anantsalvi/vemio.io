'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Network, ExternalLink, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
  up:       '#22c55e',
  down:     '#ef4444',
  degraded: '#f59e0b',
  unknown:  '#6b7280',
};

export default function ConnectedDevicesSection({ deviceId }) {
  const router = useRouter();
  const [neighbors, setNeighbors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const fetchNeighbors = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/devices/${deviceId}/neighbors`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setNeighbors(data.neighbors || []);
    } catch {
      setNeighbors([]);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { fetchNeighbors(); }, [fetchNeighbors]);

  if (!loading && neighbors.length === 0) return null;

  return (
    <div className="cds-root">
      <button className="cds-header" onClick={() => setExpanded(p => !p)}>
        <div className="cds-header-left">
          <Network className="w-4 h-4" style={{ color: '#3b82f6', flexShrink: 0 }} />
          <div>
            <h3 className="cds-title">Connected Devices</h3>
            <p className="cds-subtitle">
              {loading ? 'Loading...' : `${neighbors.length} neighbor${neighbors.length !== 1 ? 's' : ''} discovered`}
            </p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
          : <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
        }
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="cds-body">
              {loading ? (
                <div className="cds-loading">
                  <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--color-vemio-amber)' }} />
                </div>
              ) : (
                <div className="cds-list">
                  {neighbors.map((n, i) => (
                    <button
                      key={`${n.deviceId || i}`}
                      className="cds-item"
                      onClick={() => n.deviceId && router.push(`/devices/${n.deviceId}`)}
                      style={{ cursor: n.deviceId ? 'pointer' : 'default' }}
                    >
                      <span className="cds-dot" style={{ background: STATUS_COLORS[n.status] || STATUS_COLORS.unknown }} />
                      <div className="cds-item-info">
                        <span className="cds-item-name">{n.name}</span>
                        <div className="cds-item-meta">
                          {n.ipAddress && <span className="cds-item-ip">{n.ipAddress}</span>}
                          {n.type && <span className="cds-item-type">{n.type.replace(/_/g, ' ')}</span>}
                          {n.make && <span className="cds-item-make">{n.make}</span>}
                        </div>
                        <div className="cds-item-ports">
                          {n.localInterface && <span className="cds-port-tag">{n.localInterface}</span>}
                          {n.localInterface && n.remoteInterface && <span className="cds-port-arrow">{'\u2194'}</span>}
                          {n.remoteInterface && <span className="cds-port-tag">{n.remoteInterface}</span>}
                          {n.connectionType && n.connectionType !== 'physical' && (
                            <span className="cds-conn-tag">{n.connectionType}</span>
                          )}
                        </div>
                      </div>
                      {n.deviceId && <ExternalLink className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.3, marginTop: 2 }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .cds-root {
          border-radius: 16px;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .cds-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          cursor: pointer;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
          color: inherit;
          transition: background 0.12s;
          font-family: inherit;
        }
        .cds-header:hover { background: rgba(255,255,255,0.02); }
        .cds-header-left { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
        .cds-title { font-size: 13px; font-weight: 600; color: var(--vemio-text); margin: 0; }
        .cds-subtitle { font-size: 11px; color: var(--color-vemio-text-dim); margin: 2px 0 0; }
        .cds-body { padding: 0 20px 16px; }
        .cds-loading { display: flex; justify-content: center; padding: 20px; }
        .cds-list { display: flex; flex-direction: column; gap: 2px; max-height: 400px; overflow-y: auto; }
        .cds-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          border: none;
          background: transparent;
          text-align: left;
          color: inherit;
          font-family: inherit;
          transition: background 0.12s;
          width: 100%;
        }
        .cds-item:hover { background: rgba(255,255,255,0.03); }
        .cds-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .cds-item-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .cds-item-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-vemio-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cds-item-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .cds-item-ip {
          font-size: 11px;
          font-family: monospace;
          color: var(--color-vemio-text-muted);
          font-weight: 500;
        }
        .cds-item-type {
          font-size: 9px;
          text-transform: capitalize;
          color: var(--color-vemio-text-dim);
          background: rgba(148,163,184,0.08);
          padding: 1px 5px;
          border-radius: 3px;
        }
        .cds-item-make {
          font-size: 9px;
          color: var(--color-vemio-text-dim);
        }
        .cds-item-ports { display: flex; align-items: center; gap: 3px; margin-top: 1px; }
        .cds-port-tag {
          font-size: 9px;
          font-family: monospace;
          color: var(--color-vemio-text-dim);
          background: rgba(148,163,184,0.08);
          padding: 1px 5px;
          border-radius: 3px;
        }
        .cds-port-arrow { font-size: 9px; color: var(--color-vemio-text-dim); }
        .cds-conn-tag {
          font-size: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 1px 5px;
          border-radius: 3px;
          background: rgba(6,182,212,0.12);
          color: #06B6D4;
        }
        @media (max-width: 479px) {
          .cds-header { padding: 12px 14px; }
          .cds-body { padding: 0 14px 12px; }
        }
      `}</style>
    </div>
  );
}