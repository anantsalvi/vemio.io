/**
 * VEMIO Universal Stencil — adapts to ANY network device.
 *
 * Design principle: layout is inferred from the port data, not from a
 * hand-coded model registry. The renderer makes 4 decisions automatically:
 *
 *   1. Categorize ports (already done in API: physical, physical_sfp, etc.)
 *   2. Sort physical ports numerically when names are pure numbers / Port-N
 *   3. Split into top/bottom rows when ≥9 ports (real switch faceplate layout)
 *   4. Render SFP/fiber + trunks as separate stripes below the main rows
 *
 * Vendor info is used ONLY for the badge color/label — never for layout.
 *
 * No per-model knowledge required. Works for switches, firewalls, APs,
 * routers, servers, printers, anything with `port_name` and `category`.
 */

import React from "react";
import { Info } from "lucide-react";

/* ───────────────────────────────────────────────────────────
   Vendor accent colors (display only — no layout impact)
   ─────────────────────────────────────────────────────────── */
const VENDOR_COLORS = {
  sophos:  "#0a4d8c",
  hp:      "#0096d6",
  hpe:     "#01a982",
  aruba:   "#ff8300",
  cisco:   "#1ba0d7",
  juniper: "#84bd00",
  fortinet:"#ee3124",
  paloalto:"#fa582d",
  brother: "#1e3a8a",
  dell:    "#007db8",
  netgear: "#9b59b6",
  ubiquiti:"#00a9e0",
  mikrotik:"#293f87",
};

const PORT_STATUS_COLOR = (p) => {
  if (!p) return "#374151";
  if (p.adminStatus === "down") return "#ef4444";
  if (p.operStatus === "up") return "#22c55e";
  if (p.operStatus === "dormant") return "#f59e0b";
  return "#374151";
};

/* ───────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────── */
function cleanString(s) {
  return String(s || "").trim().replace(/,+$/, "").trim();
}

function vendorAccentColor(make) {
  const key = cleanString(make).toLowerCase().replace(/[\s-]/g, "");
  for (const k of Object.keys(VENDOR_COLORS)) {
    if (key.includes(k)) return VENDOR_COLORS[k];
  }
  return "#6366f1"; // default indigo
}

/**
 * Build a display label from make + model + port count.
 * Examples:
 *   "Sophos XGS 107 · 8 physical ports"
 *   "HP ProCurve 3500yl · 24 physical ports + 4 SFP"
 *   "Aruba AP-505 · 2 ports"
 */
function buildDeviceLabel(make, model, physicalCount, sfpCount) {
  const parts = [];
  const m = cleanString(make);
  const mod = cleanString(model);
  if (m) parts.push(m);
  if (mod) parts.push(mod);
  let label = parts.join(" ");
  if (!label) label = "Network Device";
  return label;
}

/**
 * Extract a sortable numeric key from a port name.
 * "1" → 1, "Port1" → 1, "Port 24" → 24, "1/0/3" → 30003 (slot * 10000 + port * 100 + sub)
 * "eth0" → 0, "GigabitEthernet0/1" → 1
 * Returns Infinity if no number found, so unnamed ports go to the end.
 */
function portSortKey(name) {
  if (!name) return Infinity;
  const s = String(name);

  // Slot/module notation: 1/0/3 or 1/3 → composite numeric key
  const slotMatch = s.match(/(\d+)\/(\d+)(?:\/(\d+))?$/);
  if (slotMatch) {
    const a = Number(slotMatch[1]) || 0;
    const b = Number(slotMatch[2]) || 0;
    const c = Number(slotMatch[3]) || 0;
    return a * 10000 + b * 100 + c;
  }

  // Trailing number: "Port 24", "eth0", "GigabitEthernet0", "1"
  const trailing = s.match(/(\d+)\s*$/);
  if (trailing) return Number(trailing[1]);

  return Infinity;
}

/**
 * Decide whether the row of ports should be split into top/bottom (switch
 * faceplate layout) or laid out in a single row (firewall / AP layout).
 *
 * Rule: ≥9 ports OR explicit "switch" device type → 2 rows.
 * For 2-row layout, split by EVEN/ODD position so Port1 sits above Port2,
 * Port3 above Port4, etc — matching real-world device front panels.
 */
