'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';

/**
 * Compact availability summary for the Overview page.
 * Shows fleet uptime %, worst 5 devices, and a "View all" link to /availability.
 * 
 * Receives data as props from the Overview API (no separate fetch).
 * 
 * Fleet Availability = weighted average uptime across all monitored devices.
 * Each device's uptime = (time in "up" status / total tracked time) × 100.
 * A fleet at 99% means on average, devices were reachable 99% of the last 7 days.
 */

function uptimeColor(pct) {
  if (pct >= 99.9) return '#10B981';
  if (pct >= 99)   return '#F59E0B';
  if (pct >= 95)   return '#F97316';
  return '#EF4444';
}

export default function AvailabilitySummary({ availability }) {
  const [showInfo, setShowInfo] = useState(false);

  if (!availability) {
    return (
      <div className="avs-card avs-empty">
        <span className="avs-empty-text">Availability data loading...</span>
      </div>
    );
  }

  const pct = availability.fleet_pct;
  const color = uptimeColor(pct);
  const worst = availability.worst_performers || [];

  return (
    <div className="avs-card">
      <div className="avs-header">
        <div className="avs-header-left">
          <span className="avs-label">Fleet Availability (7d)</span>
          <button
            className="avs-info-btn"
            onClick={() => setShowInfo(p => !p)}
            title="What is fleet availability?"
          >
            <Info size={12} />
          </button>
        </div>
        <Link href="/availability" className="avs-link">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      {showInfo && (
        <div className="avs-info-box">
          Fleet availability is the average uptime across all monitored devices over the last 7 days.
          Each device's uptime is the percentage of time it was reachable ("up") vs total tracked time.
          A score of 99% means devices were online 99% of the period on average.
        </div>
      )}

      <div className="avs-score" style={{ color }}>{pct}%</div>

      <div className="avs-fleet-bar-wrap">
        <div className="avs-fleet-bar" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>

      <div className="avs-stats-row">
        <span className="avs-stat">
          <span className="avs-stat-val">{availability.total_devices}</span> devices
        </span>
        <span className="avs-stat">
          <span className="avs-stat-val" style={{ color: availability.total_down_hours > 0 ? '#EF4444' : undefined }}>
            {availability.total_down_hours}h
          </span> downtime
        </span>
        <span className="avs-stat">
          <span className="avs-stat-val" style={{ color: availability.devices_below_99 > 0 ? '#F59E0B' : undefined }}>
            {availability.devices_below_99}
          </span> below 99%
        </span>
      </div>

      {worst.length > 0 && (
        <div className="avs-worst">
          <span className="avs-worst-title">Worst performers</span>
          {worst.map(d => (
            <div key={d.device_id} className="avs-worst-row">
              <span className="avs-worst-name">{d.name}</span>
              <span className="avs-worst-bar-wrap">
                <span
                  className="avs-worst-bar"
                  style={{ width: `${d.uptime_pct}%`, background: uptimeColor(d.uptime_pct) }}
                />
              </span>
              <span className="avs-worst-pct" style={{ color: uptimeColor(d.uptime_pct) }}>
                {d.uptime_pct}%
              </span>
            </div>
          ))}
        </div>
      )}

      {worst.length === 0 && (
        <div className="avs-all-good">
          All devices at 100% uptime
        </div>
      )}

      <style>{`
        .avs-card {
          background: var(--vemio-surface, var(--color-vemio-surface));
          border: 1px solid var(--vemio-border, var(--color-vemio-border));
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
        }
        .avs-empty {
          align-items: center;
          justify-content: center;
          min-height: 120px;
        }
        .avs-empty-text {
          font-size: 12px;
          color: var(--vemio-text-dim, var(--color-vemio-text-dim));
        }

        .avs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .avs-header-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .avs-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--vemio-text-muted, var(--color-vemio-text-muted));
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .avs-info-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid var(--vemio-border, var(--color-vemio-border));
          background: transparent;
          color: var(--vemio-text-dim, var(--color-vemio-text-dim));
          cursor: pointer;
          padding: 0;
          transition: color 0.15s, border-color 0.15s;
        }
        .avs-info-btn:hover {
          color: var(--vemio-text, var(--color-vemio-text));
          border-color: var(--vemio-text-muted, var(--color-vemio-text-muted));
        }
        .avs-info-box {
          font-size: 11px;
          line-height: 1.5;
          color: var(--vemio-text-muted, var(--color-vemio-text-muted));
          background: var(--vemio-surface-raised, var(--color-vemio-surface-raised));
          border: 1px solid var(--vemio-border, var(--color-vemio-border));
          border-radius: 8px;
          padding: 10px 12px;
          margin-bottom: 10px;
        }
        .avs-link {
          font-size: 11px;
          color: var(--vemio-amber, var(--color-vemio-amber));
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 3px;
          font-weight: 600;
        }
        .avs-link:hover { text-decoration: underline; }

        .avs-score {
          font-size: 32px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          margin-bottom: 10px;
        }

        .avs-fleet-bar-wrap {
          height: 6px;
          background: var(--vemio-border, var(--color-vemio-border));
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .avs-fleet-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.6s ease;
        }

        .avs-stats-row {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 14px;
        }
        .avs-stat {
          font-size: 11px;
          color: var(--vemio-text-dim, var(--color-vemio-text-dim));
        }
        .avs-stat-val {
          font-weight: 700;
          color: var(--vemio-text, var(--color-vemio-text));
        }

        .avs-worst {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
        }
        .avs-worst-title {
          font-size: 10px;
          font-weight: 600;
          color: var(--vemio-text-dim, var(--color-vemio-text-dim));
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 2px;
        }
        .avs-worst-row {
          display: grid;
          grid-template-columns: 120px 1fr 44px;
          align-items: center;
          gap: 8px;
        }
        .avs-worst-name {
          font-size: 11px;
          color: var(--vemio-text-muted, var(--color-vemio-text-muted));
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .avs-worst-bar-wrap {
          height: 5px;
          background: var(--vemio-border, var(--color-vemio-border));
          border-radius: 3px;
          overflow: hidden;
        }
        .avs-worst-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .avs-worst-pct {
          font-size: 11px;
          font-weight: 700;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .avs-all-good {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: #10B981;
          font-weight: 600;
          opacity: 0.8;
        }

        @media (max-width: 767px) {
          .avs-worst-row {
            grid-template-columns: 90px 1fr 40px;
          }
        }
      `}</style>
    </div>
  );
}