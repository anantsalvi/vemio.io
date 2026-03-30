'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getStencilTemplate,
  matchPortsToStencil,
  PORT_TYPE_STYLES,
  PORT_STATUS_COLORS,
  isPhysicalPort,
} from './stencilRegistry';

/**
 * DeviceStencil — SVG hardware front-panel rendering
 *
 * Props:
 *   device   — { make, model, type, name, status }
 *   ports    — Array from /api/devices/[id]/ports
 *   onPortSelect — (port) => void  (when a port is clicked)
 *   selectedPort — currently selected port name
 */
export default function DeviceStencil({ device, ports = [], onPortSelect, selectedPort }) {
  const [hoveredPort, setHoveredPort] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const svgRef = useRef(null);

  // Filter out virtual/software interfaces (BR0, bond0, wifi0, vlan100, lo, etc.)
  // Only physical ports should appear on the hardware stencil drawing
  const stencilPorts = useMemo(
    () => ports.filter(isPhysicalPort),
    [ports]
  );

  const stencil = useMemo(
    () => getStencilTemplate(device?.make, device?.model, device?.type, stencilPorts),
    [device?.make, device?.model, device?.type, stencilPorts]
  );

  const portMap = useMemo(
    () => matchPortsToStencil(stencil, stencilPorts),
    [stencil, stencilPorts]
  );

const handlePortHover = useCallback((e, portDef) => {
  setTooltipPos({
    x: e.clientX,
    y: e.clientY - 10,
  });
  setHoveredPort(portDef);
}, []);
  if (!device) return null;

  const matchedCount = portMap.size;
  const totalPorts = stencil.groups.reduce((s, g) => s + g.ports.length, 0);

  // Calculate responsive viewBox — add padding
  const vbW = stencil.width + 20;
  const vbH = stencil.height + 30;

  return (
    <div className="ds-root">
      {/* Stencil header */}
      <div className="ds-header">
        <div className="ds-header-left">
          <span className="ds-model-tag">{stencil.label}</span>
          {!stencil.isEmpty && (
            <span className="ds-match-info">
              {matchedCount}/{totalPorts} ports matched
            </span>
          )}
        </div>
        <div className="ds-legend">
          <span className="ds-legend-item">
            <span className="ds-legend-dot" style={{ background: '#22c55e' }} />
            Online
          </span>
          <span className="ds-legend-item">
            <span className="ds-legend-dot" style={{ background: '#374151', border: '1px solid #4b5563' }} />
            Offline
          </span>
          <span className="ds-legend-item">
            <span className="ds-legend-dot" style={{ background: '#3b82f6' }} />
            Connected
          </span>
        </div>
      </div>

      {/* SVG stencil */}
      <div className="ds-svg-wrap" ref={svgRef}>
        <svg
          viewBox={`-10 -10 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="ds-svg"
        >
          <defs>
            {/* Subtle chassis gradient */}
            <linearGradient id="chassis-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(30,32,38,1)" />
              <stop offset="100%" stopColor="rgba(20,22,28,1)" />
            </linearGradient>
            {/* Port glow filter */}
            <filter id="port-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Selected port highlight */}
            <filter id="port-selected" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Chassis body */}
          <rect
            x={stencil.chassis.x}
            y={stencil.chassis.y}
            width={stencil.chassis.w}
            height={stencil.chassis.h}
            rx={stencil.chassis.rx}
            fill="url(#chassis-grad)"
            stroke="rgba(55,65,81,0.6)"
            strokeWidth="1.5"
          />

          {/* Chassis ventilation pattern (subtle) */}
          {Array.from({ length: 3 }, (_, i) => (
            <line
              key={`vent-${i}`}
              x1={stencil.chassis.w - 30 + i * 8}
              y1={stencil.chassis.y + 25}
              x2={stencil.chassis.w - 30 + i * 8}
              y2={stencil.chassis.h - 10}
              stroke="rgba(55,65,81,0.3)"
              strokeWidth="1"
              strokeDasharray="3,5"
            />
          ))}

          {/* Brand label */}
          {stencil.brandLabel && (
            <text
              x={stencil.brandLabel.x}
              y={stencil.brandLabel.y}
              fontSize={stencil.brandLabel.size}
              fill="rgba(148,163,184,0.35)"
              fontWeight="700"
              letterSpacing="0.1em"
              fontFamily="system-ui, sans-serif"
            >
              {stencil.brandLabel.text}
            </text>
          )}

          {/* Port groups */}
          {stencil.groups.map((group, gi) => (
            <g key={gi}>
              {group.ports.map((portDef, pi) => {
                const matchedPort = portMap.get(portDef.name);
                const status = matchedPort?.status || 'unknown';
                const statusCfg = PORT_STATUS_COLORS[status] || PORT_STATUS_COLORS.unknown;
                const typeCfg = PORT_TYPE_STYLES[portDef.type] || PORT_TYPE_STYLES.rj45;
                const isHovered = hoveredPort?.name === portDef.name;
                const isSelected = selectedPort === portDef.name;
                const hasConnection = matchedPort?.hasConnection;

                // Port fill logic:
                // - Online + connected = bright green
                // - Online + no connection = dim green
                // - Offline/disabled = dark
                // - No match = very dark (unmapped)
                let fillColor = 'rgba(30,32,38,0.8)';
                let strokeColor = 'rgba(55,65,81,0.4)';

                if (matchedPort) {
                  if (status === 'online') {
                    fillColor = hasConnection ? '#22c55e22' : '#22c55e10';
                    strokeColor = hasConnection ? '#22c55e' : '#22c55e60';
                  } else if (status === 'offline' || status === 'disabled') {
                    fillColor = 'rgba(25,28,34,0.9)';
                    strokeColor = 'rgba(55,65,81,0.5)';
                  } else if (status === 'testing') {
                    fillColor = '#f59e0b15';
                    strokeColor = '#f59e0b80';
                  }
                }

                // Override for SFP/SFP+ ports — use type-specific accent
                if ((portDef.type === 'sfp' || portDef.type === 'sfp+') && matchedPort && status === 'online') {
                  strokeColor = portDef.type === 'sfp+' ? '#F97316' : '#8B5CF6';
                  fillColor = portDef.type === 'sfp+' ? '#F9731618' : '#8B5CF618';
                }

                return (
                  <g
                    key={`${gi}-${pi}`}
                    onMouseEnter={(e) => handlePortHover(e, { ...portDef, matchedPort })}
                    onMouseMove={(e) => handlePortHover(e, { ...portDef, matchedPort })}
                    onMouseLeave={() => setHoveredPort(null)}
                    onClick={() => onPortSelect?.(portDef.name)}
                    cursor="pointer"
                  >
                    {/* Port body */}
                    <rect
                      x={portDef.x}
                      y={portDef.y}
                      width={portDef.w}
                      height={portDef.h}
                      rx={portDef.type === 'sfp' || portDef.type === 'sfp+' ? 2 : 1.5}
                      fill={fillColor}
                      stroke={isSelected ? '#FBBF24' : isHovered ? '#94a3b8' : strokeColor}
                      strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 1}
                      filter={isSelected ? 'url(#port-selected)' : undefined}
                      style={{ transition: 'fill 0.15s, stroke 0.15s, stroke-width 0.15s' }}
                    />

                    {/* Online indicator LED — tiny dot in top-left of port */}
                    {matchedPort && status === 'online' && (
                      <circle
                        cx={portDef.x + 3}
                        cy={portDef.y + 3}
                        r={1.5}
                        fill="#22c55e"
                        filter="url(#port-glow)"
                      />
                    )}

                    {/* Connection indicator — small blue dot bottom-right */}
                    {matchedPort && hasConnection && (
                      <circle
                        cx={portDef.x + portDef.w - 3}
                        cy={portDef.y + portDef.h - 3}
                        r={1.5}
                        fill="#3b82f6"
                      />
                    )}

                    {/* Port label — above for top-row, below for bottom-row */}
<text
  x={portDef.x + portDef.w / 2}
  y={group.ports.some(p => p.x === portDef.x && p.y > portDef.y)
    ? portDef.y - 4
    : portDef.y + portDef.h + 8}
  textAnchor="middle"
  fontSize={portDef.w < 15 ? 4.5 : 5.5}
  fill="rgba(148,163,184,0.4)"
  fontFamily="system-ui, sans-serif"
  fontWeight="500"
>
  {portDef.name}
</text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredPort && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="ds-tooltip"
              style={{
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="ds-tooltip-name">{hoveredPort.name}</div>
              {hoveredPort.matchedPort ? (
                <>
                  <div className="ds-tooltip-row">
                    <span className="ds-tooltip-label">Interface</span>
                    <span className="ds-tooltip-value ds-tooltip-mono">
                      {hoveredPort.matchedPort.name}
                    </span>
                  </div>
                  <div className="ds-tooltip-row">
                    <span className="ds-tooltip-label">Status</span>
                    <span
                      className="ds-tooltip-status"
                      style={{
                        color: (PORT_STATUS_COLORS[hoveredPort.matchedPort.status] || PORT_STATUS_COLORS.unknown).fill === '#374151'
                          ? '#6b7280'
                          : (PORT_STATUS_COLORS[hoveredPort.matchedPort.status] || PORT_STATUS_COLORS.unknown).fill,
                      }}
                    >
                      {hoveredPort.matchedPort.status || 'unknown'}
                    </span>
                  </div>
                  {hoveredPort.matchedPort.speed > 0 && (
                    <div className="ds-tooltip-row">
                      <span className="ds-tooltip-label">Speed</span>
                      <span className="ds-tooltip-value">
                        {formatSpeed(hoveredPort.matchedPort.speed)}
                      </span>
                    </div>
                  )}
                  {hoveredPort.matchedPort.mediaType && (
                    <div className="ds-tooltip-row">
                      <span className="ds-tooltip-label">Media</span>
                      <span className="ds-tooltip-value" style={{ textTransform: 'capitalize' }}>
                        {hoveredPort.matchedPort.mediaType}
                      </span>
                    </div>
                  )}
                  {hoveredPort.matchedPort.neighbors?.length > 0 && (
                    <div className="ds-tooltip-row">
                      <span className="ds-tooltip-label">Connected to</span>
                      <span className="ds-tooltip-value ds-tooltip-connected">
                        {hoveredPort.matchedPort.neighbors[0].name}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="ds-tooltip-unmapped">No data mapped</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Empty state for devices with no ports */}
      {stencil.isEmpty && (
        <div className="ds-empty">
          No port layout template available for this device.
          Port data will show in the table below.
        </div>
      )}

      <style>{`
        .ds-root {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .ds-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
        }
        .ds-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ds-model-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-vemio-text-muted);
          background: var(--color-vemio-surface-raised);
          padding: 3px 10px;
          border-radius: 6px;
          letter-spacing: 0.03em;
        }
        .ds-match-info {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
        }

        .ds-legend {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .ds-legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--color-vemio-text-dim);
        }
        .ds-legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ds-svg-wrap {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(10, 12, 16, 0.5);
          border: 1px solid rgba(55, 65, 81, 0.25);
          padding: 12px 8px;
        }
        .ds-svg {
          width: 100%;
          height: auto;
          max-height: 160px;
          display: block;
        }

       .ds-tooltip {
  position: fixed;
  z-index: 9999;
          pointer-events: none;
          background: var(--color-vemio-bg);
          border: 1px solid var(--color-vemio-border);
          border-radius: 10px;
          padding: 10px 14px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          min-width: 160px;
          max-width: 240px;
        }
        .ds-tooltip-name {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-vemio-text);
          margin-bottom: 6px;
          padding-bottom: 5px;
          border-bottom: 1px solid var(--color-vemio-border);
        }
        .ds-tooltip-row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          padding: 2px 0;
        }
        .ds-tooltip-label {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
        }
        .ds-tooltip-value {
          font-size: 10px;
          color: var(--color-vemio-text-muted);
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ds-tooltip-mono {
          font-family: monospace;
          font-size: 9px;
        }
        .ds-tooltip-status {
          font-size: 10px;
          font-weight: 600;
          text-transform: capitalize;
        }
        .ds-tooltip-connected {
          color: #3b82f6;
          font-weight: 500;
        }
        .ds-tooltip-unmapped {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          font-style: italic;
        }

        .ds-empty {
          text-align: center;
          padding: 20px;
          font-size: 12px;
          color: var(--color-vemio-text-dim);
          background: rgba(107,114,128,0.05);
          border-radius: 10px;
        }

        @media (max-width: 479px) {
          .ds-header { flex-direction: column; align-items: flex-start; }
          .ds-legend { gap: 8px; }
          .ds-svg { max-height: 120px; }
        }
      `}</style>
    </div>
  );
}

function formatSpeed(bps) {
  if (!bps || bps <= 0) return '—';
  if (bps >= 10000000000) return `${bps / 1000000000}G`;
  if (bps >= 1000000000) return `${bps / 1000000000}G`;
  if (bps >= 1000000) return `${bps / 1000000}M`;
  if (bps >= 1000) return `${bps / 1000}K`;
  return `${bps}`;
}