'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Server, CheckCircle2, XCircle, AlertTriangle, Bell, MapPin,
  ChevronRight, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function DeviceSummaryCards({ devices, alerts, sites }) {
  const router = useRouter();

  const cards = [
    {
      label: 'Total Devices',
      value: devices?.total ?? 0,
      icon: Server,
      color: 'var(--color-vemio-teal)',
      bg: 'var(--color-vemio-teal-soft)',
      href: '/devices',
    },
    {
      label: 'Online',
      value: devices?.up ?? 0,
      icon: CheckCircle2,
      color: 'var(--color-status-up)',
      bg: 'rgba(34, 197, 94, 0.1)',
      href: '/devices?status=up',
    },
    {
      label: 'Offline',
      value: devices?.down ?? 0,
      icon: XCircle,
      color: 'var(--color-status-down)',
      bg: 'rgba(239, 68, 68, 0.1)',
      pulse: (devices?.down ?? 0) > 0,
      href: '/devices?status=down',
      urgent: (devices?.down ?? 0) > 0,
    },
    {
      label: 'Degraded',
      value: devices?.degraded ?? 0,
      icon: AlertTriangle,
      color: 'var(--color-status-degraded)',
      bg: 'rgba(245, 158, 11, 0.1)',
      href: '/devices?status=degraded',
    },
    {
      label: 'Active Alerts',
      value: alerts?.active ?? 0,
      icon: Bell,
      color: 'var(--color-severity-high)',
      bg: 'rgba(249, 115, 22, 0.1)',
      pulse: (alerts?.active ?? 0) > 0,
      href: '/alerts',
      urgent: (alerts?.active ?? 0) > 0,
    },
    {
      label: 'Sites',
      value: sites?.total ?? 0,
      icon: MapPin,
      color: 'var(--color-vemio-text-muted)',
      bg: 'rgba(148, 163, 184, 0.08)',
      href: '/sites',
    },
  ];

  return (
    <>
      <div className="dsc-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              variants={cardVariants}
              className={`dsc-card ${card.urgent ? 'dsc-card--urgent' : ''}`}
              onClick={() => router.push(card.href)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  router.push(card.href);
                }
              }}
            >
              <div className="dsc-card-top">
                <div className="dsc-icon-wrap" style={{ background: card.bg }}>
                  <Icon className="dsc-icon" style={{ color: card.color }} />
                </div>
                <div className="dsc-card-top-right">
                  {card.pulse && (
                    <span className="dsc-pulse-dot" style={{ background: card.color }} />
                  )}
                  <ChevronRight className="dsc-chevron" />
                </div>
              </div>
              <div className="dsc-card-body">
                <p className="dsc-value" style={{ color: card.color }}>
                  {card.value}
                </p>
                <p className="dsc-label">{card.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .dsc-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          height: 100%;
        }

        @media (max-width: 767px) {
          .dsc-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        .dsc-card {
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 10px;
          position: relative;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          min-height: 90px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
          outline: none;
        }

        .dsc-card:hover {
          border-color: var(--color-vemio-text-dim);
          background: var(--color-vemio-surface-raised);
          transform: translateY(-1px);
        }

        .dsc-card:hover .dsc-chevron {
          opacity: 0.5;
          transform: translateX(2px);
        }

        .dsc-card:focus-visible {
          border-color: var(--color-vemio-amber);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-vemio-amber) 25%, transparent);
        }

        .dsc-card--urgent {
          border-color: rgba(239, 68, 68, 0.2);
        }

        @media (max-width: 479px) {
          .dsc-card { padding: 12px; min-height: 80px; }
        }

        .dsc-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .dsc-card-top-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .dsc-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dsc-icon {
          width: 16px;
          height: 16px;
        }

        .dsc-chevron {
          width: 14px;
          height: 14px;
          color: var(--color-vemio-text-dim);
          opacity: 0;
          transition: opacity 0.15s, transform 0.15s;
          flex-shrink: 0;
        }

        .dsc-pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: dsc-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }

        @keyframes dsc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }

        .dsc-card-body {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .dsc-value {
          font-size: 24px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          margin: 0;
        }

        @media (max-width: 479px) {
          .dsc-value { font-size: 20px; }
        }

        .dsc-label {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 0;
        }
      `}</style>
    </>
  );
}