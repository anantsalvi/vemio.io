"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Shield, Wifi, Server, MonitorSpeaker, Radio,
  Network, Globe, Clock, Activity, Cpu, HardDrive, Cable, Users,
  ChevronDown, ChevronUp, ExternalLink, AlertTriangle, Zap,
  Search, ArrowUpDown, CircleDot, Layers, Hash, MemoryStick,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */
const STATUS = {
  up:       { label: "Online",   color: "#22c55e", bg: "rgba(34,197,94,0.10)" },
  down:     { label: "Offline",  color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  degraded: { label: "Degraded", color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  unknown:  { label: "Unknown",  color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
};

const TYPE_META = {
  firewall:     { icon: Shield,         color: "#ef4444", label: "Firewall" },
  core_switch:  { icon: MonitorSpeaker, color: "#3b82f6", label: "Core Switch" },
  access_switch:{ icon: MonitorSpeaker, color: "#06b6d4", label: "Access Switch" },
  access_point: { icon: Wifi,           color: "#a855f7", label: "Access Point" },
  router:       { icon: Radio,          color: "#f97316", label: "Router" },
  server:       { icon: Cpu,            color: "#6366f1", label: "Server" },
  printer:      { icon: HardDrive,      color: "#f59e0b", label: "Printer" },
  other:        { icon: Server,         color: "#6b7280", label: "Device" },
};

const PORT_STATUS_COLORS = {
  up:   "#22c55e",
  down: "#374151",
  adminDown: "#ef4444",
  dormant: "#f59e0b",
};

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */
function timeAgo(date) {
  if (!date) return "\u2014";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m ago";
  return Math.floor(s / 86400) + "d " + Math.floor((s % 86400) / 3600) + "h ago";
}

function fmtBytes(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const n = Number(bytes);
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(1) + " KB";
  if (n < 1073741824) return (n / 1048576).toFixed(1) + " MB";
  return (n / 1073741824).toFixed(2) + " GB";
}

function fmtSpeed(mbps) {
  if (!mbps) return "\u2014";
  if (mbps >= 1000) return (mbps / 1000) + " Gbps";
  return mbps + " Mbps";
}

/* ═══════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════ */
function Section({ title, subtitle, icon: Icon, iconColor, children, collapsible, defaultOpen, count, badge }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, overflow: "hidden", marginBottom: 16,
    }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", cursor: collapsible ? "pointer" : "default",
          borderBottom: (!collapsible || open) ? "1px solid rgba(255,255,255,0.04)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {Icon && <Icon size={16} style={{ color: iconColor || "#d4a843", flexShrink: 0 }} />}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>{title}</span>
              {count != null && (
                <span style={{
                  fontSize: 11, fontWeight: 600, background: "rgba(212,168,67,0.15)",
                  color: "#d4a843", padding: "2px 8px", borderRadius: 10,
                }}>{count}</span>
              )}
              {badge && (
                <span style={{
                  fontSize: 11, fontWeight: 500, background: badge.bg || "rgba(34,197,94,0.12)",
                  color: badge.color || "#22c55e", padding: "2px 8px", borderRadius: 10,
                }}>{badge.text}</span>
              )}
            </div>
            {subtitle && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>{subtitle}</p>}
          </div>
        </div>
        {collapsible && (open
          ? <ChevronUp size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
          : <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.3)" }} />
        )}
      </div>
      {(!collapsible || open) && <div style={{ padding: "16px 18px" }}>{children}</div>}
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 10, padding: "14px 16px", flex: "1 1 0",
      minWidth: 120,
    }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: color || "rgba(255,255,255,0.92)", margin: "4px 0 0", fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit", textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>{value || "\u2014"}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PORT STENCIL — Visual grid like Auvik
   ═══════════════════════════════════════════════════════════ */
function PortStencil({ ports, onPortClick, selectedPort }) {
  if (!ports || ports.length === 0) return null;

  const getPortColor = (p) => {
    if (p.adminStatus === "down") return PORT_STATUS_COLORS.adminDown;
    if (p.operStatus === "up") return PORT_STATUS_COLORS.up;
    if (p.operStatus === "dormant") return PORT_STATUS_COLORS.dormant;
    return PORT_STATUS_COLORS.down;
  };

  // Split into rows of 24 ports (typical switch layout)
  const ROW_SIZE = Math.min(ports.length, 24);
  // Top row = odd ports (1,3,5...), bottom = even ports (2,4,6...)
  // But if port names are just numbers, split top/bottom
  const topRow = ports.filter((_, i) => i % 2 === 0);
  const bottomRow = ports.filter((_, i) => i % 2 === 1);

  const PortDot = ({ port }) => {
    const isSelected = selectedPort?.index === port.index;
    const color = getPortColor(port);
    const isUp = port.operStatus === "up";
    return (
      <div
        onClick={() => onPortClick?.(port)}
        title={`Port ${port.name || port.index} — ${port.operStatus} ${port.speedMbps ? fmtSpeed(port.speedMbps) : ""}`}
        style={{
          width: 28, height: 20, borderRadius: 3,
          background: isSelected ? "rgba(212,168,67,0.25)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${color}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
          position: "relative",
          boxShadow: isUp ? `0 0 6px ${color}40` : "none",
        }}
      >
        <span style={{
          fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.6)",
          fontFamily: "'JetBrains Mono', monospace",
        }}>{port.name || port.index}</span>
      </div>
    );
  };

  return (
    <div style={{
      background: "rgba(0,0,0,0.3)", borderRadius: 10, padding: "16px 14px",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Top row */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 4 }}>
        {topRow.map(p => <PortDot key={p.index} port={p} />)}
      </div>
      {/* Bottom row */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {bottomRow.map(p => <PortDot key={p.index} port={p} />)}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {[
          { color: PORT_STATUS_COLORS.up, label: "Up" },
          { color: PORT_STATUS_COLORS.down, label: "Down" },
          { color: PORT_STATUS_COLORS.adminDown, label: "Admin Down" },
          { color: PORT_STATUS_COLORS.dormant, label: "Dormant" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, border: `2px solid ${l.color}` }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PORT DETAIL PANEL — shows when a port is clicked
   ═══════════════════════════════════════════════════════════ */
function PortDetailPanel({ port, endpoints, onClose }) {
  if (!port) return null;

  // Find endpoints on this port
  const portEndpoints = (endpoints || []).filter(e =>
    e.port === port.index || e.portName === port.name
  );

  return (
    <div style={{
      background: "rgba(212,168,67,0.05)", border: "1px solid rgba(212,168,67,0.2)",
      borderRadius: 10, padding: 16, marginTop: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#d4a843" }}>
          Port {port.name || port.index}
        </span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", fontSize: 18, lineHeight: 1,
        }}>&times;</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
        <InfoRow label="Status" value={
          <span style={{ color: port.operStatus === "up" ? "#22c55e" : "#ef4444" }}>
            {port.operStatus?.toUpperCase()}
          </span>
        } />
        <InfoRow label="Admin" value={port.adminStatus?.toUpperCase()} />
        <InfoRow label="Speed" value={fmtSpeed(port.speedMbps)} />
        <InfoRow label="Duplex" value={port.duplex || "\u2014"} />
        <InfoRow label="In Traffic" value={fmtBytes(port.inOctets)} mono />
        <InfoRow label="Out Traffic" value={fmtBytes(port.outOctets)} mono />
        <InfoRow label="In Errors" value={String(port.inErrors || 0)} mono />
        <InfoRow label="Out Errors" value={String(port.outErrors || 0)} mono />
        {port.connectedDevice && <InfoRow label="Connected" value={port.connectedDevice} />}
      </div>
      {portEndpoints.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>
            Connected Endpoints ({portEndpoints.length})
          </p>
          {portEndpoints.map((ep, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12,
            }}>
              <span style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>
                {ep.ip || ep.mac}
              </span>
              <span style={{ color: "rgba(255,255,255,0.45)" }}>{ep.manufacturer || ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   UPTIME CHART
   ═══════════════════════════════════════════════════════════ */
function UptimeChart({ history, days }) {
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    const data = [];
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    // Create hourly buckets
    const bucketMs = days <= 7 ? 3600000 : 86400000; // hourly for <=7d, daily otherwise
    let t = start.getTime();
    let statusIdx = 0;
    while (t < now.getTime()) {
      // Find status at this time
      while (statusIdx < history.length - 1 && new Date(history[statusIdx + 1].changedAt).getTime() <= t) {
        statusIdx++;
      }
      const status = history[statusIdx]?.status || "unknown";
      data.push({
        time: t,
        label: new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        value: status === "up" ? 1 : 0,
      });
      t += bucketMs;
    }
    return data;
  }, [history, days]);

  if (chartData.length === 0) return <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center", padding: 20 }}>No uptime data available</p>;

  return (
    <ResponsiveContainer width="100%" height={100}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="uptimeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} interval="preserveStartEnd" />
        <YAxis domain={[0, 1]} hide />
        <ReTooltip
          contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "rgba(255,255,255,0.6)" }}
          formatter={(v) => [v === 1 ? "Online" : "Offline", "Status"]}
        />
        <Area type="stepAfter" dataKey="value" stroke="#22c55e" fill="url(#uptimeGrad)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function DeviceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPort, setSelectedPort] = useState(null);
  const [portSearch, setPortSearch] = useState("");
  const [portFilter, setPortFilter] = useState("all"); // all, up, down, errors
  const [epSearch, setEpSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/devices/${id}/detail?days=${days}`);
      if (!res.ok) throw new Error("API " + res.status);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  /* ── Filtered ports ── */
  const filteredPorts = useMemo(() => {
    if (!data?.ports) return [];
    let list = data.ports;
    if (portFilter === "up") list = list.filter(p => p.operStatus === "up");
    else if (portFilter === "down") list = list.filter(p => p.operStatus !== "up");
    else if (portFilter === "errors") list = list.filter(p => (p.inErrors || 0) + (p.outErrors || 0) > 0);
    if (portSearch) {
      const q = portSearch.toLowerCase();
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        String(p.index).includes(q) ||
        (p.connectedDevice || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.ports, portFilter, portSearch]);

  /* ── Filtered endpoints ── */
  const filteredEndpoints = useMemo(() => {
    if (!data?.endpoints) return [];
    if (!epSearch) return data.endpoints;
    const q = epSearch.toLowerCase();
    return data.endpoints.filter(e =>
      (e.ip || "").toLowerCase().includes(q) ||
      (e.mac || "").toLowerCase().includes(q) ||
      (e.manufacturer || "").toLowerCase().includes(q) ||
      (e.hostname || "").toLowerCase().includes(q)
    );
  }, [data?.endpoints, epSearch]);

  /* ── Loading / Error states ── */
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <RefreshCw size={24} style={{ color: "#d4a843", animation: "spin 1s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 12, fontSize: 14 }}>Loading device details...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 40, textAlign: "center" }}>
      <AlertTriangle size={32} style={{ color: "#ef4444", margin: "0 auto 12px" }} />
      <p style={{ color: "#ef4444", fontSize: 16, fontWeight: 600 }}>Failed to load device</p>
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 4 }}>{error}</p>
      <button onClick={() => { setLoading(true); setError(null); fetchData(); }}
        style={{ marginTop: 16, padding: "8px 20px", background: "rgba(212,168,67,0.15)", border: "1px solid rgba(212,168,67,0.3)", borderRadius: 8, color: "#d4a843", cursor: "pointer", fontSize: 13 }}>
        Retry
      </button>
    </div>
  );

  if (!data?.device) return null;

  const dev = data.device;
  const st = STATUS[dev.status] || STATUS.unknown;
  const tm = TYPE_META[dev.type] || TYPE_META.other;
  const TypeIcon = tm.icon;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        .dd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .dd-table th { text-align: left; padding: 8px 10px; color: rgba(255,255,255,0.45); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .dd-table td { padding: 8px 10px; color: rgba(255,255,255,0.78); border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .dd-table tr:hover td { background: rgba(255,255,255,0.02); }
        .dd-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .dd-filter-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 12px; transition: all 0.15s; }
        .dd-filter-btn.active { background: rgba(212,168,67,0.15); border-color: rgba(212,168,67,0.3); color: #d4a843; }
        .dd-search { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 7px 12px 7px 32px; color: rgba(255,255,255,0.85); font-size: 13px; outline: none; width: 220px; }
        .dd-search:focus { border-color: rgba(212,168,67,0.4); }
        .dd-search::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.push("/devices")} style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, padding: "8px 10px", cursor: "pointer", color: "rgba(255,255,255,0.6)",
          display: "flex", alignItems: "center",
        }}><ArrowLeft size={16} /></button>
        <div style={{
          width: 44, height: 44, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          background: `${tm.color}18`, border: `1px solid ${tm.color}30`,
        }}>
          <TypeIcon size={22} style={{ color: tm.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "rgba(255,255,255,0.95)", margin: 0 }}>{dev.name}</h1>
            <span className="dd-pill" style={{ background: st.bg, color: st.color }}>
              <CircleDot size={10} /> {st.label}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
            {tm.label} {dev.make ? `\u00b7 ${dev.make}` : ""} {dev.model ? dev.model : ""} {dev.siteName ? `\u00b7 ${dev.siteName}` : ""}
          </p>
        </div>
        <button onClick={handleRefresh} style={{
          background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)",
          borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#d4a843",
          display: "flex", alignItems: "center", gap: 6, fontSize: 13,
        }}>
          <RefreshCw size={14} style={refreshing ? { animation: "spin 1s linear infinite" } : {}} />
          Refresh
        </button>
      </div>

      {/* ── Top stat cards ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Uptime" value={dev.uptimeFormatted || "\u2014"} sub={data.uptime?.percent != null ? `${data.uptime.percent}% (${days}d)` : null} color="#22c55e" />
        <StatCard label="Ports" value={data.portStats?.total || 0} sub={`${data.portStats?.up || 0} up \u00b7 ${data.portStats?.down || 0} down`} color="#3b82f6" />
        <StatCard label="Endpoints" value={data.endpoints?.length || 0} color="#a855f7" />
        <StatCard label="Neighbors" value={data.neighbors?.length || 0} color="#06b6d4" />
        {data.portStats?.errors > 0 && (
          <StatCard label="Port Errors" value={data.portStats.errors} color="#ef4444" />
        )}
      </div>

      {/* ── Device Info ── */}
      <Section title="Device Information" icon={Server} iconColor={tm.color}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 0 }}>
          <InfoRow label="IP Address" value={dev.ipAddress} mono />
          <InfoRow label="MAC Address" value={dev.macAddress} mono />
          <InfoRow label="Make / Model" value={[dev.make, dev.model].filter(Boolean).join(" ") || dev.makeModel || "\u2014"} />
          <InfoRow label="Serial Number" value={dev.serialNumber} mono />
          <InfoRow label="Firmware" value={dev.firmwareVersion} />
          <InfoRow label="SNMP Version" value={dev.snmpVersion} />
          <InfoRow label="Last Seen" value={timeAgo(dev.lastSeenAt)} />
          <InfoRow label="First Discovered" value={dev.createdAt ? new Date(dev.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "\u2014"} />
          {dev.sysDescr && <InfoRow label="System Description" value={dev.sysDescr} />}
          {dev.cpuPercent != null && <InfoRow label="CPU" value={`${dev.cpuPercent}%`} />}
          {dev.memoryPercent != null && <InfoRow label="Memory" value={`${dev.memoryPercent}%`} />}
        </div>
      </Section>

      {/* ── Uptime Chart ── */}
      <Section title="Uptime History" icon={Activity} iconColor="#22c55e"
        badge={data.uptime?.percent != null ? { text: `${data.uptime.percent}%`, color: data.uptime.percent >= 99 ? "#22c55e" : data.uptime.percent >= 95 ? "#f59e0b" : "#ef4444", bg: data.uptime.percent >= 99 ? "rgba(34,197,94,0.12)" : data.uptime.percent >= 95 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)" } : null}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[7, 14, 30, 90].map(d => (
            <button key={d} className={`dd-filter-btn${days === d ? " active" : ""}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
        <UptimeChart history={data.history} days={days} />
      </Section>

      {/* ── Port Stencil ── */}
      {data.ports?.length > 0 && (
        <Section title="Ports &amp; Interfaces" icon={Cable} iconColor="#3b82f6" count={data.portStats?.total}>
          <PortStencil ports={data.ports} onPortClick={setSelectedPort} selectedPort={selectedPort} />
          {selectedPort && (
            <PortDetailPanel port={selectedPort} endpoints={data.endpoints} onClose={() => setSelectedPort(null)} />
          )}

          {/* Port filters + search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
              <input className="dd-search" placeholder="Search ports..." value={portSearch} onChange={e => setPortSearch(e.target.value)} />
            </div>
            {["all", "up", "down", "errors"].map(f => (
              <button key={f} className={`dd-filter-btn${portFilter === f ? " active" : ""}`} onClick={() => setPortFilter(f)}>
                {f === "all" ? "All" : f === "up" ? "Up" : f === "down" ? "Down" : "Errors"}
              </button>
            ))}
          </div>

          {/* Port table */}
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="dd-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Status</th>
                  <th>Speed</th>
                  <th>In Traffic</th>
                  <th>Out Traffic</th>
                  <th>Errors</th>
                  <th>Connected</th>
                </tr>
              </thead>
              <tbody>
                {filteredPorts.map(p => {
                  const errs = (p.inErrors || 0) + (p.outErrors || 0);
                  return (
                    <tr key={p.index} onClick={() => setSelectedPort(p)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 600 }}>{p.name || p.index}</td>
                      <td>
                        <span className="dd-pill" style={{
                          background: p.operStatus === "up" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
                          color: p.operStatus === "up" ? "#22c55e" : p.adminStatus === "down" ? "#ef4444" : "#6b7280",
                        }}>
                          <CircleDot size={8} />
                          {p.adminStatus === "down" ? "Admin Off" : (p.operStatus || "unknown").toUpperCase()}
                        </span>
                      </td>
                      <td>{fmtSpeed(p.speedMbps)}</td>
                      <td>{fmtBytes(p.inOctets)}</td>
                      <td>{fmtBytes(p.outOctets)}</td>
                      <td style={{ color: errs > 0 ? "#ef4444" : "inherit" }}>{errs > 0 ? errs : "\u2014"}</td>
                      <td style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{p.connectedDevice || "\u2014"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPorts.length === 0 && (
              <p style={{ textAlign: "center", padding: 20, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No ports match filters</p>
            )}
          </div>
        </Section>
      )}

      {/* ── VLANs ── */}
      {data.vlans?.length > 0 && (
        <Section title="VLANs" icon={Layers} iconColor="#f59e0b" count={data.vlans.length} collapsible defaultOpen>
          <table className="dd-table">
            <thead>
              <tr>
                <th>VLAN ID</th>
                <th>Name</th>
                <th>Tagged Ports</th>
                <th>Untagged Ports</th>
              </tr>
            </thead>
            <tbody>
              {data.vlans.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600, color: "#d4a843" }}>{v.id}</td>
                  <td>{v.name || "\u2014"}</td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
                    {v.taggedPorts || "\u2014"}
                  </td>
                  <td style={{ fontSize: 11 }}>{v.untaggedPorts || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ── Neighbors ── */}
      {data.neighbors?.length > 0 && (
        <Section title="Connected Neighbors" icon={Network} iconColor="#06b6d4" count={data.neighbors.length} collapsible defaultOpen>
          <table className="dd-table">
            <thead>
              <tr>
                <th>Device</th>
                <th>Type</th>
                <th>Status</th>
                <th>Local Port</th>
                <th>Remote Port</th>
                <th>Method</th>
              </tr>
            </thead>
            <tbody>
              {data.neighbors.map((n, i) => {
                const ntm = TYPE_META[n.type] || TYPE_META.other;
                const NIcon = ntm.icon;
                return (
                  <tr key={i} onClick={() => n.deviceId && router.push(`/devices/${n.deviceId}`)} style={{ cursor: n.deviceId ? "pointer" : "default" }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <NIcon size={14} style={{ color: ntm.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.88)" }}>{n.name}</span>
                        {n.deviceId && <ExternalLink size={10} style={{ color: "rgba(255,255,255,0.25)" }} />}
                      </div>
                    </td>
                    <td style={{ color: ntm.color, fontSize: 11, textTransform: "uppercase" }}>{ntm.label}</td>
                    <td>
                      <span className="dd-pill" style={{
                        background: n.status === "up" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
                        color: n.status === "up" ? "#22c55e" : "#ef4444",
                      }}>
                        <CircleDot size={8} /> {(n.status || "unknown").toUpperCase()}
                      </span>
                    </td>
                    <td>{n.localInterface || "\u2014"}</td>
                    <td>{n.remoteInterface || "\u2014"}</td>
                    <td>
                      <span className="dd-pill" style={{
                        background: n.method === "lldp" ? "rgba(59,130,246,0.12)" : "rgba(245,158,11,0.12)",
                        color: n.method === "lldp" ? "#3b82f6" : "#f59e0b",
                      }}>{(n.method || "").toUpperCase()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {/* ── Connected Endpoints ── */}
      {data.endpoints?.length > 0 && (
        <Section title="Connected Endpoints" icon={Users} iconColor="#a855f7" count={data.endpoints.length} collapsible defaultOpen>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
            <input className="dd-search" placeholder="Search endpoints..." value={epSearch} onChange={e => setEpSearch(e.target.value)} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="dd-table">
              <thead>
                <tr>
                  <th>IP Address</th>
                  <th>MAC Address</th>
                  <th>Manufacturer</th>
                  <th>Type</th>
                  <th>Port</th>
                  <th>VLAN</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {filteredEndpoints.map((ep, i) => (
                  <tr key={i}>
                    <td>{ep.ip || "\u2014"}</td>
                    <td style={{ fontSize: 11 }}>{ep.mac || "\u2014"}</td>
                    <td style={{ color: "rgba(255,255,255,0.65)" }}>{ep.manufacturer || "Unknown"}</td>
                    <td>
                      <span className="dd-pill" style={{
                        background: ep.connectionType === "wireless" ? "rgba(168,85,247,0.12)" : "rgba(59,130,246,0.12)",
                        color: ep.connectionType === "wireless" ? "#a855f7" : "#3b82f6",
                      }}>
                        {ep.connectionType === "wireless" ? <Wifi size={10} /> : <Cable size={10} />}
                        {(ep.connectionType || "wired").toUpperCase()}
                      </span>
                    </td>
                    <td>{ep.portName || ep.port || "\u2014"}</td>
                    <td>{ep.vlanId ? `${ep.vlanId}${ep.vlanName ? ` (${ep.vlanName})` : ""}` : "\u2014"}</td>
                    <td style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>{timeAgo(ep.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEndpoints.length === 0 && (
              <p style={{ textAlign: "center", padding: 20, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>No endpoints match search</p>
            )}
          </div>
        </Section>
      )}

      {/* ── IP Interfaces ── */}
      {data.interfaces?.length > 0 && (
        <Section title="IP Interfaces" icon={Globe} iconColor="#6366f1" count={data.interfaces.length} collapsible>
          <table className="dd-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Interface</th>
                <th>VLAN</th>
                <th>Primary</th>
              </tr>
            </thead>
            <tbody>
              {data.interfaces.map((iface, i) => (
                <tr key={i}>
                  <td>{iface.ipAddress || "\u2014"}</td>
                  <td>{iface.interfaceName || "\u2014"}</td>
                  <td>{iface.vlanId || "\u2014"}</td>
                  <td>{iface.isPrimary ? "\u2705" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ── Status History Log ── */}
      {data.history?.length > 0 && (
        <Section title="Status Change Log" icon={Clock} iconColor="rgba(255,255,255,0.4)" count={data.history.length} collapsible defaultOpen={false}>
          <table className="dd-table">
            <thead>
              <tr><th>Time</th><th>Status</th><th>Source</th></tr>
            </thead>
            <tbody>
              {[...data.history].reverse().slice(0, 50).map((h, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 11 }}>{new Date(h.changedAt).toLocaleString("en-IN")}</td>
                  <td>
                    <span className="dd-pill" style={{
                      background: h.status === "up" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
                      color: h.status === "up" ? "#22c55e" : "#ef4444",
                    }}>{h.status?.toUpperCase()}</span>
                  </td>
                  <td style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{h.source || "collector"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

