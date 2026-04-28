"use client";

/* ============================================================================
 * stencil-templates.js
 * ----------------------------------------------------------------------------
 * Universal device stencil renderer — clean dark-chassis style.
 * Drop-in replacement preserving the existing public API:
 *   - export function UniversalStencil({ device, ports, onPortClick, selectedPort })
 *   - export function parseFirmware(makeModel)
 *
 * The renderer adapts to any device by reading port count and SFP count
 * from the `ports` array — no per-model hand-curation required.
 *
 * Visual model matches the agreed reference:
 *   - Dark slate chassis with rounded corners and subtle inner bezel
 *   - Brand text upper-left:  "<MAKE> <MODEL>"
 *   - Square CON button on the left, label "CON" below the button
 *   - Two rows of physical (RJ45) ports, grouped in fours by spacing
 *   - Odd port numbers above the top row, even numbers below the bottom row
 *   - Active ports = filled with dark green tint, bright green border,
 *     plus a small bright-green dot in the top-left corner
 *   - SFP cages on the right, staggered (1/3 top, 2/4 bottom for 4 SFPs)
 *   - Small ventilation grille on far right edge
 * ============================================================================ */

import React, { useMemo } from "react";

/* ---------------------------------------------------------------------------
 * parseFirmware — preserved from previous version of this file.
 * Extracts a clean firmware/version string from the noisy SNMP sysDescr / make_model
 * field. Used by page.jsx for the firmware badge.
 * ------------------------------------------------------------------------- */
export function parseFirmware(makeModel) {
  if (!makeModel || typeof makeModel !== "string") return null;
  const s = makeModel;

  // Cisco IOS:  "... Version 15.2(7)E14, RELEASE SOFTWARE ..."
  let m = s.match(/Version\s+([\d.()A-Za-z-]+?)(?:[,\s]|$)/i);
  if (m) return m[1].replace(/[,]+$/, "");

  // Sophos:  "Version: 19.5.4 MR-4"
  m = s.match(/Version[:\s]+([\d.]+(?:\s*MR-?\d+)?)/i);
  if (m) return m[1].trim();

  // Aruba / HPE:  "PVOS_3.x.x.x" or "PV V.16.10.0023"
  m = s.match(/\b(?:PV[OS]*[._\s]+)?([VR]?\.?\s*\d+(?:\.\d+)+[A-Za-z0-9.-]*)/);
  if (m) return m[1].replace(/^[VR]\.?\s*/, "").trim();

  // Generic semver-ish:  "1.2.3" or "1.2.3.4"
  m = s.match(/\b\d+\.\d+(?:\.\d+){0,2}\b/);
  if (m) return m[0];

  return null;
}

/* ---------------------------------------------------------------------------
 * Vendor accent colours — small lookup, used only for the brand-text underline
 * stripe on the chassis. Falls back to a neutral grey when make is unknown.
 * ------------------------------------------------------------------------- */
const VENDOR_COLOURS = {
  cisco: "#1ba0d7",
  sophos: "#0a4d8c",
  hp: "#0096d6",
  hpe: "#01a982",
  aruba: "#ff8300",
  brother: "#1d428a",
  meraki: "#67b346",
  fortinet: "#ee3124",
  ubiquiti: "#0559c9",
  juniper: "#84b135",
  netgear: "#27569e",
  dlink: "#0072ce",
};

function vendorAccent(make) {
  if (!make) return "#5a6470";
  const key = String(make).toLowerCase().replace(/[^a-z]/g, "");
  for (const k of Object.keys(VENDOR_COLOURS)) {
    if (key.includes(k)) return VENDOR_COLOURS[k];
  }
  return "#5a6470";
}

