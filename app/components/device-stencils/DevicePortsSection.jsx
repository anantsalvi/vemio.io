'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, ChevronDown, ChevronUp, Cable,
} from 'lucide-react';
import DeviceStencil from './DeviceStencil';
import PortDetailsPanel from './PortDetailsPanel';

/**
 * DevicePortsSection
 *
 * Self-contained section for device detail page.
 * Fetches port data from /api/devices/[id]/ports
 * and renders stencil + table.
 *
 * Props:
 *   deviceId — UUID
 *   device   — { make, model, type, name, status } (from parent page)
 */
export default function DevicePortsSection({ deviceId, device }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [selectedPort, setSelectedPort] = useState(null);

  const fetchPorts = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/devices/${deviceId}/ports`);
      if (res.status === 404) { setData(null); return; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.error('Failed to fetch ports:', err);
      setError('Failed to load port data');
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => { fetchPorts(); }, [fetchPorts]);

  const hasPorts = data?.ports?.length > 0;

  return (
    <div className="dps-root">
      {/* Header — always visible */}
      <button
        className="dps-header"
        onClick={() => setExpanded(prev => !prev)}
      >
        <div className="dps-header-left">
          <Cable className="w-4 h-4" style={{ color: 'var(--color-vemio-amber)', flexShrink: 0 }} />
          <div>
            <h3 className="dps-title">Ports & Interfaces</h3>
            <p className="dps-subtitle">
              {loading
                ? 'Loading port data…'
                : hasPorts
                  ? `${data.summary.totalPorts} ports · ${data.summary.up} online · ${data.summary.withConnection} connected`
                  : 'No port data available'}
            </p>
          </div>
        </div>
        <div className="dps-header-right">
          {!loading && hasPorts && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchPorts(); }}
              className="dps-refresh-btn"
              title="Refresh port data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
          ) : (
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--color-vemio-text-dim)' }} />
          )}
        </div>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="dps-body"
          >
            <div className="dps-body-inner">
              {loading && !data && (
                <div className="dps-loading">
                  <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--color-vemio-amber)' }} />
                  <span>Loading port data…</span>
                </div>
              )}

              {error && (
                <div className="dps-error">
                  <span>{error}</span>
                  <button onClick={fetchPorts} className="dps-retry-btn">Retry</button>
                </div>
              )}

              {!loading && !error && !hasPorts && (
                <div className="dps-empty">
                  <Cable className="w-8 h-8" style={{ color: 'var(--color-vemio-text-dim)', marginBottom: 4 }} />
                  <p>No port data has been collected for this device yet.</p>
                  <p className="dps-empty-hint">Port data is populated by the topology worker from Auvik.</p>
                </div>
              )}

              {hasPorts && (
                <>
                  {/* Hardware stencil */}
                  <DeviceStencil
                    device={device}
                    ports={data.ports}
                    selectedPort={selectedPort}
                    onPortSelect={setSelectedPort}
                  />

                  {/* Port details table */}
                  <div className="dps-divider" />

                  <PortDetailsPanel
                    ports={data.ports}
                    summary={data.summary}
                    selectedPort={selectedPort}
                    onPortSelect={setSelectedPort}
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .dps-root {
          border-radius: 16px;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }

        .dps-header {
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
        .dps-header:hover {
          background: rgba(255,255,255,0.02);
        }

        .dps-header-left {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-width: 0;
        }
        .dps-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .dps-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
        }
        .dps-subtitle {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 2px 0 0;
        }

        .dps-refresh-btn {
          padding: 5px;
          border-radius: 6px;
          border: 1px solid var(--color-vemio-border);
          background: transparent;
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background 0.12s;
        }
        .dps-refresh-btn:hover {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text-muted);
        }

        .dps-body {
          overflow: hidden;
        }
        .dps-body-inner {
          padding: 0 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .dps-divider {
          height: 1px;
          background: var(--color-vemio-border);
          margin: 4px 0;
        }

        .dps-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 32px;
          font-size: 13px;
          color: var(--color-vemio-text-dim);
        }

        .dps-error {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 24px;
          font-size: 13px;
          color: var(--color-status-down);
        }
        .dps-retry-btn {
          padding: 4px 12px;
          border-radius: 6px;
          font-size: 12px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          cursor: pointer;
        }

        .dps-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px;
          text-align: center;
        }
        .dps-empty p {
          font-size: 13px;
          color: var(--color-vemio-text-dim);
          margin: 4px 0 0;
        }
        .dps-empty-hint {
          font-size: 11px !important;
          opacity: 0.6;
        }

        @media (max-width: 479px) {
          .dps-header { padding: 12px 14px; }
          .dps-body-inner { padding: 0 14px 14px; }
        }
      `}</style>
    </div>
  );
}