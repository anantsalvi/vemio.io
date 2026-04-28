"use client";

/* ============================================================================
 * stencil-templates.js  (v2 — luminous glow + square tiles)
 * ----------------------------------------------------------------------------
 * Drop-in replacement preserving the public API:
 *   - export function UniversalStencil({ device, ports, onPortClick, selectedPort })
 *   - export function parseFirmware(makeModel)
 *
 * Visual changes from v1:
 *   - Port tiles are now 40x40 square (was 32x26)
 *   - Active tiles use SVG feGaussianBlur filter for a luminous halo
 *   - Bright pale-green corner indicator dot (#86efac, 2.2px radius)
 *   - Thin vendor-coloured accent stripe under the brand text
 *   - Ventilation grille rendered as fine vertical lines, not chunky bars
 *   - Layout reserves SFP space only when SFPs are present
 *   - Chassis height grew to 170px to accommodate larger square tiles
 * ============================================================================ */

import React, { useMemo } from "react";

/* ---------------------------------------------------------------------------
 * parseFirmware — preserved from v1
 * ------------------------------------------------------------------------- */
export function parseFirmware(makeModel) {
  if (!makeModel || typeof makeModel !== "string") return null;
  const s = makeModel;

  let m = s.match(/Version\s+([\d.()A-Za-z-]+?)(?:[,\s]|$)/i);
  if (m) return m[1].replace(/[,]+$/, "");

  m = s.match(/Version[:\s]+([\d.]+(?:\s*MR-?\d+)?)/i);
  if (m) return m[1].trim();

  m = s.match(/\b(?:PV[OS]*[._\s]+)?([VR]?\.?\s*\d+(?:\.\d+)+[A-Za-z0-9.-]*)/);
  if (m) return m[1].replace(/^[VR]\.?\s*/, "").trim();

  m = s.match(/\b\d+\.\d+(?:\.\d+){0,2}\b/);
  if (m) return m[0];

  return null;
}

/* ---------------------------------------------------------------------------
 * Vendor accent colours
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
 * Port classification + sorting
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

    const numMatch = String(name).match(/(\d+)\s*$/);
    const displayNumber = numMatch ? parseInt(numMatch[1], 10) : idx + 1;

    const isSfp = cat === "physical_sfp" || /^(sfp|portf|gi.*sfp|te|xg|fortyG)/i.test(name);

    return { ...p, name, displayNumber, statusKind, _isSfp: isSfp, _ord: idx };
  });

  const physical = enriched.filter(
    (p) =>
      p.category === "physical" ||
      p.category === "physical_sfp" ||
      p._isSfp ||
      (!p.category && !/^(lo|tun|ipsec|vlan|br|dummy)/i.test(p.name))
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
 * Layout maths — square tiles auto-sized by port count
 * ------------------------------------------------------------------------- */
function computeLayout(copperCount, availableWidth) {
  const cols = Math.max(1, Math.ceil(copperCount / 2));
  const groupGapCount = Math.max(0, Math.floor((cols - 1) / 4));

  let portSize, colGap, groupGap;
  if (cols <= 4) {
    portSize = 40;
    colGap = 8;
    groupGap = 16;
  } else if (cols <= 12) {
    portSize = 36;
    colGap = 4;
    groupGap = 12;
  } else if (cols <= 18) {
    portSize = 28;
    colGap = 3;
    groupGap = 10;
  } else {
    portSize = 18;
    colGap = 2;
    groupGap = 8;
  }

  const widthFor = (size) =>
    cols * size + (cols - 1) * colGap + groupGapCount * groupGap;
  while (widthFor(portSize) > availableWidth && portSize > 12) {
    portSize -= 1;
  }

  const totalWidth = widthFor(portSize);

  return {
    columns: cols,
    portW: portSize,
    portH: portSize,
    colGap,
    groupGap,
    rowGap: 10,
    totalWidth,
  };
}

function colX(i, layout) {
  const groupOffsets = Math.floor(i / 4) * layout.groupGap;
  return i * (layout.portW + layout.colGap) + groupOffsets;
}

/* ---------------------------------------------------------------------------
 * PortTile — uses activeGlow filter when lit
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
  filterId,
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
  const strokeWidth = status === "active" || status === "error" ? 1.2 : 0.5;

  const useFilter = (status === "active" || status === "error") && filterId;

  return (
    <g
      style={{ cursor: port && onClick ? "pointer" : "default" }}
      onClick={port && onClick ? () => onClick(port) : undefined}
    >
      {useFilter ? (
        <g filter={`url(#${filterId})`}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={4}
            fill={fill}
            stroke={isSelected ? "#60a5fa" : stroke}
            strokeWidth={isSelected ? 1.6 : strokeWidth}
          />
        </g>
      ) : (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          rx={4}
          fill={fill}
          stroke={isSelected ? "#60a5fa" : stroke}
          strokeWidth={isSelected ? 1.6 : strokeWidth}
        />
      )}
      {(status === "active" || status === "error") && (
        <circle
          cx={x + 6}
          cy={y + 6}
          r={2.2}
          fill={status === "active" ? "#86efac" : "#fbbf24"}
        />
      )}
      {variant === "sfp" && label && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 3}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize="10"
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

function EmptyTile({ x, y, width, height }) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      fill="#0d1117"
      stroke="#3a4250"
      strokeWidth={0.5}
      opacity={0.3}
    />
  );
}

/* ---------------------------------------------------------------------------
 * UniversalStencil
 * ------------------------------------------------------------------------- */
