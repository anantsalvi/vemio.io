'use client';

/**
 * VEMIO™ — TimeRangePicker
 * Reusable range selector for time-series charts.
 *
 * Presets: 10m / 30m / 1h / 6h / 12h / 24h / Custom
 * Controlled component — parent owns { from, to, preset } state.
 *
 * Usage:
 *   const [range, setRange] = useState(() => TimeRangePicker.defaultRange('1h'));
 *   <TimeRangePicker value={range} onChange={setRange} />
 *
 * Day 16 — Scope 2.
 */

import { useState } from 'react';

const PRESETS = [
  { id: '10m',  label: '10m',  ms: 10 * 60 * 1000 },
  { id: '30m',  label: '30m',  ms: 30 * 60 * 1000 },
  { id: '1h',   label: '1h',   ms: 60 * 60 * 1000 },
  { id: '6h',   label: '6h',   ms: 6 * 60 * 60 * 1000 },
  { id: '12h',  label: '12h',  ms: 12 * 60 * 60 * 1000 },
  { id: '24h',  label: '24h',  ms: 24 * 60 * 60 * 1000 },
];

function toDatetimeLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function defaultRange(presetId = '1h') {
  const preset = PRESETS.find(p => p.id === presetId) || PRESETS[2];
  const to = new Date();
  const from = new Date(to.getTime() - preset.ms);
  return { from, to, preset: preset.id };
}

export default function TimeRangePicker({ value, onChange, disabled = false }) {
  const [showCustom, setShowCustom] = useState(value?.preset == null);

  const handlePreset = (presetId) => {
    const preset = PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const to = new Date();
    const from = new Date(to.getTime() - preset.ms);
    setShowCustom(false);
    onChange({ from, to, preset: preset.id });
  };

  const handleCustomClick = () => {
    setShowCustom(true);
  };

  const handleCustomFrom = (e) => {
    const newFrom = fromDatetimeLocal(e.target.value);
    if (!newFrom || !value?.to || newFrom >= value.to) return;
    onChange({ from: newFrom, to: value.to, preset: null });
  };

  const handleCustomTo = (e) => {
    const newTo = fromDatetimeLocal(e.target.value);
    if (!newTo || !value?.from || value.from >= newTo) return;
    onChange({ from: value.from, to: newTo, preset: null });
  };

  const activePreset = value?.preset;

  return (
    <div className="vemio-trp">
      <div className="vemio-trp-presets">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            className={`vemio-trp-btn ${activePreset === p.id ? 'vemio-trp-btn-active' : ''}`}
            onClick={() => handlePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          className={`vemio-trp-btn ${activePreset == null ? 'vemio-trp-btn-active' : ''}`}
          onClick={handleCustomClick}
        >
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="vemio-trp-custom">
          <label className="vemio-trp-label">
            From
            <input
              type="datetime-local"
              className="vemio-trp-input"
              disabled={disabled}
              value={value?.from ? toDatetimeLocal(value.from) : ''}
              onChange={handleCustomFrom}
            />
          </label>
          <label className="vemio-trp-label">
            To
            <input
              type="datetime-local"
              className="vemio-trp-input"
              disabled={disabled}
              value={value?.to ? toDatetimeLocal(value.to) : ''}
              onChange={handleCustomTo}
            />
          </label>
        </div>
      )}

      <style jsx>{`
        .vemio-trp {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .vemio-trp-presets {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .vemio-trp-btn {
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.75);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.1s;
          font-family: inherit;
        }
        .vemio-trp-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.25);
          color: rgba(255,255,255,0.95);
        }
        .vemio-trp-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .vemio-trp-btn-active {
          background: #22c55e;
          color: #0a0a0a;
          border-color: #22c55e;
        }
        .vemio-trp-btn-active:hover:not(:disabled) {
          background: #16a34a;
          border-color: #16a34a;
          color: #0a0a0a;
        }
        .vemio-trp-custom {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .vemio-trp-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          font-weight: 500;
        }
        .vemio-trp-input {
          padding: 4px 8px;
          font-size: 12px;
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 4px;
          font-family: inherit;
          background: rgba(0,0,0,0.3);
          color: rgba(255,255,255,0.9);
          color-scheme: dark;
        }
      `}</style>
    </div>
  );
}

TimeRangePicker.defaultRange = defaultRange;
TimeRangePicker.PRESETS = PRESETS;
