"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, RefreshCw, Shield, Wifi, Server, MonitorSpeaker, Radio,
  Network, Globe, Clock, Activity, Cpu, HardDrive, Cable, Users,
  ChevronDown, ChevronUp, ExternalLink, AlertTriangle,
  Search, CircleDot, Layers, Info, HeartPulse,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { UniversalStencil, parseFirmware } from "@/app/components/stencil-templates";
import TimeRangePicker from "@/app/components/TimeRangePicker";
import UptimeTimeline from "@/app/components/device/UptimeTimeline";
import HealthChart from "@/app/components/device/HealthChart";

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

const PORT_CAT = {
  physical:     { label: "Physical Ports",     color: "#22c55e" },
  physical_sfp: { label: "SFP / Fiber",        color: "#06b6d4" },
  trunk:        { label: "Trunks",             color: "#f59e0b" },
  loopback:     { label: "Loopback",           color: "#6366f1" },
  tunnel:       { label: "Tunnels & PPP",      color: "#a855f7" },
  virtual:      { label: "Virtual Interfaces", color: "#6b7280" },
  wireless:     { label: "Wireless",           color: "#ec4899" },
  other:        { label: "Other",              color: "#6b7280" },
};

const PORT_STATUS_COLOR = (p) => {
  if (p.adminStatus === "down") return "#ef4444";
  if (p.operStatus === "up") return "#22c55e";
  if (p.operStatus === "dormant") return "#f59e0b";
  return "#374151";
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

function fmtIp(ip) {
  if (!ip) return "\u2014";
  return String(ip).replace(/\/32$/, "");
}

function fmtMac(mac) {
  if (!mac) return "\u2014";
  return String(mac).toLowerCase();
}

function cleanModel(m) {
  if (!m) return "";
  return String(m).trim().replace(/,$/, "");
}

/* ═══════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════ */
function Section({ title, subtitle, icon: Icon, iconColor, children, collapsible, defaultOpen, count, badge, hint }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div style={{
      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, overflow: "hidden", marginBottom: 16,
    }}>
      <div
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
        style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "14px 18px", cursor: collapsible ? "pointer" : "default",
          borderBottom: (!collapsible || open) ? "1px solid rgba(255,255,255,0.04)" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
          {Icon && <Icon size={16} style={{ color: iconColor || "#d4a843", flexShrink: 0, marginTop: 2 }} />}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
            {hint && (
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "6px 0 0", display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.5 }}>
                <Info size={11} style={{ marginTop: 2, flexShrink: 0 }} /> <span>{hint}</span>
              </p>
            )}
          </div>
        </div>
        {collapsible && (open
          ? <ChevronUp size={16} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 2 }} />
          : <ChevronDown size={16} style={{ color: "rgba(255,255,255,0.3)", flexShrink: 0, marginTop: 2 }} />
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
      borderRadius: 10, padding: "14px 16px", flex: "1 1 0", minWidth: 140,
    }}>
      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: color || "rgba(255,255,255,0.92)", margin: "4px 0 0", fontFamily: "'JetBrains Mono', monospace" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MODEL-AWARE STENCIL — uses stencil-templates.js for known models,
   falls back to grouped rendering for unknown ones
   ═══════════════════════════════════════════════════════════ */
