'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import BCSGauge from '@/app/components/dashboard/BCSGauge';
import DeviceSummaryCards from '@/app/components/dashboard/DeviceSummaryCards';
import UptimeChart from '@/app/components/dashboard/UptimeChart';
import RecentEvents from '@/app/components/dashboard/RecentEvents';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/overview');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-severity-high" />
        <p className="text-vemio-text-muted text-sm">Failed to load dashboard: {error}</p>
        <button onClick={fetchData} className="text-sm text-vemio-amber hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="overview-root"
    >
      {/* ── Page header ── */}
      <motion.div variants={fadeUp} className="overview-header">
        <div className="overview-header-text">
          <h1 className="overview-title">Network Overview</h1>
          <p className="overview-subtitle">
            {data?.source === 'demo'
              ? 'Demo data — connect Auvik to see live metrics'
              : 'Real-time infrastructure health'}
          </p>
        </div>
        {data?.source === 'demo' && (
          <span className="demo-badge">Demo Mode</span>
        )}
      </motion.div>

      {/* ── Row 1: BCS Gauge + Device Summary ── */}
      <div className="overview-row-1">
        <motion.div variants={fadeUp} className="overview-bcs">
          <BCSGauge bcs={data?.bcs} />
        </motion.div>
        <motion.div variants={fadeUp} className="overview-devices">
          <DeviceSummaryCards
            devices={data?.devices}
            alerts={data?.alerts}
            sites={data?.sites}
          />
        </motion.div>
      </div>

      {/* ── Row 2: Uptime Trend + Recent Events ── */}
      <div className="overview-row-2">
        <motion.div variants={fadeUp} className="overview-uptime">
          <UptimeChart data={data?.uptimeTrend} />
        </motion.div>
        <motion.div variants={fadeUp} className="overview-events">
          <RecentEvents events={data?.recentEvents} />
        </motion.div>
      </div>

      <style>{`
        /* ── Root ── */
        .overview-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }

        /* ── Page header ── */
        .overview-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;          /* badge drops below on very small screens */
        }

        .overview-title {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          margin: 0;
          line-height: 1.2;
        }

        .overview-subtitle {
          font-size: 13px;
          color: var(--vemio-text-muted);
          margin: 3px 0 0;
        }

        .demo-badge {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 3px 10px;
          border-radius: 20px;
          white-space: nowrap;
          flex-shrink: 0;
          margin-top: 2px;
          background: rgba(245, 158, 11, 0.10);
          border: 1px solid rgba(245, 158, 11, 0.22);
          color: var(--vemio-amber);
        }

        /* ── Row 1: BCS (narrow) + Devices (wide) ── */
        .overview-row-1 {
          display: grid;
          grid-template-columns: 1fr 2fr;   /* ~33 / 66 */
          gap: 16px;
          align-items: start;
        }

        /* ── Row 2: Uptime (wider) + Events (narrower) ── */
        .overview-row-2 {
          display: grid;
          grid-template-columns: 7fr 5fr;   /* ~58 / 42 */
          gap: 16px;
          align-items: start;
        }

        /* ── Tablet (768 – 1023px): stack BCS + devices vertically ── */
        @media (max-width: 1023px) {
          .overview-row-1 {
            grid-template-columns: 1fr;
          }

          /* On tablet the BCS gauge doesn't need to be as tall when full-width;
             let the component handle its own sizing. */
        }

        /* ── Mobile (< 768px) ── */
        @media (max-width: 767px) {
          .overview-root {
            gap: 14px;
          }

          .overview-title {
            font-size: 16px;
          }

          .overview-row-1,
          .overview-row-2 {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>
    </motion.div>
  );
}