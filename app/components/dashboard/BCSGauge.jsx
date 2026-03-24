'use client';

import { motion } from 'framer-motion';

function getScoreColor(score) {
  if (score >= 90) return 'var(--color-bcs-excellent)';
  if (score >= 75) return 'var(--color-bcs-good)';
  if (score >= 60) return 'var(--color-bcs-fair)';
  if (score >= 40) return 'var(--color-bcs-poor)';
  return 'var(--color-bcs-critical)';
}

function getScoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

export default function BCSGauge({ bcs }) {
  const score = bcs?.overall ?? 0;
  const color = getScoreColor(score);
  const label = getScoreLabel(score);

  // SVG arc calculations
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270° arc
  const offset = arcLength - (arcLength * score) / 100;

  return (
    <div
      className="rounded-2xl p-6 h-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      {/* Subtle glow behind gauge */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full opacity-20 blur-3xl"
        style={{ background: color }}
      />

      <p className="text-xs font-medium text-vemio-text-muted uppercase tracking-widest mb-4 relative z-10">
        Business Continuity Score
      </p>

      {/* Gauge SVG */}
      <div className="relative w-48 h-48 z-10">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-[135deg]">
          {/* Background arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--color-vemio-border)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
          />
          {/* Score arc */}
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-bold tabular-nums"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            {score.toFixed(1)}
          </motion.span>
          <span className="text-xs text-vemio-text-muted font-medium mt-1">{label}</span>
        </div>
      </div>

      {/* Sub-scores */}
      {bcs && (
        <div className="flex gap-6 mt-4 relative z-10">
          <SubScore label="Devices" value={bcs.deviceHealth} />
          <SubScore label="Tickets" value={bcs.ticketHealth} />
          <SubScore label="SLA" value={bcs.sla} />
        </div>
      )}
    </div>
  );
}

function SubScore({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-lg font-semibold tabular-nums" style={{ color: getScoreColor(value) }}>
        {value?.toFixed(1) ?? '—'}
      </p>
      <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
