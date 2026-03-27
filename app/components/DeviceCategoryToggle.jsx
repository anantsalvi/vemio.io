'use client';

import { useDeviceCategory } from '@/contexts/DeviceCategoryContext';
import { Monitor, Layers } from 'lucide-react';

/**
 * VEMIO™ — Device Category Toggle
 *
 * Compact segmented control: Network | All
 * Sits in the TopBar, persists preference to DB via context.
 */
export default function DeviceCategoryToggle() {
  const { category, setCategory, loading } = useDeviceCategory();

  if (loading) return null;

  return (
    <div className="dct-root">
      <button
        onClick={() => setCategory('network')}
        className={`dct-btn ${category === 'network' ? 'dct-btn--active' : ''}`}
        title="Show network devices only"
      >
        <Monitor className="dct-icon" />
        <span className="dct-label">Network</span>
      </button>
      <button
        onClick={() => setCategory('all')}
        className={`dct-btn ${category === 'all' ? 'dct-btn--active' : ''}`}
        title="Show all devices including peripherals"
      >
        <Layers className="dct-icon" />
        <span className="dct-label">All</span>
      </button>

      <style>{`
        .dct-root {
          display: flex;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--color-vemio-border);
          flex-shrink: 0;
        }
        .dct-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-surface);
          color: var(--color-vemio-text-dim);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .dct-btn:first-child {
          border-right: 1px solid var(--color-vemio-border);
        }
        .dct-btn--active {
          background: rgba(245,158,11,0.12);
          color: var(--color-vemio-amber);
        }
        .dct-btn:hover:not(.dct-btn--active) {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text-muted);
        }
        .dct-icon {
          width: 13px;
          height: 13px;
        }
        .dct-label {
          line-height: 1;
        }
        @media (max-width: 479px) {
          .dct-label { display: none; }
          .dct-btn { padding: 5px 8px; }
        }
      `}</style>
    </div>
  );
}