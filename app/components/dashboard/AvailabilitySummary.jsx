'use client';

import Link from 'next/link';
import { useTenantFetch } from '@/hooks/useTenantFetch';
import { ArrowRight } from 'lucide-react';

/**
 * Compact availability summary for the Overview page.
 * Shows fleet uptime %, worst 5 devices, and a "View all" link to /availability.
 * Replaces the old UptimeChart component.
 */

function uptimeColor(pct) {
  if (pct >= 99.9) return 'var(--color-status-up, #10B981)';
  if (pct >= 99)   return 'var(--color-vemio-amber, #F59E0B)';
  if (pct >= 95)   return '#F97316';
  return '#EF4444';
}

export default function AvailabilitySummary() {
  const { data, loading } = useTenantFetch('/api/availability?days=7', {
    refreshInterval: 120000,
    dedupingInterval: 15000,
  });

  if (loading && !data) {
    return (
      <div className="avs-card avs-skeleton">
        <div className="avs-skel-bar" style={{ width: '60%', height: 14 }} />
        <div className="avs-skel-bar" style={{ width: '40%', height: 32, marginTop: 8 }} />
        <div className="avs-skel-bar" style={{ width: '100%', height: 10, marginTop: 16 }} />
        <div className="avs-skel-bar" style={{ width: '100%', height: 10, marginTop: 6 }} />
        <div className="avs-skel-bar" style={{ width: '100%', height: 10, marginTop: 6 }} />
      </div>
    );
  }

  if (!data) return null;

  const pct = data.fleet_availability;
  const color = uptimeColor(pct);
  const worst = data.devices?.filter(d => d.uptime_pct < 100).slice(0, 5) || [];

  return (
    <div className="avs-card">
      <div className="avs-header">
        <span className="avs-label">Fleet Availability (7d)</span>
        <Link href="/availability" className="avs-link">
          View all <ArrowRight size={12} />
        </Link>
      </div>

      <div className="avs-score" style={{ color }}>{pct}%</div>

      <div className="avs-fleet-bar-wrap">
        <div className="avs-fleet-bar" style={{ width: `${pct}%`, background: color }} />
      </div>

      <div className="avs-stats-row">
        <span className="avs-stat">
          <span className="avs-stat-val">{data.summary.total_devices}</span> devices
        </span>
        <span className="avs-stat">
          <span className="avs-stat-val" style={{ color: data.summary.total_down_hours > 0 ? '#EF4444' : undefined }}>
            {data.summary.total_down_hours}h
          </span> downtime
        </span>
        <span className="avs-stat">
          <span className="avs-stat-val" style={{ color: data.summary.devices_below_99 > 0 ? '#F59E0B' : undefined }}>
            {data.summary.devices_below_99}
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
          background: var(--vemio-surface);
          border: 1px solid var(--vemio-border);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
        }
        .avs-skeleton {
          min-height: 200px;
        }
        .avs-skel-bar {
          border-radius: 4px;
          background: var(--vemio-surface-raised);
          animation: avs-pulse 1.2s ease infinite;
        }
        @keyframes avs-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        .avs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .avs-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--vemio-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .avs-link {
          font-size: 11px;
          color: var(--vemio-amber);
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
          background: var(--vemio-border);
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
          color: var(--vemio-text-dim);
        }
        .avs-stat-val {
          font-weight: 700;
          color: var(--vemio-text);
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
          color: var(--vemio-text-dim);
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
          color: var(--vemio-text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .avs-worst-bar-wrap {
          height: 5px;
          background: var(--vemio-border);
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
          color: var(--color-status-up, #10B981);
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