/* ---------------------------------------------------------------------------
 * Port classification + sorting.
 *
 * We accept either the collector-shape (oper_status / admin_status / port_name /
 * port_index / category) or the older Auvik-shape (status / name).  The API
 * already normalises most of this into `category`, but we tolerate both.
 *
 * Returns:
 *   { copper: [Port, ...], sfp: [Port, ...] }
 * Each Port is augmented with { displayNumber, statusKind } where statusKind is:
 *   'active'    — link up (oper=up)
 *   'inactive'  — admin up but no link (oper=down, admin=up)
 *   'disabled'  — admin down
 *   'error'     — has errors (in_errors > 0 or out_errors > 0) — shown amber
 * ------------------------------------------------------------------------- */
function classifyAndSplit(ports) {
  if (!Array.isArray(ports) || ports.length === 0) {
    return { copper: [], sfp: [] };
  }

  const enriched = ports.map((p, idx) => {
    const name = p.port_name ?? p.name ?? "";
    const oper = (p.oper_status ?? p.status ?? "").toString().toLowerCase();
    const admin = (p.admin_status ?? "up").toString().toLowerCase();
    const inErr = Number(p.in_errors) || 0;
    const outErr = Number(p.out_errors) || 0;
    const cat = p.category ?? "physical";

    let statusKind = "disabled";
    if (admin === "down") statusKind = "disabled";
    else if (oper === "up" || oper === "connected" || oper === "online") statusKind = "active";
    else statusKind = "inactive";
    if (statusKind === "active" && (inErr > 0 || outErr > 0)) statusKind = "error";

    // Pull a display number from the name. Pure numeric → that. Named like "Port3"
    // or "GigabitEthernet0/3" → trailing integer. Otherwise fall back to ordinal.
    const numMatch = String(name).match(/(\d+)\s*$/);
    const displayNumber = numMatch ? parseInt(numMatch[1], 10) : idx + 1;

    const isSfp = cat === "physical_sfp" || /^(sfp|portf|gi.*sfp|te|xg|fortyG)/i.test(name);

    return { ...p, name, displayNumber, statusKind, _isSfp: isSfp, _ord: idx };
  });

  // Only physical ports go in the chassis. Virtual/loopback/tunnel are excluded
  // from the visual stencil entirely (they still appear in the table below).
  const physical = enriched.filter(
    (p) => p.category === "physical" || p.category === "physical_sfp" || p._isSfp || (!p.category && !/^(lo|tun|ipsec|vlan|br|dummy)/i.test(p.name))
  );

  const copper = physical
    .filter((p) => !p._isSfp)
    .sort((a, b) => a.displayNumber - b.displayNumber);
  const sfp = physical
    .filter((p) => p._isSfp)
    .sort((a, b) => a.displayNumber - b.displayNumber);

  return { copper, sfp };
}

/* ---------------------------------------------------------------------------
 * Layout maths.
 *
 * For N copper ports we lay them out in two rows. The first row holds the
 * odd-indexed ports (1, 3, 5...), the second row holds the even-indexed ports
 * (2, 4, 6...). Every group of 4 columns gets an extra horizontal gap.
 *
 * Returns:
 *   { columns, portW, portH, colGap, groupGap, rowGap, totalWidth }
 *
 * Auto-sizes by port count so 8/24/48 all fit in the available width without
 * the need for a horizontal scrollbar.
 * ------------------------------------------------------------------------- */
function computeLayout(copperCount, availableWidth) {
  const cols = Math.max(1, Math.ceil(copperCount / 2));
  // total width budget for the port grid
  const W = availableWidth;
  // group every 4 columns, so the number of inter-group gaps is floor((cols-1)/4)
  const groupGapCount = Math.max(0, Math.floor((cols - 1) / 4));
  // we want roughly: cols*portW + (cols-1)*colGap + groupGapCount*extraGroupGap = W
  // pick portW based on density
  let portW, colGap, groupGap;
  if (cols <= 4) {
    portW = 36;
    colGap = 6;
    groupGap = 14;
  } else if (cols <= 12) {
    portW = 32;
    colGap = 4;
    groupGap = 12;
  } else if (cols <= 18) {
    portW = 24;
    colGap = 3;
    groupGap = 10;
  } else {
    portW = 16;
    colGap = 2;
    groupGap = 8;
  }

  const totalWidth =
    cols * portW + (cols - 1) * colGap + groupGapCount * groupGap;

  return {
    columns: cols,
    portW,
    portH: 26,
    colGap,
    groupGap,
    rowGap: 12, // vertical gap between top row and bottom row
    totalWidth,
  };
}

