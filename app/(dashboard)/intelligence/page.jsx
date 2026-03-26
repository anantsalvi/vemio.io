'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, TrendingDown, TrendingUp, HelpCircle, X, Eye, Shield, Cpu, Settings, Bell, Clock } from 'lucide-react';

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

// ── Dimension Explanations ───────────────────────────────────────────────────

const DIMENSION_EXPLAIN = {
  visibility_coverage: {
    icon: Eye,
    title: 'Visibility Coverage',
    what: 'Measures how many of your monitored devices have a known status (online, offline, or degraded) versus unknown.',
    how: 'Devices with active status reporting divided by total monitored devices.',
    improve: [
      'Ensure SNMP or agent-based monitoring is enabled on all infrastructure devices',
      'Investigate devices stuck in "unknown" status — they may have lost connectivity to the monitoring collector',
      'Add new devices to the monitored inventory as they are deployed',
    ],
  },
  redundancy_readiness: {
    icon: Shield,
    title: 'Redundancy Readiness',
    what: 'Evaluates whether your critical infrastructure devices (firewalls, core switches, routers) have high-availability or failover configurations.',
    how: 'Critical devices with redundancy confirmed divided by critical devices assessed.',
    improve: [
      'Deploy HA pairs for firewalls and core switches',
      'Document redundancy status for all critical devices in VEMIO',
      'Consider dual-WAN or SD-WAN for internet breakout redundancy',
    ],
  },
  firmware_currency: {
    icon: Cpu,
    title: 'Firmware Currency',
    what: 'Tracks whether your devices are running current, vendor-supported firmware versions.',
    how: 'Devices on current firmware divided by devices with firmware data available.',
    improve: [
      'Schedule quarterly firmware review cycles for all managed devices',
      'Prioritise firmware updates for internet-facing devices (firewalls, routers)',
      'Track vendor end-of-support dates — devices on unsupported firmware score 0',
    ],
  },
  config_integrity: {
    icon: Settings,
    title: 'Configuration Integrity',
    what: 'Measures whether critical device configurations have been validated (backed up and reviewed) within the last 90 days.',
    how: 'Critical devices with config validated in the last 90 days divided by total critical devices.',
    improve: [
      'Enable automated config backup via Auvik or a config management tool',
      'Schedule quarterly config reviews for all critical infrastructure',
      'Document a baseline config for each device type to compare against',
    ],
  },
  alerting_maturity: {
    icon: Bell,
    title: 'Alerting Maturity',
    what: 'Measures the ratio of system-detected (proactive) tickets versus manually created tickets in the last 90 days.',
    how: 'Tickets created automatically by monitoring divided by total tickets.',
    improve: [
      'Configure Auvik alert rules for all critical failure conditions',
      'Enable VEMIO auto-ticket creation from persistent alerts',
      'Reduce manual ticket creation by improving monitoring coverage',
    ],
  },
  response_discipline: {
    icon: Clock,
    title: 'Response Discipline',
    what: 'Tracks the percentage of resolved tickets that met their SLA targets in the last 90 days.',
    how: 'Tickets resolved within SLA divided by total resolved tickets.',
    improve: [
      'Review and tighten SLA response and resolution targets',
      'Implement escalation rules for tickets approaching SLA deadlines',
      'Analyse SLA misses to identify recurring root causes',
    ],
  },
};

// ── BCS Explanation Panel ────────────────────────────────────────────────────