function StencilPort({ name, type, port, onClick, isSelected }) {
  const isSfp = type === "sfp";
  const color = port ? PORT_STATUS_COLOR(port) : "#374151";
  const isUp = port?.operStatus === "up";
  const hasEndpoints = port?.attachedCount > 0;
  const labelLen = name.length;
  const width = Math.max(40, Math.min(86, labelLen * 7 + 14));

  return (
    <div
      onClick={() => port && onClick?.(port)}
      title={port
        ? `${name} \u00b7 ${port.adminStatus === "down" ? "Admin Down" : (port.operStatus || "unknown").toUpperCase()}${port.speedMbps ? " \u00b7 " + fmtSpeed(port.speedMbps) : ""}${port.portIp ? " \u00b7 " + fmtIp(port.portIp) : ""}${port.connectedNeighborName ? " \u00b7 → " + port.connectedNeighborName : ""}`
        : `${name} (not detected)`}
      style={{
        minWidth: width, height: isSfp ? 22 : 32, padding: "0 8px",
        borderRadius: isSfp ? 2 : 4,
        background: isSelected ? "rgba(212,168,67,0.18)" : "rgba(0,0,0,0.5)",
        border: `2px solid ${isSelected ? "#d4a843" : color}`,
        cursor: port ? "pointer" : "default",
        opacity: port ? 1 : 0.35,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.15s",
        boxShadow: isUp ? `0 0 10px ${color}40, inset 0 0 10px ${color}15` : "none",
        position: "relative",
      }}
    >
      <span style={{
        fontSize: isSfp ? 9 : 11, fontWeight: 600,
        color: isSelected ? "#d4a843" : isUp ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: "nowrap",
      }}>{name}</span>
      {hasEndpoints && (
        <div style={{
          position: "absolute", top: -4, right: -4,
          width: 12, height: 12, borderRadius: "50%",
          background: "#d4a843",
          border: "2px solid #0a0a14",
          fontSize: 8, color: "#0a0a14", fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{port.attachedCount > 9 ? "9+" : port.attachedCount}</div>
      )}
    </div>
  );
}

function ModelStencil({ template, ports, onPortClick, selectedPort }) {
  const accentColor = template.color || "#3b82f6";

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)",
      borderRadius: 12,
      padding: "20px 24px",
      border: `1px solid ${accentColor}30`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${accentColor}10`,
    }}>
      {/* Model badge bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 22, background: accentColor, borderRadius: 2, boxShadow: `0 0 8px ${accentColor}80` }} />
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Device Model</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.95)", margin: "2px 0 0", fontWeight: 600 }}>{template.label}</p>
          </div>
        </div>
        {/* Status LEDs */}
        <div style={{ display: "flex", gap: 6 }}>
          {["PWR", "STA", "LNK"].map(led => (
            <div key={led} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
              <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{led}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Port rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 16px", background: "rgba(0,0,0,0.4)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)" }}>
        {template.rows.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {row.map((slot, si) => {
              if (slot.type === "gap") return <div key={si} style={{ width: slot.width || 16 }} />;
              const port = findPortByName(ports, slot.name);
              return (
                <StencilPort
                  key={si}
                  name={slot.name}
                  type={slot.type}
                  port={port}
                  onClick={onPortClick}
                  isSelected={selectedPort?.name === slot.name}
                />
              );
            })}
          </div>
        ))}
        {template.sfpRow && (
          <div style={{ display: "flex", gap: 6, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            {template.sfpRow.map((slot, si) => {
              const port = findPortByName(ports, slot.name);
              return (
                <StencilPort
                  key={si}
                  name={slot.name}
                  type={slot.type}
                  port={port}
                  onClick={onPortClick}
                  isSelected={selectedPort?.name === slot.name}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: "#22c55e", label: "Up" },
          { color: "#374151", label: "Down" },
          { color: "#ef4444", label: "Admin Down" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, border: `2px solid ${l.color}`, background: "rgba(0,0,0,0.5)" }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#d4a843" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Has endpoints</span>
        </div>
      </div>
    </div>
  );
}

function FallbackStencil({ ports, onPortClick, selectedPort }) {
  // Only show physical ports in the fallback stencil
  const physicalPorts = ports.filter(p =>
    p.category === "physical" || p.category === "physical_sfp"
  );
  if (physicalPorts.length === 0) {
    return (
      <div style={{
        padding: 20, textAlign: "center",
        background: "rgba(0,0,0,0.3)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.4)", fontSize: 13,
      }}>
        No physical ports detected on this device.
      </div>
    );
  }

  // Auto top/bottom split for switch-style layout
  const topRow = [];
  const bottomRow = [];
  physicalPorts.forEach((p, i) => {
    if (i % 2 === 0) topRow.push(p);
    else bottomRow.push(p);
  });

  return (
    <div style={{
      background: "rgba(0,0,0,0.4)", borderRadius: 10, padding: "16px 16px 12px",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Info size={12} style={{ color: "rgba(255,255,255,0.4)" }} />
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
          Generic stencil — model-specific layout not available for this device
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {topRow.map(p => (
            <StencilPort key={`${p.index}-${p.name}`} name={p.name || String(p.index)} type={p.category === "physical_sfp" ? "sfp" : "port"} port={p} onClick={onPortClick} isSelected={selectedPort?.index === p.index} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {bottomRow.map(p => (
            <StencilPort key={`${p.index}-${p.name}`} name={p.name || String(p.index)} type={p.category === "physical_sfp" ? "sfp" : "port"} port={p} onClick={onPortClick} isSelected={selectedPort?.index === p.index} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PORT DETAIL PANEL
   ═══════════════════════════════════════════════════════════ */
function PortDetailPanel({ port, onClose, onNavigate }) {
  if (!port) return null;

  const rows = [
    { label: "Status", value: (
      <span style={{ color: port.operStatus === "up" ? "#22c55e" : port.adminStatus === "down" ? "#ef4444" : "#6b7280", fontWeight: 600 }}>
        {port.adminStatus === "down" ? "ADMIN DOWN" : (port.operStatus || "unknown").toUpperCase()}
      </span>
    )},
    { label: "Speed", value: fmtSpeed(port.speedMbps) },
    { label: "Duplex", value: port.duplex || "\u2014" },
    { label: "Category", value: PORT_CAT[port.category]?.label || "\u2014" },
  ];
  if (port.portIp) rows.push({ label: "Port IP", value: fmtIp(port.portIp), highlight: true });
  if (port.connectedNeighborName) {
    rows.push({
      label: "Connected To",
      value: (
        <span
          onClick={() => port.connectedNeighborId && onNavigate?.(port.connectedNeighborId)}
          style={{
            cursor: port.connectedNeighborId ? "pointer" : "default",
            color: "#06b6d4", textDecoration: port.connectedNeighborId ? "underline" : "none",
          }}
        >
          {port.connectedNeighborName} {port.connectedNeighborPort ? `(${port.connectedNeighborPort})` : ""}
        </span>
      ),
      highlight: true,
    });
  }
  rows.push({ label: "In Traffic", value: fmtBytes(port.inOctets) });
  rows.push({ label: "Out Traffic", value: fmtBytes(port.outOctets) });
  rows.push({ label: "In Errors", value: String(port.inErrors || 0) });
  rows.push({ label: "Out Errors", value: String(port.outErrors || 0) });

  return (
    <div style={{
      background: "rgba(212,168,67,0.05)", border: "1px solid rgba(212,168,67,0.25)",
      borderRadius: 10, padding: 16, marginTop: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: PORT_STATUS_COLOR(port) }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#d4a843" }}>
            Port {port.name || port.index}
          </span>
          {port.attachedCount > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
              background: "rgba(34,197,94,0.12)", color: "#22c55e",
            }}>{port.attachedCount} endpoint{port.attachedCount > 1 ? "s" : ""}</span>
          )}
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.4)",
          cursor: "pointer", fontSize: 22, lineHeight: 1, padding: 0,
        }}>&times;</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px 16px" }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", padding: "6px 0",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            background: r.highlight ? "rgba(6,182,212,0.04)" : "transparent",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{r.label}</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: "'JetBrains Mono', monospace", textAlign: "right" }}>{r.value}</span>
          </div>
        ))}
      </div>
      {port.attachedEndpoints?.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Connected Endpoints
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {port.attachedEndpoints.map((ep, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: 8, padding: "8px 10px",
                background: "rgba(0,0,0,0.3)", borderRadius: 6, fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{fmtIp(ep.ip)}</span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{fmtMac(ep.mac)}</span>
                <span style={{ color: "rgba(255,255,255,0.55)", fontFamily: "inherit" }}>{ep.manufacturer || "\u2014"}</span>
                <span style={{
                  fontSize: 10, padding: "1px 6px", borderRadius: 10,
                  background: ep.connectionType === "wireless" ? "rgba(168,85,247,0.15)" : "rgba(59,130,246,0.15)",
                  color: ep.connectionType === "wireless" ? "#a855f7" : "#3b82f6",
                  fontFamily: "inherit", fontWeight: 600,
                }}>{(ep.connectionType || "wired").toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════ */
export default function DeviceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [healthRange, setHealthRange] = useState(() => TimeRangePicker.defaultRange('1h'));
  const [uptimeDays, setUptimeDays] = useState(30);
  const [uptimeData, setUptimeData] = useState(null);
  const uptimeRange = useMemo(() => ({
    from: new Date(Date.now() - uptimeDays * 86400000),
    to: new Date(),
  }), [uptimeDays]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPort, setSelectedPort] = useState(null);
  const [portSearch, setPortSearch] = useState("");
  const [portFilter, setPortFilter] = useState("physical");
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
  useEffect(() => {
    const iv = setInterval(fetchData, 60000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const filteredPorts = useMemo(() => {
    if (!data?.ports) return [];
    let list = data.ports;
    if (portFilter === "physical") list = list.filter(p => p.category === "physical" || p.category === "physical_sfp");
    else if (portFilter === "up") list = list.filter(p => p.operStatus === "up");
    else if (portFilter === "down") list = list.filter(p => p.operStatus !== "up");
    else if (portFilter === "errors") list = list.filter(p => (p.inErrors || 0) + (p.outErrors || 0) > 0);
    else if (portFilter === "with_endpoints") list = list.filter(p => p.attachedCount > 0);
    if (portSearch) {
      const q = portSearch.toLowerCase();
      list = list.filter(p =>
        (p.name || "").toLowerCase().includes(q) ||
        String(p.index).includes(q) ||
        (p.portIp || "").includes(q) ||
        (p.connectedNeighborName || "").toLowerCase().includes(q) ||
        (p.primaryEndpointIp || "").includes(q) ||
        (p.primaryEndpointMac || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.ports, portFilter, portSearch]);

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

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <RefreshCw size={24} style={{ color: "#d4a843", animation: "ddspin 1s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 12, fontSize: 14 }}>Loading device details...</p>
        <style>{`@keyframes ddspin { to { transform: rotate(360deg); } }`}</style>
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
  const isFirewall = dev.type === "firewall" || dev.type === "router";

  const infoRows = [
    { label: "Primary IP", value: fmtIp(dev.ipAddress), mono: true },
    { label: "MAC Address", value: dev.macAddress, mono: true },
    { label: "Make", value: dev.make },
    { label: "Model", value: cleanModel(dev.model) || cleanModel(dev.makeModel?.split(" ").slice(-2).join(" ")) },
    { label: "Serial Number", value: dev.serialNumber, mono: true },
    { label: "Firmware", value: dev.firmwareVersion },
    { label: "SNMP Version", value: dev.snmpVersion },
    { label: "Site", value: dev.siteName },
    { label: "Last Seen", value: timeAgo(dev.lastSeenAt) },
    { label: "First Discovered", value: dev.firstDiscovered ? new Date(dev.firstDiscovered).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null },
  ];
  if (dev.cpuPercent != null) infoRows.push({ label: "CPU Usage", value: `${dev.cpuPercent}%` });
  if (dev.memoryPercent != null) infoRows.push({ label: "Memory Usage", value: `${dev.memoryPercent}%` });

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "20px 16px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes ddspin { to { transform: rotate(360deg); } }
        .dd-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .dd-table th { text-align: left; padding: 8px 10px; color: rgba(255,255,255,0.45); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }
        .dd-table td { padding: 8px 10px; color: rgba(255,255,255,0.78); border-bottom: 1px solid rgba(255,255,255,0.04); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .dd-table tr:hover td { background: rgba(255,255,255,0.02); }
        .dd-pill { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
        .dd-filter-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); background: transparent; color: rgba(255,255,255,0.5); cursor: pointer; font-size: 12px; transition: all 0.15s; }
        .dd-filter-btn:hover { color: rgba(255,255,255,0.8); border-color: rgba(255,255,255,0.15); }
        .dd-filter-btn.active { background: rgba(212,168,67,0.15); border-color: rgba(212,168,67,0.3); color: #d4a843; }
        .dd-search { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 7px 12px 7px 32px; color: rgba(255,255,255,0.85); font-size: 13px; outline: none; width: 240px; }
        .dd-search:focus { border-color: rgba(212,168,67,0.4); }
        .dd-search::placeholder { color: rgba(255,255,255,0.25); }
        .dd-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 32px; }
        @media (max-width: 720px) { .dd-info-grid { grid-template-columns: 1fr; } }
        .dd-info-row { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04); gap: 12px; }
        .dd-info-label { font-size: 13px; color: rgba(255,255,255,0.5); flex-shrink: 0; }
        .dd-info-value { font-size: 13px; color: rgba(255,255,255,0.88); text-align: right; word-break: break-all; }
        .dd-info-value.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .dd-empty { text-align: center; padding: 32px 16px; color: rgba(255,255,255,0.35); font-size: 13px; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
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
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.95)", margin: 0 }}>{dev.name}</h1>
            <span className="dd-pill" style={{ background: st.bg, color: st.color }}>
              <CircleDot size={10} /> {st.label}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>
            {tm.label}{dev.make ? ` \u00b7 ${dev.make}` : ""}{cleanModel(dev.model) ? ` ${cleanModel(dev.model)}` : ""}{dev.siteName ? ` \u00b7 ${dev.siteName}` : ""}
          </p>
        </div>
        <button onClick={handleRefresh} style={{
          background: "rgba(212,168,67,0.1)", border: "1px solid rgba(212,168,67,0.25)",
          borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "#d4a843",
          display: "flex", alignItems: "center", gap: 6, fontSize: 13,
        }}>
          <RefreshCw size={14} style={refreshing ? { animation: "ddspin 1s linear infinite" } : {}} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="Uptime" value={dev.uptimeFormatted || "\u2014"} sub={data.uptime?.percent != null ? `${data.uptime.percent}% (${days}d)` : null} color="#22c55e" />
        {data.portStats?.physicalCount > 0 && (
          <StatCard label="Physical Ports" value={data.portStats.physicalCount} sub={`${data.portStats.physicalUp} up`} color="#3b82f6" />
        )}
        <StatCard label="Total Interfaces" value={data.portStats?.total || 0} sub={`${data.portStats?.up || 0} up \u00b7 ${data.portStats?.adminDown || 0} disabled`} color="#06b6d4" />
        <StatCard label="Endpoints" value={data.endpoints?.length || 0} sub="directly connected" color="#a855f7" />
        <StatCard label="Neighbors" value={data.neighbors?.length || 0} color="#06b6d4" />
        {data.portStats?.errors > 0 && (
          <StatCard label="Port Errors" value={data.portStats.errors} color="#ef4444" />
        )}
      </div>

      {/* ── Device Information ── */}
      <Section title="Device Information" icon={Server} iconColor={tm.color}>
        <div className="dd-info-grid">
          {infoRows.filter(r => r.value != null && r.value !== "").map((r, i) => (
            <div key={i} className="dd-info-row">
              <span className="dd-info-label">{r.label}</span>
              <span className={`dd-info-value${r.mono ? " mono" : ""}`}>{r.value}</span>
            </div>
          ))}
        </div>
        {dev.sysDescr && (
          <div style={{ marginTop: 14, padding: 12, background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.04)" }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>System Description</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", margin: 0, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>{dev.sysDescr}</p>
          </div>
        )}
      </Section>

      {/* ── Uptime History (Day 21 rebuild) ── */}
      <Section
        title="Uptime History"
        icon={Activity}
        iconColor="#14b8a6"
        subtitle={(() => {
          const c = uptimeData?.confirmedEventCount ?? 0;
          const i = uptimeData?.inferredEventCount ?? 0;
          if (c === 0 && i === 0) return `No status changes in the last ${uptimeDays} days`;
          const parts = [];
          if (c > 0) parts.push(`${c} confirmed`);
          if (i > 0) parts.push(`${i} poll-failure event${i === 1 ? '' : 's'}`);
          return `${parts.join(', ')} in the last ${uptimeDays} days`;
        })()}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>
            {uptimeData?.uptimePercent != null ? `${uptimeData.uptimePercent}%` : '—'}
          </span>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 2 }}>
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setUptimeDays(d)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  background: uptimeDays === d ? 'rgba(245,158,11,0.12)' : 'transparent',
                  color: uptimeDays === d ? '#fb923c' : 'rgba(255,255,255,0.5)',
                  transition: 'all 0.15s',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        <UptimeTimeline
          deviceId={dev.id}
          from={uptimeRange.from}
          to={uptimeRange.to}
          onData={setUptimeData}
          showHeader={false}
          height={180}
        />
      </Section>

      {/* ── Health (CPU / Memory) ── */}
      <Section title="Health" icon={HeartPulse} iconColor="#3b82f6">
        <div style={{ marginBottom: 16 }}>
          <TimeRangePicker value={healthRange} onChange={setHealthRange} />
        </div>
        <HealthChart
          deviceId={dev.id}
          from={healthRange.from}
          to={healthRange.to}
        />
      </Section>

      {/* ── Ports + Stencil + Table ── */}
      {data.ports?.length > 0 && (
        <Section
          title="Ports & Interfaces"
          icon={Cable}
          iconColor="#3b82f6"
          count={data.portStats?.physicalCount}
          hint={!data.portStats?.hasTrafficData ? "Traffic byte counters not yet available — port states are accurate, deltas will populate after the next collection cycles." : null}
        >
          <UniversalStencil device={dev} ports={data.ports} vlanCount={data.vlans?.length || 0} onPortClick={setSelectedPort} selectedPort={selectedPort} />
          {selectedPort && (
            <PortDetailPanel port={selectedPort} onClose={() => setSelectedPort(null)} onNavigate={(nid) => router.push(`/devices/${nid}`)} />
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)" }} />
              <input className="dd-search" placeholder="Search ports, IPs, neighbors..." value={portSearch} onChange={e => setPortSearch(e.target.value)} />
            </div>
            {[
              { k: "physical", l: "Physical Only" },
              { k: "all", l: "All Interfaces" },
              { k: "up", l: "Up" },
              { k: "down", l: "Down" },
              { k: "with_endpoints", l: "With Endpoints" },
              { k: "errors", l: "Errors" },
            ].map(f => (
              <button key={f.k} className={`dd-filter-btn${portFilter === f.k ? " active" : ""}`} onClick={() => setPortFilter(f.k)}>
                {f.l}
              </button>
            ))}
          </div>

          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="dd-table">
              <thead>
                <tr>
                  <th>Port</th>
                  <th>Status</th>
                  <th>Speed</th>
                  <th>Port IP</th>
                  <th>Connected To</th>
                  <th>Endpoint IP</th>
                  <th>Endpoint MAC</th>
                  {data.portStats?.hasTrafficData && <>
                    <th>In</th>
                    <th>Out</th>
                  </>}
                  <th>Errors</th>
                </tr>
              </thead>
              <tbody>
                {filteredPorts.map(p => {
                  const errs = (p.inErrors || 0) + (p.outErrors || 0);
                  return (
                    <tr key={`${p.index}-${p.name}`} onClick={() => setSelectedPort(p)} style={{ cursor: "pointer" }}>
                      <td style={{ fontWeight: 600 }}>
                        {p.name || p.index}
                        {p.attachedCount > 1 && (
                          <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "rgba(212,168,67,0.18)", color: "#d4a843" }}>+{p.attachedCount - 1}</span>
                        )}
                      </td>
                      <td>
                        <span className="dd-pill" style={{
                          background: p.operStatus === "up" ? "rgba(34,197,94,0.12)" : p.adminStatus === "down" ? "rgba(239,68,68,0.12)" : "rgba(107,114,128,0.12)",
                          color: p.operStatus === "up" ? "#22c55e" : p.adminStatus === "down" ? "#ef4444" : "#6b7280",
                        }}>
                          <CircleDot size={8} />
                          {p.adminStatus === "down" ? "ADMIN OFF" : (p.operStatus || "unknown").toUpperCase()}
                        </span>
                      </td>
                      <td>{fmtSpeed(p.speedMbps)}</td>
                      <td style={{ color: p.portIp ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)", fontWeight: p.portIsPrimary ? 600 : 400 }}>
                        {fmtIp(p.portIp)}
                        {p.portIsPrimary && <span style={{ marginLeft: 4, fontSize: 9, color: "#22c55e" }}>★</span>}
                      </td>
                      <td style={{ color: p.connectedNeighborName ? "#06b6d4" : "rgba(255,255,255,0.3)", fontFamily: "inherit", fontSize: 11 }}>
                        {p.connectedNeighborName
                          ? `${p.connectedNeighborName}${p.connectedNeighborPort ? " / " + p.connectedNeighborPort : ""}`
                          : "\u2014"}
                      </td>
                      <td style={{ color: p.primaryEndpointIp ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>
                        {fmtIp(p.primaryEndpointIp)}
                      </td>
                      <td style={{ color: p.primaryEndpointMac ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.3)", fontSize: 11 }}>
                        {fmtMac(p.primaryEndpointMac)}
                      </td>
                      {data.portStats?.hasTrafficData && <>
                        <td>{fmtBytes(p.inOctets)}</td>
                        <td>{fmtBytes(p.outOctets)}</td>
                      </>}
                      <td style={{ color: errs > 0 ? "#ef4444" : "rgba(255,255,255,0.4)" }}>{errs > 0 ? errs : "\u2014"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPorts.length === 0 && (
              <p className="dd-empty">No ports match filters</p>
            )}
          </div>
        </Section>
      )}

      {/* ── VLANs ── */}
      {data.vlans?.length > 0 && (
        <Section title="VLANs" icon={Layers} iconColor="#f59e0b" count={data.vlans.length} collapsible defaultOpen>
          <div style={{ overflowX: "auto" }}>
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
                    <td style={{ fontWeight: 700, color: "#d4a843" }}>{v.id}</td>
                    <td>{v.name || "\u2014"}</td>
                    <td style={{ maxWidth: 400, fontSize: 11, wordBreak: "break-all" }}>{v.taggedPorts || "\u2014"}</td>
                    <td style={{ fontSize: 11, wordBreak: "break-all" }}>{v.untaggedPorts || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── Neighbors ── */}
      {data.neighbors?.length > 0 && (
        <Section title="Connected Neighbors" icon={Network} iconColor="#06b6d4" count={data.neighbors.length} collapsible defaultOpen>
          <div style={{ overflowX: "auto" }}>
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
          </div>
        </Section>
      )}

      {/* ── Endpoints ── */}
      <Section
        title="Connected Endpoints"
        icon={Users}
        iconColor="#a855f7"
        count={data.endpoints?.length || 0}
        badge={{ text: "Directly Connected", color: "#a855f7", bg: "rgba(168,85,247,0.12)" }}
        hint={isFirewall && (!data.endpoints || data.endpoints.length === 0)
          ? "Firewalls don't see endpoints via L2 discovery — endpoints are visible to switches via MAC/FDB tables. Check the connected switches to see endpoints in this network."
          : "Showing only endpoints with a known IP address that are directly attached to this device."}
        collapsible
        defaultOpen
      >
        {data.endpoints?.length > 0 ? (
          <>
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
                      <td>{fmtIp(ep.ip)}</td>
                      <td style={{ fontSize: 11 }}>{fmtMac(ep.mac)}</td>
                      <td style={{ color: "rgba(255,255,255,0.65)", fontFamily: "inherit" }}>{ep.manufacturer || "Unknown"}</td>
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
              {filteredEndpoints.length === 0 && <p className="dd-empty">No endpoints match search</p>}
            </div>
          </>
        ) : (
          <p className="dd-empty">
            {isFirewall
              ? "No directly-attached endpoints (expected for firewalls)."
              : "No endpoints with known IPs are currently attached to this device."}
          </p>
        )}
      </Section>

      {/* ── IP Interfaces ── */}
      {data.interfaces?.length > 0 && (
        <Section
          title="IP Interfaces"
          icon={Globe}
          iconColor="#6366f1"
          count={data.interfaces.length}
          collapsible
          defaultOpen
        >
          <table className="dd-table">
            <thead>
              <tr>
                <th>IP Address</th>
                <th>Interface</th>
                <th>VLAN</th>
                <th>Source</th>
                <th>Primary</th>
              </tr>
            </thead>
            <tbody>
              {data.interfaces.map((iface, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: iface.isPrimary ? 600 : 400 }}>{fmtIp(iface.ipAddress)}</td>
                  <td>{iface.interfaceName || "\u2014"}</td>
                  <td>{iface.vlanId || "\u2014"}</td>
                  <td style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{iface.source || "\u2014"}</td>
                  <td>{iface.isPrimary ? "\u2705" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ── Status History ── */}
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
