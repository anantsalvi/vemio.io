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

  return (
    <div className="theme-toggle">
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

      <style>{`
        .theme-toggle {
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

        @media (max-width: 479px) {
          .theme-toggle-label { display: none; }
        }
      `}</style>
    </div>
  );
}