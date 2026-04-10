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
  // STENCIL-TARGETMATCH-APR10: rounded square tile with thick glow matching locked target
  const color = PORT_STATUS_COLOR(port);
  const isUp = port?.operStatus === "up";
  const isAdminDown = port?.adminStatus === "down";
  const hasEndpoints = port?.attachedCount > 0;
  const label = port?.name || String(port?.index || "?");

  const isSfp = variant === "sfp";
  const width = isSfp ? 42 : 36;
  const height = isSfp ? 30 : 34;

  const inRate = Number(port?.inRateMbps) || 0;
  const outRate = Number(port?.outRateMbps) || 0;
  const totalRate = inRate + outRate;
  const trafficPct = Math.min(100, Math.round(totalRate));
  const showTraffic = isUp && totalRate > 0.01;

  const speedLabel = port?.speedMbps
    ? (port.speedMbps >= 1000 ? (port.speedMbps / 1000) + " Gbps" : port.speedMbps + " Mbps")
    : "";

  const tooltipParts = [
    label,
    isAdminDown ? "Admin Down" : (port?.operStatus || "unknown").toUpperCase(),
  ];
  if (speedLabel) tooltipParts.push(speedLabel);
  if (showTraffic) tooltipParts.push("In " + inRate.toFixed(1) + " / Out " + outRate.toFixed(1) + " Mbps");
  if (port?.portIp) tooltipParts.push(port.portIp);
  if (hasEndpoints) tooltipParts.push(port.attachedCount + " endpoint" + (port.attachedCount > 1 ? "s" : ""));
  if (port?.connectedNeighborName) tooltipParts.push("\u2192 " + port.connectedNeighborName);

  // Strong visual weight for up ports — LED-like inner glow + thick border
  const tileBg = isSelected
    ? "rgba(212,168,67,0.22)"
    : isUp
      ? "rgba(34,197,94,0.22)"
      : isAdminDown
        ? "rgba(239,68,68,0.15)"
        : "rgba(20,25,40,0.55)";

  const tileBorder = isSelected ? "#d4a843" : color;
  // STENCIL-LAYOUTV2-APR10: stronger LED-like glow
  const tileGlow = isUp
    ? "0 0 18px " + color + "a0, inset 0 0 14px " + color + "70, 0 0 4px " + color
    : isAdminDown
      ? "0 0 8px " + color + "60, inset 0 0 6px " + color + "40"
      : "none";

  return (
    <div
      onClick={() => onClick?.(port)}
      title={tooltipParts.join(" \u00b7 ")}
      style={{
        width: width,
        height: height,
        padding: 0,
        borderRadius: 6,
        background: tileBg,
        border: "2.5px solid " + tileBorder,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.15s",
        boxShadow: tileGlow,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span style={{
        fontSize: isSfp ? 11 : 12,
        fontWeight: 700,
        color: isSelected
          ? "#d4a843"
          : isUp
            ? "#ffffff"
            : isAdminDown
              ? "#fca5a5"
              : "rgba(255,255,255,0.5)",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        whiteSpace: "nowrap",
        lineHeight: 1,
        textShadow: isUp ? "0 0 4px " + color + "80" : "none",
      }}>{label}</span>

      {showTraffic && (
        <div style={{
          width: "75%",
          height: 2,
          marginTop: 3,
          background: "rgba(0,0,0,0.4)",
          borderRadius: 1,
          overflow: "hidden",
        }}>
          <div style={{
            width: trafficPct + "%",
            height: "100%",
            background: trafficPct > 70 ? "#f59e0b" : "#3b82f6",
            transition: "width 0.3s",
          }} />
        </div>
      )}

      {hasEndpoints && (
        <div style={{
          position: "absolute",
          top: -6,
          right: -6,
          minWidth: 14,
          height: 14,
          padding: "0 3px",
          borderRadius: 7,
          background: "#d4a843",
          border: "2px solid #0a0e1a",
          fontSize: 9,
          color: "#0a0e1a",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          lineHeight: 1,
        }}>{port.attachedCount > 9 ? "9+" : port.attachedCount}</div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   parseDeviceTopology — STENCIL-PARSETOPO-APR10
   Extracts port topology from makeModel string (vendor-agnostic).
   Returns { copperPorts, sfpPorts, poeBudgetWatts, hasPoE, confidence }
   ─────────────────────────────────────────────────────────── */
function parseDeviceTopology(makeModel, model) {
  const result = {
    copperPorts: 0,
    sfpPorts: 0,
    poeBudgetWatts: 0,
    hasPoE: false,
    confidence: "none",
  };

  const combined = [makeModel, model].filter(Boolean).join(" ");
  if (!combined) return result;
  const s = combined.toLowerCase();

  // Copper port count: "24p", "24-port", "24 port", "24G" (but not "24 GHz")
  const copperMatch = s.match(/(\d+)\s*(?:p(?![a-z])|port|-port)/);
  if (copperMatch) {
    result.copperPorts = parseInt(copperMatch[1], 10);
    result.confidence = "partial";
  } else {
    // Fallback: "24G" where G = Gigabit (HPE Instant On, HP ProCurve naming)
    const gMatch = s.match(/(\d+)g[- ]/);
    if (gMatch) {
      result.copperPorts = parseInt(gMatch[1], 10);
      result.confidence = "partial";
    }
  }

  // SFP port count: "2p SFP", "4 SFP", "2x SFP+"
  const sfpMatch = s.match(/(\d+)\s*(?:p|x|-port)?\s*sfp/);
  if (sfpMatch) {
    result.sfpPorts = parseInt(sfpMatch[1], 10);
    if (result.confidence === "partial") result.confidence = "high";
  }

  // PoE budget in watts: "195W", "195 W", "370W"
  const poeMatch = s.match(/(\d+)\s*w(?:[^a-z]|$)/);
  if (poeMatch) {
    const watts = parseInt(poeMatch[1], 10);
    if (watts >= 30 && watts <= 2000) {
      result.poeBudgetWatts = watts;
      result.hasPoE = true;
    }
  }

  // PoE hint from other markers
  if (/poe/.test(s)) result.hasPoE = true;

  return result;
}

/* ───────────────────────────────────────────────────────────
   UniversalStencil — main renderer (STENCIL-V2-APR07)
   ─────────────────────────────────────────────────────────── */
export function UniversalStencil({ device, ports, vlanCount, onPortClick, selectedPort }) {
  if (!ports || ports.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: "center",
        background: "rgba(0,0,0,0.4)",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.4)",
        fontSize: 13,
      }}>
        No ports detected on this device.
      </div>
    );
  }

  const make = cleanString(device?.make);
  const model = cleanString(device?.model);
  const accent = vendorAccentColor(make);

  // STENCIL-PARSETOPO-APR10: parse topology from SNMP make_model string
  const topology = parseDeviceTopology(device?.makeModel, device?.model);

  const seen = new Set();
  const dedupedPorts = ports.filter(p => {
    const key = (p.name || "") + "|" + p.index;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const physical = dedupedPorts.filter(p => p.category === "physical");
  const sfp      = dedupedPorts.filter(p => p.category === "physical_sfp");
  const trunks   = dedupedPorts.filter(p => p.category === "trunk");

  const sortedPhysical = [...physical].sort((a, b) =>
    portSortKey(a.name || a.index) - portSortKey(b.name || b.index)
  );
  const sortedSfp = [...sfp].sort((a, b) =>
    portSortKey(a.name || a.index) - portSortKey(b.name || b.index)
  );

  const { top, bottom } = splitPhysicalRows(sortedPhysical);
  const label = buildDeviceLabel(make, model, sortedPhysical.length, sortedSfp.length);

  // Aggregate stats — STENCIL-DATAFIX-APR07: count only rendered ports, not virtual interfaces
  const renderedPorts = [...sortedPhysical, ...sortedSfp, ...trunks];
  const upCount = renderedPorts.filter(p => p.operStatus === "up").length;
  const totalCount = renderedPorts.length;
  const utilizationPct = totalCount > 0 ? Math.round((upCount / totalCount) * 100) : 0;
  const totalIn = renderedPorts.reduce((s, p) => s + (Number(p.inRateMbps) || 0), 0);
  const totalOut = renderedPorts.reduce((s, p) => s + (Number(p.outRateMbps) || 0), 0);
  const totalThroughput = totalIn + totalOut;
  const endpointPortCount = renderedPorts.filter(p => p.attachedCount > 0).length;

  // LED states based on real data
  const ledPwr = "#22c55e"; // always on if device responds
  const ledSta = upCount > 0 ? "#22c55e" : "#f59e0b";
  const ledLnk = totalThroughput > 0.1 ? "#22c55e" : "#374151";

  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(15,20,32,0.95) 0%, rgba(10,14,26,0.98) 100%)",
      borderRadius: 12,
      padding: "20px 24px",
      border: "1px solid " + accent + "30",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px " + accent + "10",
    }}>
      {/* STENCIL-LAYOUTV2-APR10: device header + legend moved to top */}
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 12,
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "rgba(96,165,250,0.15)",
            border: "1px solid rgba(96,165,250,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}>
            <div style={{
              width: 16,
              height: 12,
              border: "1.5px solid #60a5fa",
              borderRadius: 2,
            }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: "rgba(255,255,255,0.98)",
              lineHeight: 1.2,
            }}>{device?.name || label}</div>
            <div style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.55)",
              marginTop: 3,
              lineHeight: 1.4,
            }}>
              {(() => {
                const parts = [];
                if (device?.type) {
                  parts.push(device.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));
                }
                if (make) parts.push(make + (model ? " " + model : ""));
                if (device?.ipAddress) parts.push(String(device.ipAddress).replace("/32", ""));
                if (device?.siteName) parts.push(device.siteName);
                return parts.join(" \u00b7 ");
              })()}
            </div>
            <div style={{
              display: "flex",
              gap: 14,
              marginTop: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}>
              {[
                { color: "#22c55e", label: "Up" },
                { color: "#374151", label: "Down" },
                { color: "#ef4444", label: "Admin down" },
                { color: "#f59e0b", label: "Dormant" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 11,
                    height: 11,
                    borderRadius: 3,
                    border: "2px solid " + l.color,
                    background: "rgba(0,0,0,0.4)",
                  }} />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* STENCIL-MOVELEDS-APR10: LEDs moved into grey faceplate bar below */}
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            padding: "4px 10px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {sortedPhysical.length} physical{sortedSfp.length > 0 ? " \u00b7 " + sortedSfp.length + " SFP" : ""}{trunks.length > 0 ? " \u00b7 " + trunks.length + " trunk" : ""}
          </span>
        </div>
      </div>

      {/* Faceplate body */}
      <div style={{
        display: "flex",
        gap: 14,
        padding: "16px 18px",
        background: "linear-gradient(180deg, #1a2030 0%, #141926 100%)",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.08)",
        overflowX: "auto",
        alignItems: "center",
      }}>
        {/* Brand strip */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingRight: 14,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: 0.4,
            fontFamily: "'JetBrains Mono', monospace",
          }}>{make || "DEVICE"}</div>
          <div style={{
            fontSize: 8,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: 0.2,
            fontFamily: "'JetBrains Mono', monospace",
          }}>{model || ""}</div>
          <div style={{
            width: 22,
            height: 16,
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 2,
            background: "rgba(0,0,0,0.4)",
            marginTop: 6,
          }} title="Console port" />
        </div>

        {/* Physical port grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
          {sortedPhysical.length === 0 && sortedSfp.length === 0 && trunks.length === 0 && (
            <p style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              margin: 0,
              textAlign: "center",
              padding: "10px 20px",
            }}>
              No physical, SFP, or trunk ports — see table below for virtual interfaces.
            </p>
          )}

          {top.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              {top.map(p => (
                <PortBox
                  key={"top-" + p.index + "-" + p.name}
                  port={p}
                  onClick={onPortClick}
                  isSelected={selectedPort?.index === p.index}
                />
              ))}
            </div>
          )}
          {bottom.length > 0 && (
            <div style={{ display: "flex", gap: 4 }}>
              {bottom.map(p => (
                <PortBox
                  key={"bot-" + p.index + "-" + p.name}
                  port={p}
                  onClick={onPortClick}
                  isSelected={selectedPort?.index === p.index}
                />
              ))}
            </div>
          )}
        </div>

        {/* SFP / fiber section */}
        {sortedSfp.length > 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingLeft: 14,
            borderLeft: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 2,
            }}>SFP / Fiber</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 200 }}>
              {sortedSfp.map(p => (
                <PortBox
                  key={"sfp-" + p.index + "-" + p.name}
                  port={p}
                  onClick={onPortClick}
                  isSelected={selectedPort?.index === p.index}
                  variant="sfp"
                />
              ))}
            </div>
          </div>
        )}

        {/* Trunks section */}
        {trunks.length > 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingLeft: 14,
            borderLeft: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
          }}>
            <div style={{
              fontSize: 8,
              color: "rgba(255,255,255,0.4)",
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: 2,
            }}>Trunks / LAG</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 160 }}>
              {trunks.map(p => (
                <PortBox
                  key={"trk-" + p.index + "-" + p.name}
                  port={p}
                  onClick={onPortClick}
                  isSelected={selectedPort?.index === p.index}
                  variant="sfp"
                />
              ))}
            </div>
          </div>
        )}
        {/* LEDs anchored to the right of the port grid */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          paddingLeft: 14,
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          flexShrink: 0,
        }}>
          {[
            { name: "PWR", color: ledPwr },
            { name: "STA", color: ledSta },
            { name: "FAN", color: ledPwr },
            { name: "TMP", color: ledPwr },
          ].map(led => (
            <div key={led.name} style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: led.color,
                boxShadow: "0 0 6px " + led.color + "a0",
              }} />
              <span style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.55)",
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: 0.3,
              }}>{led.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div>
          <div style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 4,
            fontWeight: 600,
          }}>Total ports</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>{totalCount}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            {sortedPhysical.length} copper{sortedSfp.length > 0 ? " \u00b7 " + sortedSfp.length + " SFP" : ""}
          </div>
        </div>
        <div>
          <div style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 4,
            fontWeight: 600,
          }}>Up</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "#22c55e" }}>{upCount}</div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{utilizationPct}% utilization</div>
        </div>
        <div>
          {/* STENCIL-TARGETMATCH-APR10: PoE card when data exists, Active VLANs fallback */}
          {(() => {
            const poeDraw = Number(device?.poeDrawWatts) || 0;
            // STENCIL-PARSETOPO-APR10: use parsed budget from makeModel as fallback
            const poeBudget = Number(device?.poeBudgetWatts) || topology.poeBudgetWatts || 0;
            const hasPoE = poeBudget > 0;
            if (hasPoE) {
              const pct = Math.round((poeDraw / poeBudget) * 100);
              return (
                <>
                  <div style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 4,
                    fontWeight: 600,
                  }}>PoE Budget</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#f59e0b" }}>{poeDraw}W</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                    of {poeBudget}W ({pct}%)
                  </div>
                </>
              );
            }
            return (
              <>
                <div style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  marginBottom: 4,
                  fontWeight: 600,
                }}>Active VLANs</div>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#d4a843" }}>{vlanCount || 0}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  {endpointPortCount} ports with endpoints
                </div>
              </>
            );
          })()}
        </div>
        <div>
          <div style={{
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            letterSpacing: 0.5,
            marginBottom: 4,
            fontWeight: 600,
          }}>Throughput</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: "rgba(255,255,255,0.95)" }}>
            {totalThroughput >= 1000 ? (totalThroughput / 1000).toFixed(1) + " Gbps" : totalThroughput.toFixed(1) + " Mbps"}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
            in {totalIn.toFixed(1)} / out {totalOut.toFixed(1)}
          </div>
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
