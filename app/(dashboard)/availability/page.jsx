'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTenantFetch } from '@/hooks/useTenantFetch';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';
import { useDeviceCategory } from '@/contexts/DeviceCategoryContext';
import {
  AlertTriangle, Clock, Server, ChevronDown, ChevronUp,
  ArrowDownRight, Shield, TrendingUp, Target
} from 'lucide-react';

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } } };
const DAY_OPTIONS = [{ value: 7, label: '7 Days' }, { value: 30, label: '30 Days' }, { value: 90, label: '90 Days' }];

function uptimeColor(pct) {
  if (pct >= 99.9) return 'var(--color-status-up, #10B981)';
  if (pct >= 99) return '#22c55e';
  if (pct >= 95) return 'var(--color-vemio-amber, #F59E0B)';
  if (pct >= 90) return '#F97316';
  return '#EF4444';
}

function uptimeLabel(pct) {
  if (pct >= 99.9) return 'Excellent';
  if (pct >= 99) return 'Good';
  if (pct >= 95) return 'Fair';
  if (pct >= 90) return 'Needs Attention';
  return 'Critical';
}

/* ═══════════════════════════════════════════════════════════════════════════
   FLEET SCORE — larger ring with spacing
   ═══════════════════════════════════════════════════════════════════════════ */

