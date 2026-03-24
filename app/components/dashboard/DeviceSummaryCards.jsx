'use client';

import { motion } from 'framer-motion';
import { Server, CheckCircle2, XCircle, AlertTriangle, Bell, MapPin } from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function DeviceSummaryCards({ devices, alerts, sites }) {
  const cards = [
    {
      label: 'Total Devices',
      value: devices?.total ?? 0,
      icon: Server,
      color: 'var(--color-vemio-teal)',
      bg: 'var(--color-vemio-teal-soft)',
    },
    {
      label: 'Online',
      value: devices?.up ?? 0,
      icon: CheckCircle2,
      color: 'var(--color-status-up)',
      bg: 'rgba(34, 197, 94, 0.1)',
    },
    {
      label: 'Offline',
      value: devices?.down ?? 0,
      icon: XCircle,
      color: 'var(--color-status-down)',
      bg: 'rgba(239, 68, 68, 0.1)',
      pulse: (devices?.down ?? 0) > 0,
    },
    {
      label: 'Degraded',
      value: devices?.degraded ?? 0,
      icon: AlertTriangle,
      color: 'var(--color-status-degraded)',
      bg: 'rgba(245, 158, 11, 0.1)',
    },
    {
      label: 'Active Alerts',
      value: alerts?.active ?? 0,
      icon: Bell,
      color: 'var(--color-severity-high)',
      bg: 'rgba(249, 115, 22, 0.1)',
      pulse: (alerts?.active ?? 0) > 0,
    },
    {
      label: 'Sites',
      value: sites?.total ?? 0,
      icon: MapPin,
      color: 'var(--color-vemio-text-muted)',
      bg: 'rgba(148, 163, 184, 0.08)',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 h-full">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            variants={cardVariants}
            className="rounded-xl p-4 flex flex-col justify-between relative overflow-hidden"
            style={{
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: card.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              {card.pulse && (
                <span
                  className="w-2 h-2 rounded-full animate-pulse-dot"
                  style={{ background: card.color }}
                />
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold tabular-nums" style={{ color: card.color }}>
                {card.value}
              </p>
              <p className="text-[11px] text-vemio-text-dim mt-0.5">{card.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