/* ---------------------------------------------------------------------------
 * X-coordinate of the i-th column (0-indexed) within the port grid.
 * ------------------------------------------------------------------------- */
function colX(i, layout) {
  const groupOffsets = Math.floor(i / 4) * layout.groupGap;
  return i * (layout.portW + layout.colGap) + groupOffsets;
}

/* ---------------------------------------------------------------------------
 * Port tile — single rendering primitive used for both copper and SFP ports.
 * Variant 'copper' is square-ish, variant 'sfp' is wider.
 * ------------------------------------------------------------------------- */
function PortTile({
  port,
  x,
  y,
  width,
  height,
  variant,
  label,
  onClick,
  isSelected,
}) {
  const status = port?.statusKind ?? "disabled";
  const fill =
    status === "active"
      ? "#0a3d2c"
      : status === "error"
      ? "#3a2a0a"
      : "#0d1117";
  const stroke =
    status === "active"
      ? "#22c55e"
      : status === "error"
      ? "#f59e0b"
      : "#3a4250";
  const strokeWidth = status === "active" || status === "error" ? 1 : 0.5;

  return (
    <g
      style={{ cursor: port ? "pointer" : "default" }}
      onClick={port && onClick ? () => onClick(port) : undefined}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill={fill}
        stroke={isSelected ? "#60a5fa" : stroke}
        strokeWidth={isSelected ? 1.5 : strokeWidth}
      />
      {/* corner indicator dot for active/error ports */}
      {(status === "active" || status === "error") && (
        <circle
          cx={x + 5}
          cy={y + 5}
          r={1.8}
          fill={status === "active" ? "#4ade80" : "#fbbf24"}
        />
      )}
      {/* SFP-style label sits inside the wider tile */}
      {variant === "sfp" && label && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 3}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="9"
          fill="#7a8390"
          letterSpacing="0.3"
          style={{ pointerEvents: "none" }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/* ---------------------------------------------------------------------------
 * Empty placeholder tile — drawn when a row has fewer ports than the column
 * count (odd total). Same shape as a port but with no port reference.
 * ------------------------------------------------------------------------- */
function EmptyTile({ x, y, width, height }) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={3}
      fill="#0d1117"
      stroke="#3a4250"
      strokeWidth={0.5}
      opacity={0.3}
    />
  );
}

/* ---------------------------------------------------------------------------
 * UniversalStencil — main exported component.
 *
 * Props:
 *   device       — { make, model, ... } (only make/model are read here)
 *   ports        — array of port records from /api/devices/[id]/ports or .../detail
 *   onPortClick  — optional (port) => void; called when the user clicks a port tile
 *   selectedPort — optional currently-selected port (for highlight ring)
 * ------------------------------------------------------------------------- */
export function UniversalStencil({
  device,
  ports,
  onPortClick,
  selectedPort,
}) {
  const { copper, sfp } = useMemo(() => classifyAndSplit(ports), [ports]);

  // No physical ports? Render a compact empty-state chassis with just the brand.
  const hasAnyPhysical = copper.length + sfp.length > 0;

  // Layout budget: chassis is 668px wide. Reserve 50px left brand area + 50px
  // CON button block + 24px right padding + SFP block width.
  const sfpCount = sfp.length;
  const sfpBlockWidth = sfpCount === 0 ? 0 : sfpCount <= 2 ? 56 : sfpCount <= 4 ? 110 : 200;
  const leftReserve = 76; // brand + CON
  const rightReserve = 24; // far-right ventilation + padding
  const sfpPadding = sfpCount > 0 ? 18 : 0;
  const portsAvailable = 668 - leftReserve - rightReserve - sfpPadding - sfpBlockWidth;

  const layout = useMemo(
    () => computeLayout(copper.length, portsAvailable),
    [copper.length, portsAvailable]
  );

  // selectedPort identity check — selectedPort might be a full port record OR
  // just a port_index / name. We compare on port_index then port_name.
  const selectedKey =
    selectedPort?.port_index ?? selectedPort?.port_name ?? selectedPort?.name;

  const isSelected = (p) =>
    selectedKey != null &&
    (p.port_index === selectedKey || p.port_name === selectedKey || p.name === selectedKey);

  // Geometry constants
  const chassisH = 150;
  const portsTopY = 50; // Y of the odd-number labels
  const topRowY = portsTopY + 5; // top row of port tiles starts here
  const botRowY = topRowY + layout.portH + layout.rowGap;
  const evenLabelY = botRowY + layout.portH + 12; // even-number labels below bottom row

  const accent = vendorAccent(device?.make);
  const brand = (
    [device?.make, device?.model].filter(Boolean).join(" ") || "UNKNOWN DEVICE"
  )
    .toString()
    .toUpperCase();

  // Where the SFP block starts horizontally
  const sfpBlockX = leftReserve + layout.totalWidth + sfpPadding;

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg
        width="100%"
        viewBox={`0 0 680 ${chassisH}`}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        style={{ display: "block" }}
      >
        <title>{brand} stencil</title>
        <desc>
          {`Network device chassis with ${copper.length} copper ports and ${sfp.length} SFP ports`}
        </desc>

        {/* chassis */}
        <rect
          x={6}
          y={10}
          width={668}
          height={chassisH - 20}
          rx={6}
          fill="#1a1f28"
          stroke="#0a0d12"
          strokeWidth={0.5}
        />
        <rect
          x={10}
          y={14}
          width={660}
          height={chassisH - 28}
          rx={4}
          fill="none"
          stroke="#3a4250"
          strokeWidth={0.5}
          opacity={0.6}
        />

        {/* brand + accent stripe */}
        <text
          x={22}
          y={34}
          fontFamily="Arial, sans-serif"
          fontSize={13}
          fontWeight={400}
          fill="#a8b0bc"
          letterSpacing={1.5}
        >
          {brand}
        </text>
        <rect x={22} y={38} width={120} height={1.5} fill={accent} opacity={0.7} />

        {/* CON button + label below */}
        <rect
          x={22}
          y={55}
          width={32}
          height={32}
          rx={3}
          fill="#0d1117"
          stroke="#3a4250"
          strokeWidth={0.5}
        />
        <text
          x={38}
          y={103}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize={9}
          fill="#7a8390"
          letterSpacing={0.5}
        >
          CON
        </text>

        {/* port grid */}
        {hasAnyPhysical && (
          <g transform={`translate(${leftReserve}, 0)`}>
            {/* odd-number labels above top row */}
            {Array.from({ length: layout.columns }).map((_, i) => {
              const port = copper[i * 2];
              if (!port) return null;
              return (
                <text
                  key={`top-label-${i}`}
                  x={colX(i, layout) + layout.portW / 2}
                  y={portsTopY}
                  textAnchor="middle"
                  fontFamily="Arial, sans-serif"
                  fontSize={9}
                  fill="#7a8390"
                >
                  {port.displayNumber}
                </text>
              );
            })}

            {/* top row of tiles */}
            {Array.from({ length: layout.columns }).map((_, i) => {
              const port = copper[i * 2];
              const x = colX(i, layout);
              if (!port) return <EmptyTile key={`top-empty-${i}`} x={x} y={topRowY} width={layout.portW} height={layout.portH} />;
              return (
                <PortTile
                  key={`top-${i}`}
                  port={port}
                  x={x}
                  y={topRowY}
                  width={layout.portW}
                  height={layout.portH}
                  variant="copper"
                  onClick={onPortClick}
                  isSelected={isSelected(port)}
                />
              );
            })}

            {/* bottom row of tiles */}
            {Array.from({ length: layout.columns }).map((_, i) => {
              const port = copper[i * 2 + 1];
              const x = colX(i, layout);
              if (!port) return <EmptyTile key={`bot-empty-${i}`} x={x} y={botRowY} width={layout.portW} height={layout.portH} />;
              return (
                <PortTile
                  key={`bot-${i}`}
                  port={port}
                  x={x}
                  y={botRowY}
                  width={layout.portW}
                  height={layout.portH}
                  variant="copper"
                  onClick={onPortClick}
                  isSelected={isSelected(port)}
                />
              );
            })}

            {/* even-number labels below bottom row */}
            {Array.from({ length: layout.columns }).map((_, i) => {
              const port = copper[i * 2 + 1];
              if (!port) return null;
              return (
                <text
                  key={`bot-label-${i}`}
                  x={colX(i, layout) + layout.portW / 2}
                  y={evenLabelY}
                  textAnchor="middle"
                  fontFamily="Arial, sans-serif"
                  fontSize={9}
                  fill="#7a8390"
                >
                  {port.displayNumber}
                </text>
              );
            })}
          </g>
        )}

        {/* SFP block — staggered: 1/3 top, 2/4 bottom for 4 SFPs.
            For 1 SFP: single slot, top row.
            For 2 SFPs: stacked vertically.
            For 3+: staggered grid. */}
        {sfpCount > 0 && (
          <g transform={`translate(${sfpBlockX}, 0)`}>
            {sfp.map((p, idx) => {
              const sfpW = sfpCount <= 2 ? 50 : 44;
              const sfpH = layout.portH;
              const isOdd = idx % 2 === 0;
              const col = Math.floor(idx / 2);
              const x = col * (sfpW + 8) + (isOdd ? 0 : (sfpW + 8) / 2);
              const y = isOdd ? topRowY : botRowY;
              const labelY = isOdd ? portsTopY : evenLabelY;
              return (
                <g key={`sfp-${idx}`}>
                  <text
                    x={x + sfpW / 2}
                    y={labelY}
                    textAnchor="middle"
                    fontFamily="Arial, sans-serif"
                    fontSize={9}
                    fill="#7a8390"
                  >
                    SFP+{p.displayNumber || idx + 1}
                  </text>
                  <PortTile
                    port={p}
                    x={x}
                    y={y}
                    width={sfpW}
                    height={sfpH}
                    variant="sfp"
                    onClick={onPortClick}
                    isSelected={isSelected(p)}
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* far-right ventilation grille */}
        <g transform="translate(636, 60)" fill="#3a4250">
          <rect x={0} y={0} width={2} height={20} />
          <rect x={6} y={0} width={2} height={20} />
          <rect x={12} y={0} width={2} height={20} />
          <rect x={18} y={0} width={2} height={20} />
        </g>

        {/* empty-state hint */}
        {!hasAnyPhysical && (
          <text
            x={340}
            y={chassisH / 2 + 4}
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontSize={11}
            fill="#7a8390"
          >
            No physical ports reported for this device
          </text>
        )}
      </svg>

      {/* compact legend, sits just below the chassis */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          marginTop: "8px",
          paddingLeft: "22px",
          fontSize: "11px",
          color: "#7a8390",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <LegendDot fill="#0a3d2c" stroke="#22c55e" label="Connected" />
        <LegendDot fill="#3a2a0a" stroke="#f59e0b" label="Errors" />
        <LegendDot fill="#0d1117" stroke="#3a4250" label="Idle / disabled" />
      </div>
    </div>
  );
}

function LegendDot({ fill, stroke, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <svg width={14} height={11} viewBox="0 0 14 11">
        <rect
          x={0.5}
          y={0.5}
          width={13}
          height={10}
          rx={2}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.8}
        />
      </svg>
      {label}
    </span>
  );
}

export default UniversalStencil;
