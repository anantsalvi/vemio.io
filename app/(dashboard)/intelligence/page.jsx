'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle, TrendingDown, TrendingUp, Minus } from 'lucide-react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

function getScoreColor(s) {
  if (s >= 85) return 'var(--color-status-up)';
  if (s >= 70) return 'var(--color-vemio-amber)';
  return 'var(--color-severity-high)';
}

function getScoreLabel(s) {
  if (s >= 85) return 'Strong';
  if (s >= 70) return 'Moderate';
  if (s >= 50) return 'At Risk';
  return 'Critical';
}

// ── BCS Gauge ───────────────────────────────────────────────────────────────

function BCSScoreGauge({ score, delta }) {
  const radius = 90;
  const circumference = Math.PI * radius;
  const progress = score / 100;
  const offset = circumference * (1 - progress);
  const color = getScoreColor(score);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-56 h-auto">
        <path d="M 10 110 A 90 90 0 0 1 190 110" fill="none"
          stroke="var(--color-vemio-border)" strokeWidth="14" strokeLinecap="round" opacity="0.4" />
        <motion.path d="M 10 110 A 90 90 0 0 1 190 110" fill="none"
          stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        <text x="100" y="88" textAnchor="middle" fill="var(--color-vemio-text)"
          fontSize="36" fontWeight="700" fontFamily="inherit">
          {score}
        </text>
        <text x="100" y="108" textAnchor="middle" fill="var(--color-vemio-text-muted)"
          fontSize="11" fontFamily="inherit">
          {getScoreLabel(score)}
        </text>
      </svg>
      {delta !== 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex items-center gap-1 mt-1"
        >
          {delta > 0 ? (
            <TrendingUp className="w-3.5 h-3.5 text-status-up" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-severity-high" />
          )}
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-status-up' : 'text-severity-high'}`}>
            {Math.abs(delta)} pts from previous
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ── Dimension Bar ───────────────────────────────────────────────────────────

function DimensionBar({ label, score, weight, delay = 0 }) {
  const color = getScoreColor(score);
  const bgClass = score >= 85 ? 'bg-status-up' : score >= 70 ? 'bg-vemio-amber' : 'bg-severity-high';

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-vemio-text-muted font-medium">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-vemio-text-dim uppercase tracking-wider">{weight}% wt</span>
          <span className="text-sm font-bold tabular-nums" style={{ color }}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-vemio-border)', opacity: 0.4 }}>
        <motion.div
          className={`h-full rounded-full ${bgClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

// ── Trend Chart ─────────────────────────────────────────────────────────────

function TrendChart({ history }) {
  if (!history || history.length < 2) {
    return (
      <div className="h-44 flex items-center justify-center text-vemio-text-dim text-sm">
        BCS trend will populate as daily snapshots accumulate.
      </div>
    );
  }

  const width = 600, height = 180;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const points = history.map((h, i) => ({
    x: pad.left + (i / (history.length - 1)) * chartW,
    y: pad.top + chartH - (h.score / 100) * chartH,
    score: h.score,
    date: new Date(h.computed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1).x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 25, 50, 75, 100].map(tick => {
        const y = pad.top + chartH - (tick / 100) * chartH;
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="var(--color-vemio-border)" strokeDasharray="4 4" opacity="0.3" />
            <text x={pad.left - 8} y={y + 3} textAnchor="end"
              fill="var(--color-vemio-text-dim)" fontSize="9" fontFamily="inherit">
              {tick}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="bcs-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-vemio-amber)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-vemio-amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={areaPath} fill="url(#bcs-trend-fill)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} />
      <motion.path d={linePath} fill="none" stroke="var(--color-vemio-amber)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3"
          fill="var(--color-vemio-surface)" stroke="var(--color-vemio-amber)" strokeWidth="1.5" />
      ))}
      {[0, Math.floor(points.length / 2), points.length - 1].map(i => (
        <text key={i} x={points[i].x} y={height - 6} textAnchor="middle"
          fill="var(--color-vemio-text-dim)" fontSize="8" fontFamily="inherit">
          {points[i].date}
        </text>
      ))}
    </svg>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

const DIMENSION_META = [
  { key: 'visibility_coverage',  label: 'Visibility Coverage' },
  { key: 'redundancy_readiness', label: 'Redundancy Readiness' },
  { key: 'firmware_currency',    label: 'Firmware Currency' },
  { key: 'config_integrity',     label: 'Config Integrity' },
  { key: 'alerting_maturity',    label: 'Alerting Maturity' },
  { key: 'response_discipline',  label: 'Response Discipline' },
];

export default function IntelligencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('90d');

  useEffect(() => {
    async function fetchBCS() {
      setLoading(true);
      try {
        const res = await fetch(`/api/bcs?range=${range}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (err) {
        console.error('BCS fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBCS();
  }, [range]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  const current = data?.current;
  const dims = current?.dimensions || {};
  const weights = data?.weights || {};

  // Find weakest dimensions
  const sorted = DIMENSION_META
    .map(d => ({ ...d, score: dims[d.key] ?? 0, weight: parseFloat(weights[d.key]) || 0 }))
    .sort((a, b) => a.score - b.score);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Business Continuity Score</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">
            Infrastructure resilience across six dimensions
          </p>
        </div>
        {current?.computed_at && (
          <span className="text-[10px] text-vemio-text-dim uppercase tracking-widest">
            Computed {new Date(current.computed_at).toLocaleString('en-IN', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              timeZone: 'Asia/Kolkata',
            })} IST
          </span>
        )}
      </motion.div>

      {/* Row 1: Gauge + Dimensions */}
      <div className="grid grid-cols-12 gap-5">
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4">
          <div
            className="rounded-2xl p-6 flex flex-col items-center justify-center h-full"
            style={{
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
            }}
          >
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-3">
              Composite Score
            </p>
            <BCSScoreGauge
              score={current?.score || 0}
              delta={current?.delta || 0}
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8">
          <div
            className="rounded-2xl p-6 h-full"
            style={{
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
            }}
          >
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-4">
              Dimension Breakdown
            </p>
            <div className="space-y-4">
              {DIMENSION_META.map((dim, i) => (
                <DimensionBar
                  key={dim.key}
                  label={dim.label}
                  score={dims[dim.key] ?? 0}
                  weight={parseFloat(weights[dim.key]) || 0}
                  delay={i * 0.08}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Row 2: Trend Chart */}
      <motion.div variants={fadeUp}>
        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest">
              Score Trend
            </p>
            <div className="flex gap-1">
              {['30d', '90d', '365d'].map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className="px-3 py-1 text-[10px] rounded-md uppercase tracking-wider transition-all"
                  style={{
                    background: range === r ? 'rgba(245,158,11,0.1)' : 'transparent',
                    border: range === r ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                    color: range === r ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <TrendChart history={data?.history || []} />
        </div>
      </motion.div>

      {/* Row 3: Priority Focus Cards */}
      {current && (
        <div className="grid grid-cols-12 gap-5">
          <motion.div variants={fadeUp} className="col-span-12 md:col-span-4">
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(239, 68, 68, 0.04)',
                border: '1px solid rgba(239, 68, 68, 0.12)',
              }}
            >
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(239, 68, 68, 0.6)' }}>
                Priority Focus
              </p>
              <p className="text-sm font-semibold text-vemio-text">{sorted[0]?.label}</p>
              <p className="text-2xl font-bold mt-1 text-severity-high">{sorted[0]?.score.toFixed(1)}</p>
              <p className="text-xs text-vemio-text-dim mt-2">Lowest scoring — address first</p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="col-span-12 md:col-span-4">
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(245, 158, 11, 0.04)',
                border: '1px solid rgba(245, 158, 11, 0.12)',
              }}
            >
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(245, 158, 11, 0.6)' }}>
                Secondary Focus
              </p>
              <p className="text-sm font-semibold text-vemio-text">{sorted[1]?.label}</p>
              <p className="text-2xl font-bold mt-1 text-vemio-amber">{sorted[1]?.score.toFixed(1)}</p>
              <p className="text-xs text-vemio-text-dim mt-2">Review after priority area</p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="col-span-12 md:col-span-4">
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'var(--color-vemio-surface)',
                border: '1px solid var(--color-vemio-border)',
              }}
            >
              <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">
                Data Points
              </p>
              <p className="text-sm font-semibold text-vemio-text">
                {data?.history?.length || 0} snapshots
              </p>
              <p className="text-xs text-vemio-text-dim mt-2">
                {range === '30d' ? 'Last 30 days' : range === '90d' ? 'Last 90 days' : 'Last year'}
              </p>
              <p className="text-xs text-vemio-text-dim mt-1">
                Computed daily at midnight IST
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}