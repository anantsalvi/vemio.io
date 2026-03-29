'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Server, CheckCircle2, XCircle, AlertTriangle, Bell, MapPin,
  ChevronRight, Info,
} from 'lucide-react';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function DeviceSummaryCards({ devices, alerts, sites }) {
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  const total = devices?.total || 1;

  const cards = [
    {
      label: 'Total Devices',
      value: devices?.total ?? 0,
      sub: null,
      icon: Server,
      color: 'var(--color-vemio-teal)',
      bg: 'var(--color-vemio-teal-soft)',
      href: '/devices',
    },
    {
      label: 'Online',
      value: devices?.up ?? 0,
      sub: devices?.up > 0 ? `${((devices.up / total) * 100).toFixed(1)}%` : null,
      icon: CheckCircle2,
      color: 'var(--color-status-up)',
      bg: 'rgba(34, 197, 94, 0.1)',
      href: '/devices?status=up',
    },
    {
      label: 'Offline',
      value: devices?.down ?? 0,
      sub: devices?.down > 0 ? `${((devices.down / total) * 100).toFixed(1)}%` : null,
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
      sub: devices?.degraded > 0 ? `${((devices.degraded / total) * 100).toFixed(1)}%` : null,
      icon: AlertTriangle,
      color: 'var(--color-status-degraded)',
      bg: 'rgba(245, 158, 11, 0.1)',
      href: '/devices?status=degraded',
    },
    {
      label: 'Active Alerts',
      value: alerts?.active ?? 0,
      sub: null,
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
      sub: null,
      icon: MapPin,
      color: 'var(--color-vemio-text-muted)',
      bg: 'rgba(148, 163, 184, 0.08)',
      href: '/sites',
    },
  ];

  return (
    <>
      <div className="dsc-wrap">
        {showInfo && (
          <div className="dsc-info-box">
            Real-time device status from Auvik monitoring. Shows current online/offline/degraded counts, active alerts, and sites. Click any card to drill down. Filtered by the Network/All toggle.
          </div>
        )}
        <div className="dsc-grid">
          {cards.map((card, i) => {
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
                    {i === 0 && (
                      <button
                        className="dsc-info-btn"
                        onClick={(e) => { e.stopPropagation(); setShowInfo(p => !p); }}
                        title="What are these cards?"
                      >
                        <Info size={10} />
                      </button>
                    )}
                    {card.pulse && (
                      <span className="dsc-pulse-dot" style={{ background: card.color }} />
                    )}
                    <ChevronRight className="dsc-chevron" />
                  </div>
                </div>
                <div className="dsc-card-body">
                  <div className="dsc-value-row">
                    <p className="dsc-value" style={{ color: card.color }}>
                      {card.value}
                    </p>
                    {card.sub && (
                      <span className="dsc-sub" style={{ color: card.color }}>
                        {card.sub}
                      </span>
                    )}
                  </div>
                  <p className="dsc-label">{card.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <style>{`
        .dsc-wrap {
          display: flex;
          flex-direction: column;
          gap: 8px;
          height: 100%;
        }
        .dsc-info-box {
          font-size: 11px;
          line-height: 1.5;
          color: var(--color-vemio-text-muted);
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          border-radius: 8px;
          padding: 10px 12px;
        }
        .dsc-info-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 1px solid var(--color-vemio-border);
          background: transparent;
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          padding: 0;
          transition: color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }
        .dsc-info-btn:hover {
          color: var(--color-vemio-text-muted);
          border-color: var(--color-vemio-text-muted);
        }

        .dsc-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          flex: 1;
        }

        @media (max-width: 767px) {
          .dsc-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }

        .dsc-card {
          border-radius: 14px;
          padding: 18px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 14px;
          position: relative;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
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
          .dsc-card { padding: 14px; gap: 10px; }
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
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .dsc-icon {
          width: 18px;
          height: 18px;
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
          gap: 3px;
        }

        .dsc-value-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .dsc-value {
          font-size: 28px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          margin: 0;
        }

        .dsc-sub {
          font-size: 13px;
          font-weight: 500;
          opacity: 0.6;
        }

        @media (max-width: 479px) {
          .dsc-value { font-size: 22px; }
          .dsc-sub { font-size: 11px; }
        }

        .dsc-label {
          font-size: 12px;
          color: var(--color-vemio-text-dim);
          margin: 0;
        }
      `}</style>
    </>
  );
}