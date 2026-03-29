'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, ChevronRight, ChevronDown, MapPin,
  Shield, AlertTriangle, Server, Wifi, HardDrive,
} from 'lucide-react';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const SITE_TYPE_LABELS = {
  headquarters: 'HQ', branch: 'Branch', warehouse: 'Warehouse',
  factory: 'Factory', datacenter: 'DC', retail: 'Retail', other: 'Site',
};
const DEVICE_TYPE_ICONS = {
  firewall: Shield, core_switch: Server, router: Wifi,
  access_switch: Server, access_point: Wifi, server: HardDrive,
};
const DEVICE_TYPE_LABELS = {
  firewall: 'Firewalls', core_switch: 'Core Switches', router: 'Routers',
  access_switch: 'Access Switches', access_point: 'APs', server: 'Servers',
  nas: 'NAS', ups: 'UPS', other: 'Other',
};

function getHealthColor(pct) {
  if (pct >= 90) return { text: 'text-status-up',      bg: 'rgba(20,184,166,0.08)',  border: 'rgba(20,184,166,0.2)' };
  if (pct >= 70) return { text: 'text-vemio-amber',     bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' };
  return           { text: 'text-severity-high',        bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.2)'  };
}

// ── Site Detail ───────────────────────────────────────────────────────────────

function SiteDetail({ siteId }) {
  const [detail, setDetail]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/sites?id=${siteId}&tenantId=${selectedTenantId}`);
        if (res.ok) setDetail(await res.json());
      } catch (err) { console.error('Site detail fetch:', err); }
      finally { setLoading(false); }
    }
    fetchDetail();
  }, [siteId]);

  if (loading) return (
    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
      <div className="px-5 pb-5 pt-3">
        <RefreshCw className="w-4 h-4 text-vemio-amber animate-spin" />
      </div>
    </motion.div>
  );
  if (!detail) return null;

  const { devices_by_type, critical_devices, down_devices, active_alerts, recent_tickets } = detail;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="site-detail-body">

        {/* Device breakdown:
            4-col on desktop, 3-col on tablet, 2-col on mobile */}
        <div>
          <p className="site-eyebrow">Device Breakdown</p>
          <div className="site-device-grid">
            {devices_by_type.map(dt => {
              const Icon       = DEVICE_TYPE_ICONS[dt.device_type] || Server;
              const label      = DEVICE_TYPE_LABELS[dt.device_type] || dt.device_type;
              const healthPct  = dt.total > 0 ? Math.round((dt.up / dt.total) * 100) : 0;
              const barClass   = healthPct >= 90 ? 'bg-status-up' : healthPct >= 70 ? 'bg-vemio-amber' : 'bg-severity-high';

              return (
                <div key={dt.device_type} className="site-dt-card">
                  <div className="site-dt-header">
                    <Icon className="w-3.5 h-3.5 text-vemio-text-dim" />
                    <span className="site-dt-label">{label}</span>
                  </div>
                  <div className="site-dt-counts">
                    <span className="site-dt-total">{dt.total}</span>
                    <div className="site-dt-sub">
                      {dt.up     > 0 && <span className="text-status-up">{dt.up} up</span>}
                      {dt.down   > 0 && <span className="text-severity-high">{dt.down} ↓</span>}
                      {dt.degraded > 0 && <span className="text-vemio-amber">{dt.degraded} ~</span>}
                    </div>
                  </div>
                  <div className="site-dt-bar-track">
                    <div className={`site-dt-bar-fill ${barClass}`} style={{ width: `${healthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical devices */}
        {critical_devices.length > 0 && (
          <div>
            <p className="site-eyebrow">Critical Infrastructure ({critical_devices.length})</p>
            <div className="site-list">
              {critical_devices.map(dev => (
                <div key={dev.id} className="site-list-row">
                  <span className={`site-list-dot ${
                    dev.current_status === 'up'   ? 'bg-status-up' :
                    dev.current_status === 'down' ? 'bg-severity-high site-list-dot--pulse' : 'bg-vemio-amber'
                  }`} />
                  <span className="site-list-name">{dev.name}</span>
                  <span className="site-list-type">{DEVICE_TYPE_LABELS[dev.device_type] || dev.device_type}</span>
                  {dev.has_redundancy === true  && <span className="site-tag site-tag--ha">HA</span>}
                  {dev.has_redundancy === false && <span className="site-tag site-tag--single">Single</span>}
                  <span className={`site-list-status ${
                    dev.current_status === 'up' ? 'text-status-up' : 'text-severity-high'
                  }`}>{dev.current_status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Down devices */}
        {down_devices.length > 0 && (
          <div>
            <p className="site-eyebrow site-eyebrow--critical">Down Devices ({down_devices.length})</p>
            <div className="site-list">
              {down_devices.slice(0, 10).map(dev => (
                <div key={dev.id} className="site-list-row site-list-row--down">
                  <span className="site-list-dot bg-severity-high site-list-dot--pulse" />
                  <span className="site-list-name">{dev.name}</span>
                  <span className="site-list-type">{DEVICE_TYPE_LABELS[dev.device_type] || dev.device_type}</span>
                  {dev.last_seen_at && (
                    <span className="site-list-lastseen">
                      {new Date(dev.last_seen_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </span>
                  )}
                </div>
              ))}
              {down_devices.length > 10 && (
                <p className="site-list-more">+{down_devices.length - 10} more</p>
              )}
            </div>
          </div>
        )}

        {/* Active alerts */}
        {active_alerts.length > 0 && (
          <div>
            <p className="site-eyebrow">Active Alerts ({active_alerts.length})</p>
            <div className="site-list">
              {active_alerts.map(al => (
                <div key={al.id} className="site-list-row">
                  <span className={`site-list-sev ${
                    al.severity === 'critical' ? 'text-severity-critical' :
                    al.severity === 'high'     ? 'text-severity-high'     : 'text-vemio-amber'
                  }`}>{al.severity}</span>
                  <span className="site-list-name">{al.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent tickets */}
        {recent_tickets.length > 0 && (
          <div>
            <p className="site-eyebrow">Recent Tickets ({recent_tickets.length})</p>
            <div className="site-list">
              {recent_tickets.map(tk => (
                <div key={tk.id} className="site-list-row">
                  <span className="site-list-id">#{tk.glpi_ticket_id}</span>
                  <span className="site-list-name">{tk.title}</span>
                  <span className={`site-list-status ${
                    tk.status === 'resolved' || tk.status === 'closed' ? 'text-status-up' : 'text-vemio-amber'
                  }`}>{tk.status}</span>
                  {tk.sla_resolution_met === false && (
                    <span className="site-tag site-tag--sla">SLA breach</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .site-detail-body {
          padding: 16px 20px 20px;
          border-top: 1px solid var(--color-vemio-border);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        @media (max-width: 479px) { .site-detail-body { padding: 12px 12px 16px; } }

        .site-eyebrow {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 10px;
        }
        .site-eyebrow--critical { color: var(--color-severity-high); opacity: 0.7; }

        /* Device type grid: 4 → 3 → 2 */
        .site-device-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        @media (max-width: 1023px) { .site-device-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 767px)  { .site-device-grid { grid-template-columns: repeat(2, 1fr); } }

        .site-dt-card {
          border-radius: 8px;
          padding: 10px;
          background: var(--color-vemio-surface-raised);
        }
        .site-dt-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
        }
        .site-dt-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--vemio-text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .site-dt-counts {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 4px;
        }
        .site-dt-total {
          font-size: 18px;
          font-weight: 700;
          color: var(--vemio-text);
          font-variant-numeric: tabular-nums;
        }
        .site-dt-sub {
          display: flex;
          gap: 4px;
          font-size: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .site-dt-bar-track {
          height: 4px;
          border-radius: 99px;
          background: var(--color-vemio-border);
          opacity: 0.6;
          margin-top: 8px;
          overflow: hidden;
        }
        .site-dt-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.6s ease;
        }

        /* Shared list row */
        .site-list { display: flex; flex-direction: column; gap: 4px; }
        .site-list-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--vemio-text-muted);
          border-radius: 6px;
          padding: 6px 10px;
          background: var(--color-vemio-surface-raised);
          flex-wrap: wrap;        /* last-seen timestamp wraps gracefully */
        }
        .site-list-row--down {
          background: rgba(239,68,68,0.04);
          border: 1px solid rgba(239,68,68,0.08);
        }
        .site-list-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .site-list-dot--pulse { animation: site-pulse 1.5s ease-in-out infinite; }
        @keyframes site-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        .site-list-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
          color: var(--vemio-text);
          font-weight: 500;
        }
        .site-list-type     { font-size: 11px; color: var(--color-vemio-text-dim); flex-shrink: 0; }
        .site-list-status   { font-size: 10px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
        .site-list-sev      { font-size: 10px; font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
        .site-list-id       { font-family: monospace; color: var(--color-vemio-text-dim); flex-shrink: 0; }
        .site-list-lastseen { font-size: 10px; color: var(--color-vemio-text-dim); white-space: nowrap; }
        .site-list-more     { font-size: 10px; color: var(--color-vemio-text-dim); padding-left: 10px; margin: 2px 0 0; }

        /* Tags */
        .site-tag {
          font-size: 9px;
          padding: 2px 6px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .site-tag--ha     { color: var(--color-status-up);      background: rgba(20,184,166,0.1);  border: 1px solid rgba(20,184,166,0.2);  }
        .site-tag--single { color: var(--vemio-amber);           background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.2);  }
        .site-tag--sla    { color: var(--color-severity-high);  background: rgba(239,68,68,0.1); }
      `}</style>
    </motion.div>
  );
}

// ── Site Card ─────────────────────────────────────────────────────────────────

function SiteCard({ site, isSelected, onSelect }) {
  const hc        = getHealthColor(site.health_percent);
  const typeLabel = SITE_TYPE_LABELS[site.site_type] || site.site_type;
  const barClass  = site.health_percent >= 90 ? 'bg-status-up' : site.health_percent >= 70 ? 'bg-vemio-amber' : 'bg-severity-high';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="site-card"
      style={{ border: isSelected ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--color-vemio-border)' }}
      onClick={() => onSelect(isSelected ? null : site.id)}
    >
      <div className="site-card-inner">
        <div className="site-card-body">
          {/* Name + type */}
          <div className="site-card-name-row">
            <MapPin className="w-4 h-4 text-vemio-text-dim flex-shrink-0" />
            <h3 className="site-card-name">{site.name}</h3>
            <span className="site-type-chip">{typeLabel}</span>
          </div>

          {site.city && (
            <p className="site-city">{site.city}{site.state ? `, ${site.state}` : ''}</p>
          )}

          {/* Stats */}
          <div className="site-stats-row">
            <div className="site-health-wrap">
              <span className={`site-health-pct ${hc.text}`}>{site.health_percent}%</span>
              <span className="site-health-label">health</span>
            </div>
            <div className="site-device-counts">
              <span className="site-count-total">{site.devices.total} devices</span>
              {site.devices.up     > 0 && <span className="text-status-up">{site.devices.up} up</span>}
              {site.devices.down   > 0 && <span className="text-severity-high">{site.devices.down} down</span>}
              {site.devices.degraded > 0 && <span className="text-vemio-amber">{site.devices.degraded} deg</span>}
            </div>
            {site.alerts.active > 0 && (
              <span className="site-alert-badge">
                <AlertTriangle className="w-3 h-3" />
                {site.alerts.active}
              </span>
            )}
            {site.open_tickets > 0 && (
              <span className="site-tickets-badge">{site.open_tickets} ticket{site.open_tickets > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Health bar */}
          <div className="site-health-bar-track">
            <motion.div className={`site-health-bar-fill ${barClass}`}
              initial={{ width: 0 }}
              animate={{ width: `${site.health_percent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>

        {isSelected
          ? <ChevronDown  className="site-chevron" />
          : <ChevronRight className="site-chevron" />}
      </div>

      <AnimatePresence>
        {isSelected && <SiteDetail siteId={site.id} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const { selectedTenantId } = useTenantSwitcher();
  useEffect(() => {
    async function fetchSites() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sites?tenantId=${selectedTenantId}`);
        if (res.ok) setData(await res.json());
      } catch (err) { console.error('Sites fetch:', err); }
      finally { setLoading(false); }
    }
    fetchSites();
    const interval = setInterval(fetchSites, 60000);
    return () => clearInterval(interval);
  }, [selectedTenantId]);

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
    </div>
  );

  const sites      = data?.sites || [];
  const sorted     = [...sites].sort((a, b) => a.health_percent - b.health_percent);
  const totalDevices = sites.reduce((s, site) => s + site.devices.total, 0);
  const totalDown    = sites.reduce((s, site) => s + site.devices.down,  0);
  const avgHealth    = sites.length > 0
    ? Math.round(sites.reduce((s, site) => s + site.health_percent, 0) / sites.length * 10) / 10
    : 0;

  return (
    <>
      <motion.div variants={stagger} initial="hidden" animate="visible" className="sites-root">
        <motion.div variants={fadeUp} className="sites-header">
          <div>
            <h1 className="sites-title">Sites</h1>
            <p className="sites-subtitle">Per-site infrastructure health and device breakdown</p>
          </div>
        </motion.div>

        {/* Summary cards */}
        <motion.div variants={fadeUp} className="sites-summary">
          {[
            { label: 'Sites',         value: sites.length,  colorClass: 'text-vemio-text'    },
            { label: 'Total Devices', value: totalDevices,  colorClass: 'text-vemio-text'    },
            { label: 'Avg Health',    value: `${avgHealth}%`, colorClass: getHealthColor(avgHealth).text },
            { label: 'Devices Down',  value: totalDown,     colorClass: totalDown > 0 ? 'text-severity-high' : 'text-status-up' },
          ].map(c => (
            <div key={c.label} className="sites-summary-card">
              <p className="sites-summary-label">{c.label}</p>
              <p className={`sites-summary-value ${c.colorClass}`}>{c.value}</p>
            </div>
          ))}
        </motion.div>

        {/* Site cards */}
        <div className="sites-list">
          {sorted.map(site => (
            <motion.div key={site.id} variants={fadeUp}>
              <SiteCard site={site} isSelected={selectedId === site.id} onSelect={setSelectedId} />
            </motion.div>
          ))}
        </div>
      </motion.div>

      <style>{`
        .sites-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }
        @media (max-width: 767px) { .sites-root { gap: 14px; } }

        .sites-header { display: flex; flex-direction: column; }
        .sites-title  { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .sites-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }

        /* Summary: 4-col → 2-col */
        .sites-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 1023px) { .sites-summary { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 479px)  { .sites-summary { gap: 8px; } }

        .sites-summary-card {
          border-radius: 12px;
          padding: 12px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
        }
        .sites-summary-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin: 0;
        }
        .sites-summary-value {
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          margin: 4px 0 0;
        }

        .sites-list { display: flex; flex-direction: column; gap: 10px; }

        /* Site card */
        .site-card {
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          background: var(--color-vemio-surface);
          transition: border-color 0.15s;
        }
        .site-card-inner {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
        }
        @media (max-width: 479px) { .site-card-inner { padding: 12px 14px; } }

        .site-card-body { flex: 1; min-width: 0; }

        .site-card-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
          flex-wrap: wrap;
        }
        .site-card-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
        }
        .site-type-chip {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          background: var(--color-vemio-surface-raised);
          padding: 2px 7px;
          border-radius: 4px;
        }
        .site-city {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          margin: 0 0 10px;
        }

        /* Stats row — wraps on mobile */
        .site-stats-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .site-health-wrap {
          display: flex;
          align-items: baseline;
          gap: 4px;
        }
        .site-health-pct {
          font-size: 20px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .site-health-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
        }
        .site-device-counts {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          flex-wrap: wrap;
        }
        .site-count-total { color: var(--vemio-text-muted); }
        .site-alert-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--color-severity-high);
        }
        .site-tickets-badge {
          font-size: 11px;
          color: var(--vemio-text-muted);
        }

        /* Health bar */
        .site-health-bar-track {
          height: 6px;
          border-radius: 99px;
          background: var(--color-vemio-border);
          opacity: 0.5;
          overflow: hidden;
        }
        .site-health-bar-fill {
          height: 100%;
          border-radius: 99px;
        }

        .site-chevron {
          width: 16px;
          height: 16px;
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
          margin-top: 4px;
        }
      `}</style>
    </>
  );
}