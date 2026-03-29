/**
 * VEMIO™ — Tenant Switcher Component
 * 
 * Dropdown in the TopBar that lets MSP users switch between managed tenants.
 * Hidden entirely for client users.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Building2, Layers } from 'lucide-react';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';

export default function TenantSwitcher() {
  const {
    isMSP, tenants, selectedTenantId, selectedTenantName,
    isAllTenants, setSelectedTenantId, loading,
  } = useTenantSwitcher();

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') setOpen(false); }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!isMSP || loading) return null;

  function handleSelect(tenantId) {
    setSelectedTenantId(tenantId);
    setOpen(false);
  }

  return (
    <>
      <div className="ts-wrap" ref={ref}>
        <button
          className="ts-trigger"
          onClick={() => setOpen(prev => !prev)}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          {isAllTenants ? (
            <Layers size={13} className="ts-trigger-icon" />
          ) : (
            <Building2 size={13} className="ts-trigger-icon" />
          )}
          <span className="ts-trigger-label">{selectedTenantName}</span>
          <ChevronDown size={11} className={`ts-chevron ${open ? 'ts-chevron--open' : ''}`} />
        </button>

        {open && (
          <div className="ts-dropdown" role="listbox">
            <button
              className={`ts-option ${selectedTenantId === 'all' ? 'ts-option--active' : ''}`}
              onClick={() => handleSelect('all')}
              role="option"
              aria-selected={selectedTenantId === 'all'}
            >
              <Layers size={14} className="ts-option-icon" />
              <span>All Tenants</span>
              <span className="ts-option-count">{tenants.length}</span>
            </button>

            <div className="ts-divider" />

            {tenants.map(t => (
              <button
                key={t.id}
                className={`ts-option ${selectedTenantId === t.id ? 'ts-option--active' : ''}`}
                onClick={() => handleSelect(t.id)}
                role="option"
                aria-selected={selectedTenantId === t.id}
              >
                <Building2 size={14} className="ts-option-icon" />
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .ts-wrap {
          position: relative;
          z-index: 50;
          flex-shrink: 1;
          min-width: 0;
        }

        .ts-trigger {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px;
          border-radius: 8px;
          cursor: pointer;
          white-space: nowrap;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: background 0.15s, border-color 0.15s;
          background: color-mix(in srgb, var(--vemio-amber) 8%, transparent);
          border: 1px solid color-mix(in srgb, var(--vemio-amber) 20%, transparent);
          color: var(--vemio-amber);
          max-width: 100%;
          overflow: hidden;
        }

        .ts-trigger:hover {
          background: color-mix(in srgb, var(--vemio-amber) 14%, transparent);
          border-color: color-mix(in srgb, var(--vemio-amber) 30%, transparent);
        }

        .ts-trigger-icon {
          flex-shrink: 0;
          opacity: 0.8;
        }

        .ts-trigger-label {
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }

        .ts-chevron {
          flex-shrink: 0;
          opacity: 0.6;
          transition: transform 0.2s ease;
        }

        .ts-chevron--open {
          transform: rotate(180deg);
        }

        /* Dropdown */
        .ts-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 200px;
          max-width: 280px;
          padding: 4px;
          border-radius: 10px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15);
          animation: ts-dropdown-in 0.15s ease;
        }

        @keyframes ts-dropdown-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ts-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 7px;
          cursor: pointer;
          width: 100%;
          text-align: left;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--color-vemio-text-muted);
          background: transparent;
          border: none;
          transition: background 0.12s, color 0.12s;
          font-family: inherit;
        }

        .ts-option:hover {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text);
        }

        .ts-option--active {
          background: color-mix(in srgb, var(--vemio-amber) 10%, transparent);
          color: var(--vemio-amber);
        }

        .ts-option--active:hover {
          background: color-mix(in srgb, var(--vemio-amber) 16%, transparent);
        }

        .ts-option-icon {
          flex-shrink: 0;
          opacity: 0.6;
        }

        .ts-option-count {
          margin-left: auto;
          font-size: 10px;
          padding: 1px 6px;
          border-radius: 10px;
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text-dim);
        }

        .ts-divider {
          height: 1px;
          background: var(--color-vemio-border);
          margin: 4px 6px;
        }
      `}</style>
    </>
  );
}