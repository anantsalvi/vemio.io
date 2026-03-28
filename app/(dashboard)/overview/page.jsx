'use client';

import { motion } from 'framer-motion';
import { useSWRFetch } from '@/hooks/useSWRFetch';
import { OverviewSkeleton } from '@/app/components/dashboard/Skeletons';
import BCSGauge from '@/app/components/dashboard/BCSGauge';
import DeviceSummaryCards from '@/app/components/dashboard/DeviceSummaryCards';
import UptimeChart from '@/app/components/dashboard/UptimeChart';
import RecentEvents from '@/app/components/dashboard/RecentEvents';
import TopologyPreview from '@/app/components/dashboard/TopologyPreview';
import { AlertTriangle } from 'lucide-react';
import { useDeviceCategory } from '@/contexts/DeviceCategoryContext';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

export default function OverviewPage() {
  const { category } = useDeviceCategory();

  const { data, loading, error, refresh } = useSWRFetch(`/api/overview?category=${category}`, {
    refreshInterval: 60000,
    dedupingInterval: 5000,
  });

  if (loading && !data) {
    return <OverviewSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-8 h-8 text-severity-high" />
        <p className="text-vemio-text-muted text-sm">Failed to load dashboard: {error}</p>
        <button onClick={refresh} className="text-sm text-vemio-amber hover:underline">
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
        <motion.div variants={fadeUp}>
          <UptimeChart
            data={data?.uptimeTrend}
            devices={data?.devices}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <RecentEvents events={data?.recentEvents} />
        </motion.div>
      </div>

      {/* ── Row 3: Topology Preview ── */}
      <motion.div variants={fadeUp}>
        <TopologyPreview />
      </motion.div>

      <style>{`
        .overview-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }

        .overview-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
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

        /* Row 1: BCS + cards — stretch so cards fill BCS height */
        .overview-row-1 {
          display: grid;
          grid-template-columns: 1fr 2fr;
          gap: 16px;
          align-items: stretch;
        }

        /* Propagate height to children */
        .overview-bcs > *,
        .overview-devices > * {
          height: 100%;
        }

        /* Row 2: fixed height panels side by side */
        .overview-row-2 {
          display: grid;
          grid-template-columns: 7fr 5fr;
          gap: 16px;
          align-items: start;
        }

        @media (max-width: 1023px) {
          .overview-row-1 {
            grid-template-columns: 1fr;
          }
          .overview-bcs > *,
          .overview-devices > * {
            height: auto;
          }
        }

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