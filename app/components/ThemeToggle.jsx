'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const MODES = [
  { key: 'light',  icon: Sun,     label: 'Light'  },
  { key: 'dark',   icon: Moon,    label: 'Dark'   },
  { key: 'system', icon: Monitor, label: 'System' },
];

export default function ThemeToggle({ compact = false }) {
  const { preference, setPreference } = useTheme();

  // Cycle: light → dark → system → light
  function cycleTheme() {
    const currentIdx = MODES.findIndex(m => m.key === preference);
    const nextIdx = (currentIdx + 1) % MODES.length;
    setPreference(MODES[nextIdx].key);
  }

  const currentMode = MODES.find(m => m.key === preference) || MODES[2];
  const CurrentIcon = currentMode.icon;

  return (
    <>
      {/* Desktop: 3-button segmented control */}
      <div className="theme-toggle theme-toggle--desktop">
        {MODES.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setPreference(key)}
            className={`theme-toggle-btn ${preference === key ? 'theme-toggle-btn--active' : ''}`}
            title={label}
            aria-label={`${label} theme`}
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && <span className="theme-toggle-label">{label}</span>}
          </button>
        ))}
      </div>

      {/* Mobile: single cycle button */}
      <button
        className="theme-cycle-btn"
        onClick={cycleTheme}
        title={`Theme: ${currentMode.label} (tap to change)`}
        aria-label={`Current theme: ${currentMode.label}. Tap to switch.`}
      >
        <CurrentIcon className="w-4 h-4" />
      </button>

      <style>{`
        /* ── Desktop: segmented 3-button ── */
        .theme-toggle--desktop {
          display: flex;
          gap: 2px;
          padding: 3px;
          border-radius: 10px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
        }

        .theme-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 7px;
          border: none;
          background: transparent;
          color: var(--color-vemio-text-dim);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          flex: 1;
          min-height: 28px;
        }

        .theme-toggle-btn:hover {
          color: var(--color-vemio-text-muted);
        }

        .theme-toggle-btn--active {
          background: var(--color-vemio-surface);
          color: var(--color-vemio-amber);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }

        .theme-toggle-label {
          font-size: 10px;
        }

        /* ── Mobile: single cycle button ── */
        .theme-cycle-btn {
          display: none;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 8px;
          border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface);
          color: var(--color-vemio-text-muted);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .theme-cycle-btn:hover {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-amber);
        }

        /* ── Breakpoint: swap at 640px ── */
        @media (max-width: 639px) {
          .theme-toggle--desktop { display: none; }
          .theme-cycle-btn { display: flex; }
        }

        @media (min-width: 640px) {
          .theme-toggle--desktop { display: flex; }
          .theme-cycle-btn { display: none; }
        }
      `}</style>
    </>
  );
}