function FleetScore({ pct, days }) {
  const color = uptimeColor(pct);
  const label = uptimeLabel(pct);
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="avail-fleet-card">
      <div className="avail-fleet-ring-wrap">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <circle cx="74" cy="74" r={radius} fill="none" stroke="var(--color-vemio-border, #1e293b)" strokeWidth="10" />
          <circle cx="74" cy="74" r={radius} fill="none" stroke={color}
            strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            transform="rotate(-90 74 74)"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div className="avail-fleet-ring-text">
          <span className="avail-fleet-pct" style={{ color }}>{pct}%</span>
          <span className="avail-fleet-label" style={{ color, marginTop: 6 }}>{label}</span>
        </div>
      </div>
      <div className="avail-fleet-meta">
        <span className="avail-fleet-title">Fleet Availability</span>
        <span className="avail-fleet-period">Last {days} days</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUMMARY STAT CARDS
   ═══════════════════════════════════════════════════════════════════════════ */

function SummaryCards({ summary }) {
  const cards = [
    { label: 'Total Devices', value: summary.total_devices, icon: Server, color: 'var(--color-vemio-text)' },
    { label: 'Avg Downtime', value: `${summary.avg_down_hours}h/device`, icon: Clock, color: summary.avg_down_hours > 0 ? '#EF4444' : 'var(--color-status-up, #10B981)' },
    { label: 'Below 99%', value: summary.devices_below_99, icon: AlertTriangle, color: summary.devices_below_99 > 0 ? '#F59E0B' : 'var(--color-status-up, #10B981)' },
    { label: 'Below 95%', value: summary.devices_below_95, icon: ArrowDownRight, color: summary.devices_below_95 > 0 ? '#EF4444' : 'var(--color-status-up, #10B981)' },
  ];
  return (
    <div className="avail-summary-grid">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="avail-summary-card">
            <div className="avail-summary-icon" style={{ color: c.color }}><Icon size={16} /></div>
            <div className="avail-summary-value" style={{ color: c.color }}>{c.value}</div>
            <div className="avail-summary-label">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TARGET PROJECTIONS — 2 collapsible cards side by side
   ═══════════════════════════════════════════════════════════════════════════ */

function TargetProjections({ targets, currentPct }) {
  if (!targets) return null;
  const items = [
    { label: 'Fix worst 5 devices', projected: targets.if_worst_5_fixed },
    { label: 'Fix worst 10 devices', projected: targets.if_worst_10_fixed },
    { label: 'All devices above 95%', projected: targets.if_all_above_95 },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <details className="avail-card">
        <summary className="avail-card-header" style={{ cursor: 'pointer', userSelect: 'none', marginBottom: 0 }}>
          <TrendingUp size={16} style={{ color: '#22c55e' }} />
          <span className="avail-card-title">Path to Improvement</span>
        </summary>
        <p className="avail-target-desc">Projected fleet availability if corrective actions are taken:</p>
        <div className="avail-target-list">
          {items.map(item => {
            const delta = item.projected - currentPct;
            const projColor = uptimeColor(item.projected);
            return (
              <div key={item.label} className="avail-target-row">
                <span className="avail-target-action">{item.label}</span>
                <div className="avail-target-right">
                  <span className="avail-target-projected" style={{ color: projColor }}>{item.projected}%</span>
                  <span className="avail-target-label" style={{ color: projColor }}>{uptimeLabel(item.projected)}</span>
                  {delta > 0 && <span className="avail-target-delta">+{delta.toFixed(1)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </details>
      <details className="avail-card">
        <summary className="avail-card-header" style={{ cursor: 'pointer', userSelect: 'none', marginBottom: 0 }}>
          <Target size={16} style={{ color: 'var(--vemio-amber, #F59E0B)' }} />
          <span className="avail-card-title">Availability Scale</span>
        </summary>
        <div className="avail-target-scale">
          <div className="avail-target-scale-row"><span className="avail-target-scale-dot" style={{ background: '#EF4444' }} /> <span>Below 90%</span><span className="avail-target-scale-label">Critical</span></div>
          <div className="avail-target-scale-row"><span className="avail-target-scale-dot" style={{ background: '#F97316' }} /> <span>90 - 94.9%</span><span className="avail-target-scale-label">Needs Attention</span></div>
          <div className="avail-target-scale-row"><span className="avail-target-scale-dot" style={{ background: '#F59E0B' }} /> <span>95 - 98.9%</span><span className="avail-target-scale-label">Fair</span></div>
          <div className="avail-target-scale-row"><span className="avail-target-scale-dot" style={{ background: '#22c55e' }} /> <span>99 - 99.8%</span><span className="avail-target-scale-label">Good</span></div>
          <div className="avail-target-scale-row"><span className="avail-target-scale-dot" style={{ background: '#10B981' }} /> <span>99.9%+</span><span className="avail-target-scale-label">Excellent</span></div>
        </div>
      </details>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WORST PERFORMERS TABLE
   ═══════════════════════════════════════════════════════════════════════════ */

function WorstPerformersTable({ devices }) {
  const [expanded, setExpanded] = useState(false);
  const impacted = devices.filter(d => d.uptime_pct < 100);
  const visible = expanded ? impacted : impacted.slice(0, 15);

  if (impacted.length === 0) {
    return (
      <div className="avail-card">
        <div className="avail-card-header">
          <Shield size={16} className="text-[var(--color-status-up)]" />
          <span className="avail-card-title">All Devices at 100% Uptime</span>
        </div>
        <p className="avail-empty">No downtime or degraded events recorded in this period.</p>
      </div>
    );
  }

  return (
    <div className="avail-card">
      <div className="avail-card-header">
        <AlertTriangle size={16} className="text-[var(--color-vemio-amber)]" />
        <span className="avail-card-title">Worst Performers ({impacted.length})</span>
      </div>
      <div className="avail-table-wrap">
        <table className="avail-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Type</th>
              <th>Site</th>
              <th className="avail-th-right">Uptime</th>
              <th className="avail-th-right">Down (h)</th>
              <th className="avail-th-right">Degraded (h)</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(d => (
              <tr key={d.device_id}>
                <td className="avail-td-name">
                  {d.is_critical && <span className="avail-critical-dot" title="Critical" />}
                  {d.name}
                </td>
                <td className="avail-td-type">{d.device_type?.replace(/_/g, ' ')}</td>
                <td className="avail-td-site">{d.site_name || '\u2014'}</td>
                <td className="avail-td-right">
                  <span className="avail-uptime-pill" style={{ color: uptimeColor(d.uptime_pct) }}>{d.uptime_pct}%</span>
                </td>
                <td className="avail-td-right avail-td-down">{d.down_hours > 0 ? d.down_hours : '\u2014'}</td>
                <td className="avail-td-right">{d.degraded_hours > 0 ? d.degraded_hours : '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {impacted.length > 15 && (
        <button className="avail-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Show less' : `Show all ${impacted.length} devices`}
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   OUTAGE TIMELINE — Gantt-style
   ═══════════════════════════════════════════════════════════════════════════ */

function OutageTimeline({ outages, days }) {
  const grouped = useMemo(() => {
    const map = {};
    outages.forEach(o => {
      if (!map[o.device_id]) map[o.device_id] = { name: o.device_name, intervals: [] };
      map[o.device_id].intervals.push(o);
    });
    return Object.entries(map)
      .map(([id, data]) => ({
        device_id: id,
        name: data.name,
        intervals: data.intervals,
        totalMs: data.intervals.reduce((sum, i) => sum + (new Date(i.end_time) - new Date(i.start_time)), 0),
      }))
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 20);
  }, [outages]);

  if (grouped.length === 0) return null;

  const now = new Date();
  const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const rangeMs = now - rangeStart;

  return (
    <div className="avail-card">
      <div className="avail-card-header">
        <Clock size={16} className="text-[var(--color-vemio-amber)]" />
        <span className="avail-card-title">Outage Timeline (Top 20)</span>
      </div>
      <div className="avail-gantt-axis">
        <span>{rangeStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>{new Date(rangeStart.getTime() + rangeMs / 2).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span>Now</span>
      </div>
      <div className="avail-gantt-list">
        {grouped.map(device => (
          <div key={device.device_id} className="avail-gantt-row">
            <div className="avail-gantt-label" title={device.name}>{device.name}</div>
            <div className="avail-gantt-track">
              {device.intervals.map((interval, i) => {
                const start = new Date(interval.start_time);
                const end = new Date(interval.end_time);
                const leftPct = Math.max(0, ((start - rangeStart) / rangeMs) * 100);
                const widthPct = Math.max(0.3, ((end - start) / rangeMs) * 100);
                const color = interval.status === 'down' ? '#EF4444' : '#F59E0B';
                return (
                  <div
                    key={i}
                    className="avail-gantt-bar"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color }}
                    title={`${interval.status} — ${start.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} to ${end.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="avail-gantt-legend">
        <span className="avail-gantt-legend-item"><span className="avail-gantt-legend-dot" style={{ background: '#EF4444' }} /> Down</span>
        <span className="avail-gantt-legend-item"><span className="avail-gantt-legend-dot" style={{ background: '#F59E0B' }} /> Degraded</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════════════════════════ */

function AvailabilitySkeleton() {
  return (
    <div className="flex flex-col gap-5 max-w-[1400px] animate-pulse">
      <div className="h-6 w-48 rounded bg-[var(--color-vemio-surface-raised)]" />
      <div className="grid grid-cols-[220px_1fr] gap-4 max-sm:grid-cols-1">
        <div className="h-[240px] rounded-xl bg-[var(--color-vemio-surface)]" />
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 rounded-xl bg-[var(--color-vemio-surface)]" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="h-14 rounded-xl bg-[var(--color-vemio-surface)]" />
            <div className="h-14 rounded-xl bg-[var(--color-vemio-surface)]" />
          </div>
        </div>
      </div>
      <div className="h-64 rounded-xl bg-[var(--color-vemio-surface)]" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AvailabilityPage() {
  const [days, setDays] = useState(7);
  const { isAllTenants } = useTenantSwitcher();
  const { category } = useDeviceCategory();

  const { data, loading, error, refresh } = useTenantFetch(
    `/api/availability?days=${days}&category=${category}`,
    { refreshInterval: 120000, dedupingInterval: 10000 }
  );

  if (loading && !data) return <AvailabilitySkeleton />;

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-severity-high" />
        <p className="text-vemio-text-muted text-sm">Failed to load availability: {error}</p>
        <button onClick={refresh} className="text-sm text-vemio-amber hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="avail-root">
      {/* Header + day toggle */}
      <motion.div variants={fadeUp} className="avail-header">
        <div>
          <h1 className="avail-title">Availability</h1>
          <p className="avail-subtitle">
            {isAllTenants ? 'Aggregated uptime across all tenants' : 'Device uptime and outage analysis'}
            {category !== 'all' && ' · Network devices only'}
          </p>
        </div>
        <div className="avail-day-toggle">
          {DAY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={`avail-day-btn ${days === opt.value ? 'avail-day-btn--active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {data && (
        <>
          {/* Top row: Fleet gauge left, summary cards + targets right */}
          <motion.div variants={fadeUp} className="avail-top-row">
            <FleetScore pct={data.fleet_availability} days={data.days} />
            <div className="avail-top-right">
              <SummaryCards summary={data.summary} />
              {data.fleet_availability < 99 && data.targets && (
                <TargetProjections targets={data.targets} currentPct={data.fleet_availability} />
              )}
            </div>
          </motion.div>

          {/* Worst performers table */}
          <motion.div variants={fadeUp}>
            <WorstPerformersTable devices={data.devices} />
          </motion.div>

          {/* Outage Gantt timeline */}
          <motion.div variants={fadeUp}>
            <OutageTimeline outages={data.outages} days={data.days} />
          </motion.div>
        </>
      )}

      <style>{`
        .avail-root {
          --vemio-surface: var(--color-vemio-surface);
          --vemio-border: var(--color-vemio-border);
          --vemio-text: var(--color-vemio-text);
          --vemio-text-muted: var(--color-vemio-text-muted);
          --vemio-text-dim: var(--color-vemio-text-dim);
          --vemio-amber: var(--color-vemio-amber);
          --vemio-surface-raised: var(--color-vemio-surface-raised);
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }

        /* ── Header ── */
        .avail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .avail-title { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .avail-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }
        .avail-day-toggle { display: flex; gap: 2px; background: var(--vemio-surface); border: 1px solid var(--vemio-border); border-radius: 8px; padding: 3px; flex-shrink: 0; }
        .avail-day-btn { padding: 5px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; color: var(--vemio-text-muted); background: transparent; border: none; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .avail-day-btn:hover { color: var(--vemio-text); }
        .avail-day-btn--active { background: var(--vemio-amber); color: #0F172A; }

        /* ── Top row: gauge + right stack ── */
        .avail-top-row { display: grid; grid-template-columns: 240px 1fr; gap: 16px; align-items: stretch; }
        .avail-top-right { display: flex; flex-direction: column; gap: 16px; justify-content: center; }

        /* Fleet gauge card */
        .avail-fleet-card { background: var(--vemio-surface); border: 1px solid var(--vemio-border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
        .avail-fleet-ring-wrap { position: relative; width: 148px; height: 148px; }
        .avail-fleet-ring-text { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .avail-fleet-pct { font-size: 22px; font-weight: 800; line-height: 1; }
        .avail-fleet-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; }
        .avail-fleet-meta { text-align: center; display: flex; flex-direction: column; gap: 2px; }
        .avail-fleet-title { font-size: 13px; font-weight: 600; color: var(--vemio-text); }
        .avail-fleet-period { font-size: 11px; color: var(--vemio-text-dim); }

        /* Summary cards */
        .avail-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .avail-summary-card { background: var(--vemio-surface); border: 1px solid var(--vemio-border); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
        .avail-summary-icon { opacity: 0.8; }
        .avail-summary-value { font-size: 22px; font-weight: 700; line-height: 1; }
        .avail-summary-label { font-size: 11px; color: var(--vemio-text-dim); text-transform: uppercase; letter-spacing: 0.06em; }

        /* ── Generic card ── */
        .avail-card { background: var(--vemio-surface); border: 1px solid var(--vemio-border); border-radius: 12px; padding: 20px; }
        .avail-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .avail-card-title { font-size: 14px; font-weight: 600; color: var(--vemio-text); }
        .avail-empty { font-size: 13px; color: var(--vemio-text-dim); margin: 0; }

        /* ── Target Projections ── */
        .avail-target-desc { font-size: 12px; color: var(--vemio-text-muted); margin: 12px 0 14px; }
        .avail-target-list { display: flex; flex-direction: column; gap: 10px; }
        .avail-target-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; border-radius: 8px; background: color-mix(in srgb, var(--vemio-border) 30%, transparent); }
        .avail-target-action { font-size: 12px; color: var(--vemio-text-muted); font-weight: 500; }
        .avail-target-right { display: flex; align-items: baseline; gap: 8px; }
        .avail-target-projected { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .avail-target-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .avail-target-delta { font-size: 10px; font-weight: 600; color: #22c55e; background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px; }
        .avail-target-scale { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
        .avail-target-scale-row { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--vemio-text-dim); }
        .avail-target-scale-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
        .avail-target-scale-label { margin-left: auto; font-weight: 600; font-size: 10px; }

        /* ── Table ── */
        .avail-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .avail-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .avail-table th { text-align: left; padding: 8px 12px; font-size: 10px; font-weight: 600; color: var(--vemio-text-dim); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid var(--vemio-border); white-space: nowrap; }
        .avail-th-right { text-align: right !important; }
        .avail-table td { padding: 8px 12px; border-bottom: 1px solid color-mix(in srgb, var(--vemio-border) 50%, transparent); color: var(--vemio-text); white-space: nowrap; }
        .avail-table tbody tr:hover { background: var(--vemio-surface-raised); }
        .avail-td-name { font-weight: 500; display: flex; align-items: center; gap: 6px; }
        .avail-critical-dot { width: 6px; height: 6px; border-radius: 50%; background: #EF4444; flex-shrink: 0; }
        .avail-td-type { text-transform: capitalize; }
        .avail-td-site { color: var(--vemio-text-muted); }
        .avail-td-right { text-align: right; }
        .avail-td-down { color: #EF4444; }
        .avail-uptime-pill { font-weight: 700; font-variant-numeric: tabular-nums; }
        .avail-expand-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 12px; padding: 8px; border: none; border-radius: 8px; background: var(--vemio-surface-raised); color: var(--vemio-text-muted); font-size: 12px; cursor: pointer; transition: color 0.15s; }
        .avail-expand-btn:hover { color: var(--vemio-text); }

        /* ── Gantt ── */
        .avail-gantt-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--vemio-text-dim); margin-bottom: 8px; padding: 0 0 0 120px; }
        .avail-gantt-list { display: flex; flex-direction: column; gap: 4px; }
        .avail-gantt-row { display: flex; align-items: center; gap: 8px; height: 22px; }
        .avail-gantt-label { width: 112px; font-size: 11px; color: var(--vemio-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; text-align: right; }
        .avail-gantt-track { flex: 1; position: relative; height: 14px; background: color-mix(in srgb, var(--vemio-border) 40%, transparent); border-radius: 3px; overflow: hidden; }
        .avail-gantt-bar { position: absolute; top: 0; height: 100%; border-radius: 2px; min-width: 2px; opacity: 0.85; transition: opacity 0.15s; }
        .avail-gantt-bar:hover { opacity: 1; }
        .avail-gantt-legend { display: flex; gap: 16px; margin-top: 12px; padding-left: 120px; }
        .avail-gantt-legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--vemio-text-dim); }
        .avail-gantt-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }

        /* ── Responsive ── */
        @media (max-width: 1023px) {
          .avail-summary-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 767px) {
          .avail-root { gap: 14px; }
          .avail-title { font-size: 16px; }
          .avail-top-row { grid-template-columns: 1fr; }
          .avail-top-right { gap: 12px; }
          .avail-fleet-card { flex-direction: row; gap: 16px; }
          .avail-fleet-ring-wrap { width: 80px; height: 80px; }
          .avail-fleet-ring-wrap svg { width: 80px; height: 80px; }
          .avail-fleet-pct { font-size: 18px; }
          .avail-fleet-meta { text-align: left; }
          .avail-summary-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .avail-summary-value { font-size: 18px; }
          .avail-gantt-axis { padding-left: 80px; }
          .avail-gantt-label { width: 72px; font-size: 10px; }
          .avail-gantt-legend { padding-left: 80px; }
          .avail-day-btn { padding: 5px 10px; font-size: 11px; }
          .avail-table th:nth-child(3), .avail-table td:nth-child(3),
          .avail-table th:nth-child(6), .avail-table td:nth-child(6) { display: none; }
        }
      `}</style>
    </motion.div>
  );
}