function BCSExplainPanel({ isOpen, onClose, dims, weights }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="bcs-explain-overflow"
        >
          <div className="bcs-explain-panel">
            <div className="bcs-explain-header">
              <div>
                <h3 className="bcs-explain-title">How is the BCS calculated?</h3>
                <p className="bcs-explain-sub">
                  The Business Continuity Score is a weighted composite of six infrastructure health dimensions, each scored 0–100.
                </p>
              </div>
              <button onClick={onClose} className="bcs-explain-close" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bcs-explain-formula">
              <span className="bcs-explain-formula-label">Composite Score</span>
              <span className="bcs-explain-formula-eq">
                = Σ (dimension score × weight%)
              </span>
            </div>

            <div className="bcs-explain-grid">
              {Object.entries(DIMENSION_EXPLAIN).map(([key, info]) => {
                const Icon = info.icon;
                const score = dims?.[key] ?? 0;
                const weight = parseFloat(weights?.[key]) || 0;
                const color = getScoreColor(score);

                return (
                  <div key={key} className="bcs-explain-card">
                    <div className="bcs-explain-card-header">
                      <div className="bcs-explain-icon-wrap" style={{ background: `${color}15` }}>
                        <Icon className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="bcs-explain-card-title-group">
                        <span className="bcs-explain-card-title">{info.title}</span>
                        <span className="bcs-explain-card-meta">
                          <span className="bcs-explain-card-score" style={{ color }}>{score.toFixed(1)}</span>
                          <span className="bcs-explain-card-weight">{weight}% weight</span>
                        </span>
                      </div>
                    </div>

                    <p className="bcs-explain-what">{info.what}</p>

                    <div className="bcs-explain-how">
                      <span className="bcs-explain-how-label">Calculation</span>
                      <span className="bcs-explain-how-text">{info.how}</span>
                    </div>

                    <div className="bcs-explain-improve">
                      <span className="bcs-explain-improve-label">How to improve</span>
                      <ul className="bcs-explain-improve-list">
                        {info.improve.map((tip, i) => (
                          <li key={i} className="bcs-explain-improve-item">{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── BCS Gauge ────────────────────────────────────────────────────────────────

function BCSScoreGauge({ score, delta }) {
  const radius       = 90;
  const circumference = Math.PI * radius;
  const offset       = circumference * (1 - score / 100);
  const color        = getScoreColor(score);

  return (
    <div className="bcs-gauge-wrap">
      <svg viewBox="0 0 200 120" className="bcs-gauge-svg">
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
          fontSize="36" fontWeight="700" fontFamily="inherit">{score}</text>
        <text x="100" y="108" textAnchor="middle" fill="var(--color-vemio-text-muted)"
          fontSize="11" fontFamily="inherit">{getScoreLabel(score)}</text>
      </svg>
      {delta !== 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bcs-delta"
        >
          {delta > 0
            ? <TrendingUp  className="w-3.5 h-3.5 text-status-up"       />
            : <TrendingDown className="w-3.5 h-3.5 text-severity-high"  />}
          <span className={`text-xs font-semibold ${delta > 0 ? 'text-status-up' : 'text-severity-high'}`}>
            {Math.abs(delta)} pts from previous
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ── Dimension Bar ─────────────────────────────────────────────────────────────

function DimensionBar({ label, score, weight, delay = 0 }) {
  const color   = getScoreColor(score);
  const bgClass = score >= 85 ? 'bg-status-up' : score >= 70 ? 'bg-vemio-amber' : 'bg-severity-high';

  return (
    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}>
      <div className="dim-bar-header">
        <span className="dim-bar-label">{label}</span>
        <div className="dim-bar-meta">
          <span className="dim-bar-weight">{weight}% wt</span>
          <span className="dim-bar-score" style={{ color }}>{score.toFixed(1)}</span>
        </div>
      </div>
      <div className="dim-bar-track">
        <motion.div className={`dim-bar-fill ${bgClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

// ── Trend Chart ───────────────────────────────────────────────────────────────

function TrendChart({ history }) {
  if (!history || history.length < 2) {
    return (
      <div className="trend-empty">BCS trend will populate as daily snapshots accumulate.</div>
    );
  }

  const width = 600, height = 180;
  const pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width  - pad.left - pad.right;
  const chartH = height - pad.top  - pad.bottom;

  const points = history.map((h, i) => ({
    x:     pad.left + (i / (history.length - 1)) * chartW,
    y:     pad.top  + chartH - (h.score / 100) * chartH,
    score: h.score,
    date:  new Date(h.computed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points.at(-1).x} ${pad.top + chartH} L ${points[0].x} ${pad.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
      {[0, 25, 50, 75, 100].map(tick => {
        const y = pad.top + chartH - (tick / 100) * chartH;
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={width - pad.right} y2={y}
              stroke="var(--color-vemio-border)" strokeDasharray="4 4" opacity="0.3" />
            <text x={pad.left - 8} y={y + 3} textAnchor="end"
              fill="var(--color-vemio-text-dim)" fontSize="9" fontFamily="inherit">{tick}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="bcs-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--color-vemio-amber)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-vemio-amber)" stopOpacity="0"    />
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

// ── Main Page ─────────────────────────────────────────────────────────────────

const DIMENSION_META = [
  { key: 'visibility_coverage',  label: 'Visibility Coverage'  },
  { key: 'redundancy_readiness', label: 'Redundancy Readiness' },
  { key: 'firmware_currency',    label: 'Firmware Currency'    },
  { key: 'config_integrity',     label: 'Config Integrity'     },
  { key: 'alerting_maturity',    label: 'Alerting Maturity'    },
  { key: 'response_discipline',  label: 'Response Discipline'  },
];

export default function IntelligencePage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange]     = useState('90d');
  const [showExplain, setShowExplain] = useState(false);

  useEffect(() => {
    async function fetchBCS() {
      setLoading(true);
      try {
        const res = await fetch(`/api/bcs?range=${range}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (err) { console.error('BCS fetch error:', err); }
      finally { setLoading(false); }
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
  const dims    = current?.dimensions || {};
  const weights = data?.weights       || {};

  const sorted = DIMENSION_META
    .map(d => ({ ...d, score: dims[d.key] ?? 0, weight: parseFloat(weights[d.key]) || 0 }))
    .sort((a, b) => a.score - b.score);

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="intel-root">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} className="intel-header">
          <div>
            <h1 className="intel-title">Business Continuity Score</h1>
            <p className="intel-subtitle">Infrastructure resilience across six dimensions</p>
          </div>
          <div className="intel-header-right">
            <button
              onClick={() => setShowExplain(prev => !prev)}
              className="intel-explain-btn"
              aria-label="How is this scored?"
            >
              <HelpCircle className="w-4 h-4" />
              <span className="intel-explain-btn-text">How is this scored?</span>
            </button>
            {current?.computed_at && (
              <span className="intel-computed">
                Computed{' '}
                {new Date(current.computed_at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                  timeZone: 'Asia/Kolkata',
                })}{' '}IST
              </span>
            )}
          </div>
        </motion.div>

        {/* ── Explanation Panel (toggles) ── */}
        <BCSExplainPanel
          isOpen={showExplain}
          onClose={() => setShowExplain(false)}
          dims={dims}
          weights={weights}
        />

        {/* ── Row 1: Gauge + Dimensions ── */}
        <div className="intel-row-1">
          <motion.div variants={fadeUp} className="intel-gauge-panel">
            <p className="intel-panel-eyebrow">Composite Score</p>
            <BCSScoreGauge score={current?.score || 0} delta={current?.delta || 0} />
          </motion.div>

          <motion.div variants={fadeUp} className="intel-dims-panel">
            <p className="intel-panel-eyebrow">Dimension Breakdown</p>
            <div className="intel-dims-list">
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
          </motion.div>
        </div>

        {/* ── Row 2: Trend Chart ── */}
        <motion.div variants={fadeUp}>
          <div className="intel-panel">
            <div className="intel-trend-header">
              <p className="intel-panel-eyebrow" style={{ margin: 0 }}>Score Trend</p>
              <div className="intel-range-btns">
                {['30d', '90d', '365d'].map(r => (
                  <button key={r} onClick={() => setRange(r)} className="intel-range-btn"
                    style={{
                      background: range === r ? 'rgba(245,158,11,0.1)' : 'transparent',
                      border:     range === r ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                      color:      range === r ? 'var(--color-vemio-amber)' : 'var(--color-vemio-text-dim)',
                    }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <TrendChart history={data?.history || []} />
          </div>
        </motion.div>

        {/* ── Row 3: Priority Focus Cards ── */}
        {current && (
          <div className="intel-focus-row">
            <motion.div variants={fadeUp}>
              <div className="intel-focus-card intel-focus-card--critical">
                <p className="intel-focus-eyebrow intel-focus-eyebrow--critical">Priority Focus</p>
                <p className="intel-focus-name">{sorted[0]?.label}</p>
                <p className="intel-focus-score text-severity-high">{sorted[0]?.score.toFixed(1)}</p>
                <p className="intel-focus-hint">Lowest scoring — address first</p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="intel-focus-card intel-focus-card--amber">
                <p className="intel-focus-eyebrow intel-focus-eyebrow--amber">Secondary Focus</p>
                <p className="intel-focus-name">{sorted[1]?.label}</p>
                <p className="intel-focus-score text-vemio-amber">{sorted[1]?.score.toFixed(1)}</p>
                <p className="intel-focus-hint">Review after priority area</p>
              </div>
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="intel-focus-card intel-focus-card--neutral">
                <p className="intel-focus-eyebrow intel-focus-eyebrow--dim">Data Points</p>
                <p className="intel-focus-name">{data?.history?.length || 0} snapshots</p>
                <p className="intel-focus-hint" style={{ marginTop: 8 }}>
                  {range === '30d' ? 'Last 30 days' : range === '90d' ? 'Last 90 days' : 'Last year'}
                </p>
                <p className="intel-focus-hint">Computed daily at midnight IST</p>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>

      <style>{`
        .intel-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }
        @media (max-width: 767px) { .intel-root { gap: 14px; } }

        /* ── Header ── */
        .intel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .intel-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
        }
        .intel-subtitle {
          font-size: 13px;
          color: var(--vemio-text-muted);
          margin: 3px 0 0;
        }
        .intel-header-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
          flex-shrink: 0;
        }
        .intel-explain-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          color: var(--color-vemio-amber);
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.15);
          transition: background 0.15s;
        }
        .intel-explain-btn:hover {
          background: rgba(245, 158, 11, 0.14);
        }
        @media (max-width: 479px) {
          .intel-explain-btn-text { display: none; }
          .intel-explain-btn { padding: 8px; }
        }
        .intel-computed {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: nowrap;
        }
        @media (max-width: 479px) { .intel-computed { display: none; } }

        /* ── Explanation Panel ── */
        .bcs-explain-overflow {
          overflow: hidden;
        }
        .bcs-explain-panel {
          border-radius: 16px;
          padding: 24px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        @media (max-width: 479px) {
          .bcs-explain-panel { padding: 16px; }
        }
        .bcs-explain-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }
        .bcs-explain-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-vemio-text);
          margin: 0;
        }
        .bcs-explain-sub {
          font-size: 12px;
          color: var(--color-vemio-text-muted);
          margin: 4px 0 0;
          max-width: 540px;
          line-height: 1.5;
        }
        .bcs-explain-close {
          padding: 6px;
          border-radius: 6px;
          border: 1px solid var(--color-vemio-border);
          background: transparent;
          color: var(--color-vemio-text-muted);
          cursor: pointer;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: background 0.15s;
        }
        .bcs-explain-close:hover {
          background: var(--color-vemio-surface-raised);
        }

        .bcs-explain-formula {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          background: var(--color-vemio-surface-raised);
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .bcs-explain-formula-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-vemio-amber);
        }
        .bcs-explain-formula-eq {
          font-size: 12px;
          color: var(--color-vemio-text-muted);
          font-family: var(--font-mono);
        }

        .bcs-explain-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        @media (max-width: 767px) {
          .bcs-explain-grid { grid-template-columns: 1fr; }
        }

        .bcs-explain-card {
          border-radius: 12px;
          padding: 16px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
        }
        .bcs-explain-card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .bcs-explain-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .bcs-explain-card-title-group {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .bcs-explain-card-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-vemio-text);
        }
        .bcs-explain-card-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }
        .bcs-explain-card-score {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .bcs-explain-card-weight {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
        }
        .bcs-explain-what {
          font-size: 12px;
          color: var(--color-vemio-text-muted);
          line-height: 1.5;
          margin: 0 0 10px;
        }
        .bcs-explain-how {
          padding: 8px 10px;
          border-radius: 6px;
          background: rgba(20, 184, 166, 0.05);
          border: 1px solid rgba(20, 184, 166, 0.1);
          margin-bottom: 10px;
        }
        .bcs-explain-how-label {
          display: block;
          font-size: 9px;
          font-weight: 600;
          color: var(--color-vemio-teal);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 3px;
        }
        .bcs-explain-how-text {
          font-size: 11px;
          color: var(--color-vemio-text-muted);
          font-family: var(--font-mono);
          line-height: 1.4;
        }
        .bcs-explain-improve {
          margin: 0;
        }
        .bcs-explain-improve-label {
          display: block;
          font-size: 9px;
          font-weight: 600;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 6px;
        }
        .bcs-explain-improve-list {
          margin: 0;
          padding-left: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .bcs-explain-improve-item {
          font-size: 11px;
          color: var(--color-vemio-text-muted);
          line-height: 1.4;
        }

        /* ── Row 1: Gauge (1fr) + Dims (2fr), stacks on tablet/mobile ── */
        .intel-row-1 {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 1023px) {
          .intel-row-1 { grid-template-columns: 1fr; }
        }

        /* Shared panel shell */
        .intel-panel,
        .intel-gauge-panel,
        .intel-dims-panel {
          border-radius: 16px;
          padding: 20px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        @media (max-width: 479px) {
          .intel-panel,
          .intel-gauge-panel,
          .intel-dims-panel { padding: 14px; }
        }

        .intel-gauge-panel {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .intel-panel-eyebrow {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 12px;
        }

        .bcs-gauge-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 100%;
        }
        .bcs-gauge-svg {
          width: min(224px, 100%);
          height: auto;
        }
        .bcs-delta {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
        }

        /* Dimension bars */
        .intel-dims-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .dim-bar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .dim-bar-label {
          font-size: 13px;
          color: var(--vemio-text-muted);
          font-weight: 500;
        }
        .dim-bar-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dim-bar-weight {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .dim-bar-score {
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          min-width: 36px;
          text-align: right;
        }
        .dim-bar-track {
          height: 8px;
          border-radius: 99px;
          overflow: hidden;
          background: var(--color-vemio-border);
          opacity: 0.8;
        }
        .dim-bar-fill {
          height: 100%;
          border-radius: 99px;
        }

        /* Trend chart */
        .intel-trend-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .intel-range-btns {
          display: flex;
          gap: 4px;
        }
        .intel-range-btn {
          padding: 4px 10px;
          font-size: 10px;
          border-radius: 6px;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          transition: background 0.15s, color 0.15s;
          min-height: 28px;
        }
        .trend-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .trend-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 176px;
          font-size: 13px;
          color: var(--color-vemio-text-dim);
          text-align: center;
        }

        /* ── Row 3: Focus cards ── */
        .intel-focus-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 767px) {
          .intel-focus-row { grid-template-columns: 1fr; gap: 10px; }
        }

        .intel-focus-card {
          border-radius: 16px;
          padding: 18px;
        }
        .intel-focus-card--critical {
          background: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.12);
        }
        .intel-focus-card--amber {
          background: rgba(245, 158, 11, 0.04);
          border: 1px solid rgba(245, 158, 11, 0.12);
        }
        .intel-focus-card--neutral {
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .intel-focus-eyebrow {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin: 0 0 6px;
        }
        .intel-focus-eyebrow--critical { color: rgba(239, 68, 68, 0.6); }
        .intel-focus-eyebrow--amber    { color: rgba(245, 158, 11, 0.6); }
        .intel-focus-eyebrow--dim      { color: var(--color-vemio-text-dim); }
        .intel-focus-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
        }
        .intel-focus-score {
          font-size: 26px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          margin: 4px 0 0;
        }
        .intel-focus-hint {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 6px 0 0;
        }
      `}</style>
    </>
  );
}