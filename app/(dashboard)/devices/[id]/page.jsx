"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Shield, Wifi, Server, MonitorSpeaker, Radio,
  Network, Globe, Clock, Activity, Cpu, HardDrive, Cable, Users,
  ChevronDown, ChevronUp, ExternalLink, Archive, RotateCcw, AlertTriangle,
} from "lucide-react";

const STATUS = {
  up:       { label: "Online",   color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
  down:     { label: "Offline",  color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  degraded: { label: "Degraded", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  unknown:  { label: "Unknown",  color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

const TYPE_ICONS = {
  firewall: Shield, core_switch: MonitorSpeaker, access_switch: MonitorSpeaker,
  access_point: Wifi, router: Radio, server: Cpu, printer: HardDrive, other: Server,
};

const TYPE_COLORS = {
  firewall: "#ef4444", core_switch: "#3b82f6", access_switch: "#06b6d4",
  access_point: "#a855f7", router: "#f97316", server: "#6366f1",
  printer: "#f59e0b", other: "#6b7280",
};

function timeAgo(date) {
  if (!date) return "\u2014";
  var s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m ago";
  return Math.floor(s / 86400) + "d " + Math.floor((s % 86400) / 3600) + "h ago";
}

function formatDate(d) {
  if (!d) return "\u2014";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Section({ title, subtitle, icon: Icon, iconColor, children, collapsible, defaultOpen, count }) {
  var _a = useState(defaultOpen !== false), open = _a[0], setOpen = _a[1];
  return (
    <div className="dd-section">
      <div className={"dd-section-header" + (collapsible ? " dd-section-header--click" : "")}
        onClick={collapsible ? function() { setOpen(function(o) { return !o; }); } : undefined}>
        <div className="dd-section-header-left">
          {Icon && <Icon size={16} style={{ color: iconColor || "var(--color-vemio-amber)", flexShrink: 0 }} />}
          <div>
            <h3 className="dd-section-title">{title}{count != null ? <span className="dd-section-count">{count}</span> : null}</h3>
            {subtitle && <p className="dd-section-sub">{subtitle}</p>}
          </div>
        </div>
        {collapsible && (open
          ? <ChevronUp size={16} style={{ color: "var(--color-vemio-text-dim)" }} />
          : <ChevronDown size={16} style={{ color: "var(--color-vemio-text-dim)" }} />
        )}
      </div>
      {(!collapsible || open) && <div className="dd-section-body">{children}</div>}
    </div>
  );
}

function InfoCard({ label, value, mono }) {
  return (
    <div className="dd-info-card">
      <p className="dd-info-label">{label}</p>
      <p className={"dd-info-value" + (mono ? " mono" : "")}>{value}</p>
    </div>
  );
}

export default function DeviceDetailPage() {
  var _a = useParams(), id = _a.id;
  var router = useRouter();
  var _b = useState(null), data = _b[0], setData = _b[1];
  var _c = useState(30), days = _c[0], setDays = _c[1];
  var _d = useState(true), loading = _d[0], setLoading = _d[1];
  var _e = useState(null), error = _e[0], setError = _e[1];
  var _f = useState(""), epSearch = _f[0], setEpSearch = _f[1];

  useEffect(function() {
    var cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/devices/" + id + "/detail?days=" + days)
      .then(function(res) {
        if (res.status === 404) { router.push("/devices"); return null; }
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function(json) { if (!cancelled && json) setData(json); })
      .catch(function(err) { if (!cancelled) setError(err.message); })
      .finally(function() { if (!cancelled) setLoading(false); });
    return function() { cancelled = true; };
  }, [id, days, router]);

  var device = data ? data.device : null;
  var neighbors = data ? (data.neighbors || []) : [];
  var interfaces = data ? (data.interfaces || []) : [];
  var endpoints = data ? (data.endpoints || []) : [];
  var uptime = data ? data.uptime : null;
  var history = data ? (data.history || []) : [];
  var st = device ? (STATUS[device.status] || STATUS.unknown) : null;
  var TypeIcon = device ? (TYPE_ICONS[device.type] || Server) : Server;
  var typeColor = device ? (TYPE_COLORS[device.type] || "#6b7280") : "#6b7280";

  var filteredEps = useMemo(function() {
    if (!epSearch.trim()) return endpoints;
    var q = epSearch.toLowerCase();
    return endpoints.filter(function(e) {
      return (e.mac && e.mac.toLowerCase().indexOf(q) >= 0) ||
             (e.ip && e.ip.indexOf(q) >= 0) ||
             (e.manufacturer && e.manufacturer.toLowerCase().indexOf(q) >= 0);
    });
  }, [endpoints, epSearch]);

  if (loading && !data) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <RefreshCw size={24} style={{ color: "var(--color-vemio-amber)", animation: "spin 1s linear infinite" }} />
    </div>;
  }

  if (error && !data) {
    return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12, color: "var(--color-vemio-text-dim)", fontSize: 13 }}>
      <AlertTriangle size={28} style={{ color: "#ef4444" }} />
      <p>Failed to load device: {error}</p>
    </div>;
  }

  if (!device) return null;

  return (
    <>
      <div className="dd-root">
        <div className="dd-header">
          <button onClick={function() { router.push("/devices"); }} className="dd-back" aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <div className="dd-header-body">
            <div className="dd-name-row">
              <div className="dd-type-icon" style={{ background: typeColor + "18", color: typeColor }}>
                <TypeIcon size={18} />
              </div>
              <h1 className="dd-name">{device.name}</h1>
              {device.isRetired && <span className="dd-retired-tag">Retired</span>}
            </div>
            <div className="dd-badges">
              <span className="dd-badge" style={{ background: st.bg, color: st.color }}>
                <span className="dd-dot" style={{ background: st.color }} />
                {st.label}
              </span>
              <span className="dd-badge dd-badge--type">{(device.type || "").replace(/_/g, " ")}</span>
              {device.make && <span className="dd-badge dd-badge--muted">{device.make}</span>}
              {device.model && <span className="dd-badge dd-badge--muted">{device.model}</span>}
              {device.siteName && <span className="dd-badge dd-badge--muted">{device.siteName}</span>}
            </div>
          </div>
        </div>

        {device.description && (
          <div className="dd-desc">
            <span className="dd-desc-label">System Description</span>
            <span className="dd-desc-text">{device.description}</span>
          </div>
        )}

        <div className="dd-grid">
          <InfoCard label="IP Address" value={device.ipAddress || "\u2014"} mono />
          <InfoCard label="Last Seen" value={device.lastSeenAt ? timeAgo(device.lastSeenAt) : "\u2014"} />
          <InfoCard label="SNMP Uptime" value={device.uptimeFormatted || "\u2014"} />
          <InfoCard label="Serial Number" value={device.serialNumber || "\u2014"} mono />
          <InfoCard label="Firmware" value={device.firmwareVersion || "\u2014"} mono />
          <InfoCard label="First Discovered" value={formatDate(device.createdAt)} />
        </div>

        <Section title="Availability" subtitle={(uptime ? uptime.totalEvents : 0) + " events in " + days + "d"} icon={Activity} iconColor="#14b8a6">
          <div className="dd-uptime-row">
            <div className="dd-uptime-pct" style={{ color: (uptime && uptime.percent != null ? uptime.percent : 0) >= 99 ? "#22c55e" : (uptime && uptime.percent != null ? uptime.percent : 0) >= 95 ? "#f59e0b" : "#ef4444" }}>
              {uptime && uptime.percent != null ? uptime.percent + "%" : "\u2014"}
            </div>
            <div className="dd-range-btns">
              {[7, 30, 90].map(function(d) {
                return <button key={d} onClick={function() { setDays(d); }}
                  className={"dd-range-btn" + (days === d ? " dd-range-btn--active" : "")}>{d}d</button>;
              })}
            </div>
          </div>
          {history.length > 0 && (
            <div className="dd-timeline">
              {history.map(function(h, i) {
                var cfg = STATUS[h.status] || STATUS.unknown;
                return (
                  <div key={i} className="dd-timeline-item">
                    <span className="dd-timeline-dot" style={{ background: cfg.color }} />
                    <span className="dd-timeline-status" style={{ color: cfg.color }}>{cfg.label}</span>
                    <span className="dd-timeline-time">{new Date(h.changedAt).toLocaleString("en-IN")}</span>
                    <span className="dd-timeline-source">{h.source}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {interfaces.length > 0 && (
          <Section title="IP Interfaces" icon={Globe} iconColor="#3b82f6" count={interfaces.length} collapsible defaultOpen={interfaces.length > 1}>
            <div className="dd-iface-list">
              {interfaces.map(function(iface, i) {
                return (
                  <div key={i} className={"dd-iface-row" + (iface.isPrimary ? " dd-iface-row--primary" : "")}>
                    <span className="dd-iface-ip">{iface.ipAddress}</span>
                    <div className="dd-iface-tags">
                      {iface.isPrimary && <span className="dd-tag dd-tag--amber">Primary</span>}
                      {iface.interfaceName && <span className="dd-tag">{iface.interfaceName}</span>}
                      {iface.vlanId && <span className="dd-tag">VLAN {iface.vlanId}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {neighbors.length > 0 && (
          <Section title="Connected Devices" icon={Network} iconColor="#3b82f6" count={neighbors.length}>
            <div className="dd-neighbor-list">
              {neighbors.map(function(n, i) {
                var nst = STATUS[n.status] || STATUS.unknown;
                return (
                  <button key={i} className="dd-neighbor-item"
                    onClick={function() { if (n.deviceId) router.push("/devices/" + n.deviceId); }}>
                    <span className="dd-neighbor-dot" style={{ background: nst.color }} />
                    <div className="dd-neighbor-info">
                      <span className="dd-neighbor-name">{n.name}</span>
                      <div className="dd-neighbor-meta">
                        {n.ipAddress && <span className="dd-neighbor-ip">{n.ipAddress}</span>}
                        {n.type && <span className="dd-tag">{n.type.replace(/_/g, " ")}</span>}
                        {n.method && <span className="dd-tag dd-tag--method">{n.method}</span>}
                      </div>
                      {(n.localInterface || n.remoteInterface) && (
                        <div className="dd-neighbor-ports">
                          {n.localInterface && <span className="dd-tag">{n.localInterface}</span>}
                          {n.localInterface && n.remoteInterface && <span style={{ color: "var(--color-vemio-text-dim)", fontSize: 10 }}>{"\u2194"}</span>}
                          {n.remoteInterface && <span className="dd-tag">{n.remoteInterface}</span>}
                        </div>
                      )}
                    </div>
                    {n.deviceId && <ExternalLink size={12} style={{ opacity: 0.3, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {endpoints.length > 0 && (
          <Section title="Connected Endpoints" icon={Users} iconColor="#a855f7" count={endpoints.length} collapsible defaultOpen={true}>
            <div className="dd-ep-search-wrap">
              <input type="text" placeholder="Search MAC, IP, manufacturer\u2026" value={epSearch}
                onChange={function(e) { setEpSearch(e.target.value); }} className="dd-ep-search" />
            </div>
            <div className="dd-ep-table-wrap">
              <table className="dd-ep-table">
                <thead><tr><th>MAC</th><th>IP</th><th>Manufacturer</th><th>Type</th><th>Port</th><th>Last Seen</th></tr></thead>
                <tbody>
                  {filteredEps.slice(0, 50).map(function(ep, i) {
                    return (
                      <tr key={i}>
                        <td className="mono">{ep.mac}</td>
                        <td className="mono">{ep.ip || "\u2014"}</td>
                        <td>{ep.manufacturer || "\u2014"}</td>
                        <td><span className={"dd-conn-badge dd-conn-badge--" + (ep.connectionType || "wired")}>{ep.connectionType || "\u2014"}</span></td>
                        <td className="mono">{ep.port || "\u2014"}</td>
                        <td>{ep.lastSeen ? timeAgo(ep.lastSeen) : "\u2014"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredEps.length > 50 && <p className="dd-ep-more">Showing 50 of {filteredEps.length}</p>}
            </div>
          </Section>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .dd-root { display: flex; flex-direction: column; gap: 16px; max-width: 1200px; }
        .dd-header { display: flex; align-items: flex-start; gap: 12px; }
        .dd-back { padding: 8px; border-radius: 8px; border: 1px solid var(--color-vemio-border); background: var(--color-vemio-surface); cursor: pointer; display: flex; color: var(--color-vemio-text-muted); flex-shrink: 0; margin-top: 2px; }
        .dd-back:hover { background: var(--color-vemio-surface-raised); }
        .dd-header-body { min-width: 0; flex: 1; }
        .dd-name-row { display: flex; align-items: center; gap: 10px; }
        .dd-type-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dd-name { font-size: 18px; font-weight: 700; color: var(--color-vemio-text, #e2e8f0); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dd-retired-tag { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 4px; background: rgba(107,114,128,0.15); color: var(--color-vemio-text-dim); }
        .dd-badges { display: flex; align-items: center; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
        .dd-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
        .dd-badge--type { background: var(--color-vemio-surface-raised, rgba(255,255,255,0.05)); color: var(--color-vemio-text-muted); }
        .dd-badge--muted { background: transparent; color: var(--color-vemio-text-dim); font-weight: 500; }
        .dd-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .dd-desc { padding: 12px 16px; border-radius: 10px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); display: flex; flex-direction: column; gap: 4px; }
        .dd-desc-label { font-size: 9px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
        .dd-desc-text { font-size: 12px; color: var(--color-vemio-text-muted); font-family: monospace; line-height: 1.5; word-break: break-all; }
        .dd-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        @media (max-width: 767px) { .dd-grid { grid-template-columns: repeat(2, 1fr); } }
        .dd-info-card { padding: 14px; border-radius: 10px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); }
        .dd-info-label { font-size: 9px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.07em; margin: 0; font-weight: 600; }
        .dd-info-value { font-size: 14px; font-weight: 600; color: var(--color-vemio-text, #e2e8f0); margin: 4px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dd-info-value.mono { font-family: monospace; font-size: 13px; }
        .dd-section { border-radius: 14px; background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border); overflow: hidden; }
        .dd-section-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; }
        .dd-section-header--click { cursor: pointer; transition: background 0.12s; }
        .dd-section-header--click:hover { background: rgba(255,255,255,0.02); }
        .dd-section-header-left { display: flex; align-items: flex-start; gap: 10px; }
        .dd-section-title { font-size: 13px; font-weight: 600; color: var(--color-vemio-text, #e2e8f0); margin: 0; display: flex; align-items: center; gap: 6px; }
        .dd-section-count { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; background: rgba(148,163,184,0.1); color: var(--color-vemio-text-dim); }
        .dd-section-sub { font-size: 11px; color: var(--color-vemio-text-dim); margin: 2px 0 0; }
        .dd-section-body { padding: 0 18px 16px; }
        .dd-uptime-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .dd-uptime-pct { font-size: 28px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .dd-range-btns { display: flex; gap: 2px; }
        .dd-range-btn { padding: 5px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; background: transparent; color: var(--color-vemio-text-dim); transition: all 0.12s; font-family: inherit; }
        .dd-range-btn--active { background: rgba(245,158,11,0.1); color: var(--color-vemio-amber, #f59e0b); font-weight: 600; }
        .dd-timeline { display: flex; flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; }
        .dd-timeline-item { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 6px; transition: background 0.1s; }
        .dd-timeline-item:hover { background: rgba(255,255,255,0.02); }
        .dd-timeline-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .dd-timeline-status { font-size: 12px; font-weight: 500; min-width: 56px; }
        .dd-timeline-time { font-size: 11px; font-family: monospace; color: var(--color-vemio-text-dim); margin-left: auto; }
        .dd-timeline-source { font-size: 9px; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
        .dd-iface-list { display: flex; flex-direction: column; gap: 4px; }
        .dd-iface-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; gap: 10px; }
        .dd-iface-row:hover { background: rgba(255,255,255,0.02); }
        .dd-iface-row--primary { background: rgba(245,158,11,0.03); }
        .dd-iface-ip { font-family: monospace; font-size: 12px; color: var(--color-vemio-text, #e2e8f0); font-weight: 500; }
        .dd-iface-tags { display: flex; gap: 4px; flex-wrap: wrap; }
        .dd-tag { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 6px; border-radius: 4px; background: rgba(148,163,184,0.08); color: var(--color-vemio-text-dim); }
        .dd-tag--amber { background: rgba(245,158,11,0.12); color: var(--color-vemio-amber, #f59e0b); }
        .dd-tag--method { background: rgba(6,182,212,0.1); color: #06b6d4; }
        .dd-neighbor-list { display: flex; flex-direction: column; gap: 2px; }
        .dd-neighbor-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; border-radius: 8px; border: none; background: transparent; text-align: left; color: inherit; font-family: inherit; cursor: pointer; width: 100%; transition: background 0.12s; }
        .dd-neighbor-item:hover { background: rgba(255,255,255,0.03); }
        .dd-neighbor-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
        .dd-neighbor-info { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
        .dd-neighbor-name { font-size: 13px; font-weight: 500; color: var(--color-vemio-text, #e2e8f0); }
        .dd-neighbor-meta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
        .dd-neighbor-ip { font-size: 11px; font-family: monospace; color: var(--color-vemio-text-muted); }
        .dd-neighbor-ports { display: flex; align-items: center; gap: 3px; }
        .dd-ep-search-wrap { margin-bottom: 10px; }
        .dd-ep-search { width: 100%; padding: 8px 12px; border-radius: 8px; font-size: 12px; background: var(--color-vemio-bg); border: 1px solid var(--color-vemio-border); color: var(--color-vemio-text, #e2e8f0); outline: none; font-family: inherit; }
        .dd-ep-search::placeholder { color: rgba(148,163,184,0.4); }
        .dd-ep-search:focus { border-color: rgba(168,85,247,0.3); }
        .dd-ep-table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid var(--color-vemio-border); }
        .dd-ep-table { width: 100%; border-collapse: collapse; min-width: 600px; }
        .dd-ep-table th { padding: 8px 12px; text-align: left; font-size: 9px; font-weight: 600; color: var(--color-vemio-text-dim); text-transform: uppercase; letter-spacing: 0.07em; border-bottom: 1px solid var(--color-vemio-border); }
        .dd-ep-table td { padding: 7px 12px; font-size: 12px; color: var(--color-vemio-text-muted); border-bottom: 1px solid rgba(255,255,255,0.02); }
        .dd-ep-table tr:hover td { background: rgba(255,255,255,0.02); }
        .dd-ep-table .mono { font-family: monospace; font-size: 11px; }
        .dd-conn-badge { font-size: 9px; font-weight: 600; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; }
        .dd-conn-badge--wired { background: rgba(59,130,246,0.1); color: #3b82f6; }
        .dd-conn-badge--wireless { background: rgba(168,85,247,0.1); color: #a855f7; }
        .dd-ep-more { font-size: 11px; color: var(--color-vemio-text-dim); text-align: center; padding: 8px; margin: 0; }
      `}</style>
    </>
  );
}