export function UniversalStencil({
  device,
  ports,
  onPortClick,
  selectedPort,
}) {
  const { copper, sfp } = useMemo(() => classifyAndSplit(ports), [ports]);

  const hasAnyPhysical = copper.length + sfp.length > 0;

  const sfpCount = sfp.length;
  const sfpBlockWidth =
    sfpCount === 0 ? 0 : sfpCount <= 2 ? 60 : sfpCount <= 4 ? 130 : 220;
  const leftReserve = 96;
  const rightReserve = 32;
  const sfpPadding = sfpCount > 0 ? 24 : 0;
  const portsAvailable =
    668 - leftReserve - rightReserve - sfpPadding - sfpBlockWidth;

  const layout = useMemo(
    () => computeLayout(copper.length, portsAvailable),
    [copper.length, portsAvailable]
  );

  const selectedKey =
    selectedPort?.port_index ?? selectedPort?.port_name ?? selectedPort?.name;

  const isSelected = (p) =>
    selectedKey != null &&
    (p.port_index === selectedKey ||
      p.port_name === selectedKey ||
      p.name === selectedKey);

  const chassisH = 170;
  const portsTopY = 60;
  const topRowY = portsTopY + 8;
  const botRowY = topRowY + layout.portH + layout.rowGap;
  const evenLabelY = botRowY + layout.portH + 14;

  const conSize = layout.portW;
  const conX = 28;
  const conY = topRowY;
  const conLabelY = botRowY + conSize + 14;

  const accent = vendorAccent(device?.make);
  const brand = (
    [device?.make, device?.model].filter(Boolean).join(" ") || "UNKNOWN DEVICE"
  )
    .toString()
    .toUpperCase();

  const blockTotalWidth = layout.totalWidth + sfpPadding + sfpBlockWidth;
  const blockStartX =
    leftReserve +
    Math.max(
      0,
      (668 - leftReserve - rightReserve - blockTotalWidth) / 2
    );
  const sfpBlockX = blockStartX + layout.totalWidth + sfpPadding;

  const stripeWidth = Math.min(220, brand.length * 8.5);

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

        <defs>
          <filter id="activeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x={6}
          y={10}
          width={668}
          height={chassisH - 20}
          rx={8}
          fill="#141923"
          stroke="#0a0d12"
          strokeWidth={0.5}
        />
        <rect
          x={10}
          y={14}
          width={660}
          height={chassisH - 28}
          rx={6}
          fill="none"
          stroke="#3a4250"
          strokeWidth={0.5}
          opacity={0.5}
        />

        <text
          x={28}
          y={42}
          fontFamily="Arial, sans-serif"
          fontSize={14}
          fontWeight={400}
          fill="#cfd6e0"
          letterSpacing={2}
        >
          {brand}
        </text>
        <rect
          x={28}
          y={48}
          width={stripeWidth}
          height={1}
          fill={accent}
          opacity={0.7}
        />

        <rect
          x={conX}
          y={conY}
          width={conSize}
          height={conSize}
          rx={4}
          fill="#0d1117"
          stroke="#3a4250"
          strokeWidth={0.5}
        />
        <text
          x={conX + conSize / 2}
          y={conLabelY}
          textAnchor="middle"
          fontFamily="Arial, sans-serif"
          fontSize={10}
          fill="#7a8390"
          letterSpacing={0.5}
        >
          CON
        </text>

        {hasAnyPhysical && copper.length > 0 && (
          <g transform={`translate(${blockStartX}, 0)`}>
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
                  fontSize={10}
                  fill="#7a8390"
                >
                  {port.displayNumber}
                </text>
              );
            })}

            {Array.from({ length: layout.columns }).map((_, i) => {
              const port = copper[i * 2];
              const x = colX(i, layout);
              if (!port)
                return (
                  <EmptyTile
                    key={`top-empty-${i}`}
                    x={x}
                    y={topRowY}
                    width={layout.portW}
                    height={layout.portH}
                  />
                );
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
                  filterId="activeGlow"
                />
              );
            })}

            {Array.from({ length: layout.columns }).map((_, i) => {
              const port = copper[i * 2 + 1];
              const x = colX(i, layout);
              if (!port)
                return (
                  <EmptyTile
                    key={`bot-empty-${i}`}
                    x={x}
                    y={botRowY}
                    width={layout.portW}
                    height={layout.portH}
                  />
                );
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
                  filterId="activeGlow"
                />
              );
            })}

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
                  fontSize={10}
                  fill="#7a8390"
                >
                  {port.displayNumber}
                </text>
              );
            })}
          </g>
        )}

        {sfpCount > 0 && (
          <g transform={`translate(${sfpBlockX}, 0)`}>
            {sfp.map((p, idx) => {
              const sfpW = sfpCount <= 2 ? 56 : 50;
              const sfpH = layout.portH;
              const isOddIdx = idx % 2 === 0;
              const col = Math.floor(idx / 2);
              const x = col * (sfpW + 8) + (isOddIdx ? 0 : (sfpW + 8) / 2);
              const y = isOddIdx ? topRowY : botRowY;
              const labelY = isOddIdx ? portsTopY : evenLabelY;
              return (
                <g key={`sfp-${idx}`}>
                  <text
                    x={x + sfpW / 2}
                    y={labelY}
                    textAnchor="middle"
                    fontFamily="Arial, sans-serif"
                    fontSize={10}
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
                    filterId="activeGlow"
                  />
                </g>
              );
            })}
          </g>
        )}

        <g
          transform={`translate(640, ${topRowY + 8})`}
          stroke="#3a4250"
          strokeWidth={0.5}
          fill="none"
        >
          <line x1={0} y1={0} x2={0} y2={24} />
          <line x1={4} y1={0} x2={4} y2={24} />
          <line x1={8} y1={0} x2={8} y2={24} />
          <line x1={12} y1={0} x2={12} y2={24} />
        </g>

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

      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          marginTop: "8px",
          paddingLeft: "28px",
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
