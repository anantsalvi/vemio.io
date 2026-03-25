'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, ChevronRight, ChevronDown, MapPin,
  Shield, AlertTriangle, Server, Wifi, HardDrive,
} from 'lucide-react';

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
  if (pct >= 90) return { text: 'text-status-up', bg: 'rgba(20,184,166,0.08)', border: 'rgba(20,184,166,0.2)' };
  if (pct >= 70) return { text: 'text-vemio-amber', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' };
  return { text: 'text-severity-high', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' };
}

// ── Site Detail (expandable) ────────────────────────────────────────────────

function SiteDetail({ siteId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDetail() {
      try {
        const res = await fetch(`/api/sites?id=${siteId}`);
        if (res.ok) setDetail(await res.json());
      } catch (err) { console.error('Site detail fetch:', err); }
      finally { setLoading(false); }
    }
    fetchDetail();
  }, [siteId]);

  if (loading) {
    return (
      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
        <div className="px-5 pb-5 pt-3">
          <RefreshCw className="w-4 h-4 text-vemio-amber animate-spin" />
        </div>
      </motion.div>
    );
  }
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
      <div className="px-5 pb-5 space-y-5" style={{ borderTop: '1px solid var(--color-vemio-border)' }}>

        {/* Device Breakdown by Type */}
        <div className="pt-4">
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-3">Device Breakdown</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {devices_by_type.map(dt => {
              const Icon = DEVICE_TYPE_ICONS[dt.device_type] || Server;
              const label = DEVICE_TYPE_LABELS[dt.device_type] || dt.device_type;
              const healthPct = dt.total > 0 ? Math.round((dt.up / dt.total) * 100) : 0;
              const hc = getHealthColor(healthPct);

              return (
                <div key={dt.device_type} className="rounded-lg p-3"
                  style={{ background: 'var(--color-vemio-surface-raised)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5 text-vemio-text-dim" />
                    <span className="text-xs font-medium text-vemio-text-muted">{label}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold text-vemio-text tabular-nums">{dt.total}</span>
                    <div className="flex items-center gap-2 text-[10px]">
                      {dt.up > 0 && <span className="text-status-up">{dt.up} up</span>}
                      {dt.down > 0 && <span className="text-severity-high">{dt.down} down</span>}
                      {dt.degraded > 0 && <span className="text-vemio-amber">{dt.degraded} deg</span>}
                    </div>
                  </div>
                  {/* Mini health bar */}
                  <div className="h-1 rounded-full mt-2" style={{ background: 'var(--color-vemio-border)', opacity: 0.4 }}>
                    <div className={`h-full rounded-full ${healthPct >= 90 ? 'bg-status-up' : healthPct >= 70 ? 'bg-vemio-amber' : 'bg-severity-high'}`}
                      style={{ width: `${healthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Critical Devices */}
        {critical_devices.length > 0 && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">
              Critical Infrastructure ({critical_devices.length})
            </p>
            <div className="space-y-1">
              {critical_devices.map(dev => (
                <div key={dev.id} className="flex items-center gap-3 text-xs rounded px-3 py-2"
                  style={{ background: 'var(--color-vemio-surface-raised)' }}>
                  <span className={`w-2 h-2 rounded-full ${
                    dev.current_status === 'up' ? 'bg-status-up' :
                    dev.current_status === 'down' ? 'bg-severity-high animate-pulse' : 'bg-vemio-amber'
                  }`} />
                  <span className="text-vemio-text font-medium flex-1">{dev.name}</span>
                  <span className="text-vemio-text-dim">{DEVICE_TYPE_LABELS[dev.device_type] || dev.device_type}</span>
                  {dev.has_redundancy === true && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded text-status-up"
                      style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.2)' }}>
                      HA
                    </span>
                  )}
                  {dev.has_redundancy === false && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded text-vemio-amber"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      Single
                    </span>
                  )}
                  <span className={`text-[10px] uppercase font-semibold ${
                    dev.current_status === 'up' ? 'text-status-up' : 'text-severity-high'
                  }`}>{dev.current_status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Down Devices */}
        {down_devices.length > 0 && (
          <div>
            <p className="text-[10px] text-severity-high uppercase tracking-widest mb-2">
              Down Devices ({down_devices.length})
            </p>
            <div className="space-y-1">
              {down_devices.slice(0, 10).map(dev => (
                <div key={dev.id} className="flex items-center gap-3 text-xs text-vemio-text-muted rounded px-3 py-1.5"
                  style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-severity-high animate-pulse" />
                  <span className="flex-1 truncate">{dev.name}</span>
                  <span className="text-vemio-text-dim">{DEVICE_TYPE_LABELS[dev.device_type] || dev.device_type}</span>
                  {dev.last_seen_at && (
                    <span className="text-[10px] text-vemio-text-dim">
                      last seen {new Date(dev.last_seen_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </span>
                  )}
                </div>
              ))}
              {down_devices.length > 10 && (
                <p className="text-[10px] text-vemio-text-dim pl-3">
                  +{down_devices.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active Alerts */}
        {active_alerts.length > 0 && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">
              Active Alerts ({active_alerts.length})
            </p>
            <div className="space-y-1">
              {active_alerts.map(al => (
                <div key={al.id} className="flex items-center gap-3 text-xs text-vemio-text-muted rounded px-3 py-1.5"
                  style={{ background: 'var(--color-vemio-surface-raised)' }}>
                  <span className={`text-[10px] uppercase font-semibold ${
                    al.severity === 'critical' ? 'text-severity-critical' :
                    al.severity === 'high' ? 'text-severity-high' : 'text-vemio-amber'
                  }`}>{al.severity}</span>
                  <span className="flex-1 truncate">{al.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tickets */}
        {recent_tickets.length > 0 && (
          <div>
            <p className="text-[10px] text-vemio-text-dim uppercase tracking-widest mb-2">
              Recent Tickets ({recent_tickets.length})
            </p>
            <div className="space-y-1">
              {recent_tickets.map(tk => (
                <div key={tk.id} className="flex items-center gap-3 text-xs text-vemio-text-muted rounded px-3 py-1.5"
                  style={{ background: 'var(--color-vemio-surface-raised)' }}>
                  <span className="text-vemio-text-dim font-mono">#{tk.glpi_ticket_id}</span>
                  <span className="flex-1 truncate">{tk.title}</span>
                  <span className={`text-[10px] uppercase ${
                    tk.status === 'resolved' || tk.status === 'closed' ? 'text-status-up' : 'text-vemio-amber'
                  }`}>{tk.status}</span>
                  {tk.sla_resolution_met === false && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded text-severity-high"
                      style={{ background: 'rgba(239,68,68,0.1)' }}>SLA breach</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Site Card ───────────────────────────────────────────────────────────────

function SiteCard({ site, isSelected, onSelect }) {
  const hc = getHealthColor(site.health_percent);
  const typeLabel = SITE_TYPE_LABELS[site.site_type] || site.site_type;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden cursor-pointer transition-all"
      style={{
        background: 'var(--color-vemio-surface)',
        border: isSelected ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--color-vemio-border)',
      }}
      onClick={() => onSelect(isSelected ? null : site.id)}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-vemio-text-dim" />
              <h3 className="text-sm font-semibold text-vemio-text">{site.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded text-vemio-text-dim"
                style={{ background: 'var(--color-vemio-surface-raised)' }}>
                {typeLabel}
              </span>
            </div>

            {/* Location */}
            {site.city && (
              <p className="text-[11px] text-vemio-text-dim mb-3">{site.city}{site.state ? `, ${site.state}` : ''}</p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Health percent */}
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold tabular-nums ${hc.text}`}>
                  {site.health_percent}%
                </span>
                <span className="text-[10px] text-vemio-text-dim uppercase">health</span>
              </div>

              {/* Device counts */}
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-vemio-text-muted">{site.devices.total} devices</span>
                {site.devices.up > 0 && <span className="text-status-up">{site.devices.up} up</span>}
                {site.devices.down > 0 && <span className="text-severity-high">{site.devices.down} down</span>}
                {site.devices.degraded > 0 && <span className="text-vemio-amber">{site.devices.degraded} deg</span>}
              </div>

              {/* Alerts + tickets */}
              {site.alerts.active > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-severity-high">
                  <AlertTriangle className="w-3 h-3" />
                  {site.alerts.active} alert{site.alerts.active > 1 ? 's' : ''}
                </span>
              )}
              {site.open_tickets > 0 && (
                <span className="text-[11px] text-vemio-text-muted">
                  {site.open_tickets} open ticket{site.open_tickets > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Health bar */}
            <div className="h-1.5 rounded-full mt-3" style={{ background: 'var(--color-vemio-border)', opacity: 0.4 }}>
              <motion.div
                className={`h-full rounded-full ${site.health_percent >= 90 ? 'bg-status-up' : site.health_percent >= 70 ? 'bg-vemio-amber' : 'bg-severity-high'}`}
                initial={{ width: 0 }}
                animate={{ width: `${site.health_percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>

          {isSelected
            ? <ChevronDown className="w-4 h-4 text-vemio-text-dim shrink-0 mt-1" />
            : <ChevronRight className="w-4 h-4 text-vemio-text-dim shrink-0 mt-1" />
          }
        </div>
      </div>

      <AnimatePresence>
        {isSelected && <SiteDetail siteId={site.id} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function SitesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    async function fetchSites() {
      setLoading(true);
      try {
        const res = await fetch('/api/sites');
        if (res.ok) setData(await res.json());
      } catch (err) { console.error('Sites fetch:', err); }
      finally { setLoading(false); }
    }
    fetchSites();
    const interval = setInterval(fetchSites, 60000);
    return () => clearInterval(interval);
  }, []);

  const sites = data?.sites || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-vemio-amber animate-spin" />
      </div>
    );
  }

  // Sort: worst health first
  const sorted = [...sites].sort((a, b) => a.health_percent - b.health_percent);

  // Summary
  const totalDevices = sites.reduce((s, site) => s + site.devices.total, 0);
  const totalDown = sites.reduce((s, site) => s + site.devices.down, 0);
  const totalAlerts = sites.reduce((s, site) => s + site.alerts.active, 0);
  const avgHealth = sites.length > 0
    ? Math.round(sites.reduce((s, site) => s + site.health_percent, 0) / sites.length * 10) / 10
    : 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vemio-text">Sites</h1>
          <p className="text-sm text-vemio-text-muted mt-0.5">Per-site infrastructure health and device breakdown</p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-3" style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}>
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider">Sites</p>
          <p className="text-2xl font-bold text-vemio-text mt-1 tabular-nums">{sites.length}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}>
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider">Total Devices</p>
          <p className="text-2xl font-bold text-vemio-text mt-1 tabular-nums">{totalDevices}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}>
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider">Avg Health</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${getHealthColor(avgHealth).text}`}>{avgHealth}%</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'var(--color-vemio-surface)', border: '1px solid var(--color-vemio-border)' }}>
          <p className="text-[10px] text-vemio-text-dim uppercase tracking-wider">Devices Down</p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${totalDown > 0 ? 'text-severity-high' : 'text-status-up'}`}>{totalDown}</p>
        </div>
      </motion.div>

      {/* Site Cards */}
      <div className="space-y-3">
        {sorted.map(site => (
          <motion.div key={site.id} variants={fadeUp}>
            <SiteCard site={site} isSelected={selectedId === site.id} onSelect={setSelectedId} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}