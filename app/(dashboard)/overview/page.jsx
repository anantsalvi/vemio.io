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
    // Auto-refresh every 60 seconds
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
        <button
          onClick={fetchData}
          className="text-sm text-vemio-amber hover:underline"
        >
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
      className="space-y-6"
    >
      {/* Page header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Network Overview</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">
            {data?.source === 'demo' ? 'Demo data — connect Auvik to see live metrics' : 'Real-time infrastructure health'}
          </p>
        </div>
        {data?.source === 'demo' && (
          <span
            className="text-[10px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              color: 'var(--color-vemio-amber)',
            }}
          >
            Demo Mode
          </span>
        )}
      </motion.div>

      {/* Row 1: BCS Score + Device Summary Cards */}
      <div className="grid grid-cols-12 gap-5">
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4">
          <BCSGauge bcs={data?.bcs} />
        </motion.div>
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8">
          <DeviceSummaryCards
            devices={data?.devices}
            alerts={data?.alerts}
            sites={data?.sites}
          />
        </motion.div>
      </div>

      {/* Row 2: Uptime Trend + Recent Events */}
      <div className="grid grid-cols-12 gap-5">
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7">
          <UptimeChart data={data?.uptimeTrend} />
        </motion.div>
        <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5">
          <RecentEvents events={data?.recentEvents} />
        </motion.div>
      </div>
    </motion.div>
  );
}