function splitPhysicalRows(ports) {
  if (ports.length < 9) {
    return { top: ports, bottom: [] };
  }
  const top = [];
  const bottom = [];
  ports.forEach((p, i) => {
    if (i % 2 === 0) top.push(p);
    else bottom.push(p);
  });
  return { top, bottom };
}

/* ───────────────────────────────────────────────────────────
   PortBox — single port chip in the stencil
   ─────────────────────────────────────────────────────────── */
function PortBox({ port, onClick, isSelected, variant = "default" }) {
  const color = PORT_STATUS_COLOR(port);
  const isUp = port?.operStatus === "up";
  const hasEndpoints = port?.attachedCount > 0;
  const label = port?.name || String(port?.index || "?");

  const isSfp = variant === "sfp";
  const labelLen = label.length;
  const width = Math.max(40, Math.min(110, labelLen * 7 + 16));
  const height = isSfp ? 22 : 30;

  return (
    <div
      onClick={() => onClick?.(port)}
      title={port
        ? `${label} \u00b7 ${port.adminStatus === "down" ? "Admin Down" : (port.operStatus || "unknown").toUpperCase()}${port.speedMbps ? " \u00b7 " + (port.speedMbps >= 1000 ? port.speedMbps/1000 + " Gbps" : port.speedMbps + " Mbps") : ""}${port.portIp ? " \u00b7 " + port.portIp : ""}${hasEndpoints ? " \u00b7 " + port.attachedCount + " endpoint(s)" : ""}`
        : label}
      style={{
        minWidth: width, height, padding: "0 8px",
        borderRadius: isSfp ? 2 : 4,
        background: isSelected ? "rgba(212,168,67,0.2)" : "rgba(0,0,0,0.5)",
        border: `2px solid ${isSelected ? "#d4a843" : color}`,
        cursor: "pointer",
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
      }}>{label}</span>
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

/* ───────────────────────────────────────────────────────────
   UniversalStencil — main renderer
   ─────────────────────────────────────────────────────────── */
export function UniversalStencil({ device, ports, onPortClick, selectedPort }) {
  if (!ports || ports.length === 0) {
    return (
      <div style={{
        padding: 32, textAlign: "center",
        background: "rgba(0,0,0,0.4)", borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.4)", fontSize: 13,
      }}>
        No ports detected on this device.
      </div>
    );
  }

  const make = cleanString(device?.make);
  const model = cleanString(device?.model);
  const accent = vendorAccentColor(make);

  // Dedup ports by name (collector sometimes returns duplicates)
  const seen = new Set();
  const dedupedPorts = ports.filter(p => {
    const key = `${p.name}|${p.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group by category
  const physical = dedupedPorts.filter(p => p.category === "physical");
  const sfp      = dedupedPorts.filter(p => p.category === "physical_sfp");
  const trunks   = dedupedPorts.filter(p => p.category === "trunk");

  // Sort physical and SFP by extracted port number
  const sortedPhysical = [...physical].sort((a, b) =>
    portSortKey(a.name || a.index) - portSortKey(b.name || b.index)
  );
  const sortedSfp = [...sfp].sort((a, b) =>
    portSortKey(a.name || a.index) - portSortKey(b.name || b.index)
  );

  // Decide top/bottom split for physical
  const { top, bottom } = splitPhysicalRows(sortedPhysical);

  const totalShown = sortedPhysical.length + sortedSfp.length + trunks.length;
  const label = buildDeviceLabel(make, model, sortedPhysical.length, sortedSfp.length);

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 100%)",
      borderRadius: 12,
      padding: "20px 24px",
      border: `1px solid ${accent}30`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px ${accent}10`,
    }}>
      {/* ── Model label bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 22, background: accent, borderRadius: 2, boxShadow: `0 0 8px ${accent}80` }} />
          <div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: 1 }}>Device</p>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.95)", margin: "2px 0 0", fontWeight: 600 }}>{label}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["PWR", "STA", "LNK"].map(led => (
              <div key={led} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
                <span style={{ fontSize: 8, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace" }}>{led}</span>
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", padding: "3px 8px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {sortedPhysical.length} physical{sortedSfp.length > 0 ? ` · ${sortedSfp.length} SFP` : ""}{trunks.length > 0 ? ` · ${trunks.length} trunk` : ""}
          </span>
        </div>
      </div>

      {/* ── Faceplate ── */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 8,
        padding: "14px 18px",
        background: "rgba(0,0,0,0.5)", borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {/* Physical ports */}
        {sortedPhysical.length === 0 && sortedSfp.length === 0 && trunks.length === 0 && (
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0, textAlign: "center", padding: "10px 0" }}>
            No physical, SFP, or trunk ports on this device — check the table below for virtual interfaces.
          </p>
        )}

        {top.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {top.map(p => (
              <PortBox
                key={`top-${p.index}-${p.name}`}
                port={p}
                onClick={onPortClick}
                isSelected={selectedPort?.index === p.index}
              />
            ))}
          </div>
        )}
        {bottom.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {bottom.map(p => (
              <PortBox
                key={`bot-${p.index}-${p.name}`}
                port={p}
                onClick={onPortClick}
                isSelected={selectedPort?.index === p.index}
              />
            ))}
          </div>
        )}

        {/* SFP / fiber row */}
        {sortedSfp.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>SFP / Fiber</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {sortedSfp.map(p => (
                <PortBox
                  key={`sfp-${p.index}-${p.name}`}
                  port={p}
                  onClick={onPortClick}
                  isSelected={selectedPort?.index === p.index}
                  variant="sfp"
                />
              ))}
            </div>
          </div>
        )}

        {/* Trunks (link aggregations) */}
        {trunks.length > 0 && (
          <div style={{ marginTop: 6, paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.1)" }}>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>Trunks / LAG</p>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {trunks.map(p => (
                <PortBox
                  key={`trk-${p.index}-${p.name}`}
                  port={p}
                  onClick={onPortClick}
                  isSelected={selectedPort?.index === p.index}
                  variant="sfp"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { color: "#22c55e", label: "Up" },
          { color: "#374151", label: "Down" },
          { color: "#ef4444", label: "Admin Down" },
          { color: "#f59e0b", label: "Dormant" },
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

/* ───────────────────────────────────────────────────────────
   Compatibility shims — keep these so the existing page code
   that imports findStencilTemplate / findPortByName still works
   without changes. Both return null/undefined to signal that
   the universal renderer should be used.
   ─────────────────────────────────────────────────────────── */
export function findStencilTemplate() {
  // Always return null — the page will fall through to the universal renderer
  return null;
}

export function findPortByName(ports, name) {
  if (!ports || !name) return null;
  return ports.find(p =>
    p.name === name ||
    String(p.index) === name ||
    (p.name && p.name.toLowerCase() === name.toLowerCase())
  ) || null;
}

/* ───────────────────────────────────────────────────────────
   Firmware parser — extracts vendor-specific version strings
   from sysDescr text. Used by the Device Information section.
   ─────────────────────────────────────────────────────────── */
export function parseFirmware(sysDescr, make) {
  if (!sysDescr) return null;
  const s = String(sysDescr);
  const m = String(make || "").toLowerCase();

  // Aruba ArubaOS — "ArubaOS (MODEL: 505), Version 8.10.0.19-8.10.0.19 LSR"
  if (m.includes("aruba")) {
    const match = s.match(/Version\s+([\d.]+(?:-[\d.]+)?)/i);
    if (match) return `ArubaOS ${match[1].split("-")[0]}`;
  }

  // HP / HPE — "revision K.16.02.0036" or "Firmware Version 2.7.0.0001"
  if (m === "hp" || m === "hpe") {
    const rev = s.match(/revision\s+([A-Z]\.\d+\.\d+\.\d+)/i);
    if (rev) return rev[1];
    const fw = s.match(/Firmware\s+(?:Version\s+)?([\d.]+)/i);
    if (fw) return fw[1];
    const ver = s.match(/Version\s+([\d.]+)/i);
    if (ver) return ver[1];
  }

  // Sophos / Linux kernel — "Linux localhost 6.6.49 #1 SMP ..."
  if (m.includes("sophos") || /linux/i.test(s)) {
    const match = s.match(/Linux\s+\S+\s+([\d.]+)/i);
    if (match) return `Linux ${match[1]}`;
  }

  // Brother / generic — "Brother NC-... Firmware Ver.1.04 ..."
  if (m.includes("brother")) {
    const match = s.match(/Ver\.?\s*([\d.]+)/i);
    if (match) return `Ver. ${match[1]}`;
  }

  // Generic fallback
  const generic = s.match(/Version\s+([\d.]+(?:[-.][\w\d]+)?)/i);
  if (generic) return generic[1];

  return null;
}
