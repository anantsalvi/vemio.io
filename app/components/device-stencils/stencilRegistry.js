/**
 * VEMIO™ — Device Stencil Registry
 *
 * Maps device make+model to a hardware-accurate front-panel port layout.
 * Each template defines port groups (sections of the front panel),
 * and each port within a group has a position, label, type, and
 * a list of possible interface name patterns (for matching Auvik data).
 *
 * Port types: 'rj45' | 'sfp' | 'sfp+' | 'console' | 'usb' | 'ha' | 'mgmt'
 *
 * STENCIL DIMENSIONS:
 * All stencils use a viewBox with height ~80 (1U rack unit proportional).
 * Width varies by port density. Coordinates are SVG units.
 */

// ═══════════════════════════════════════════════
// FortiGate 120G / 121G
// Front panel (L→R): USB | HA | MGMT | Port1-16 (GE RJ45) | X1-X4 (10G SFP+) | Port17-24 (GE SFP)
// ═══════════════════════════════════════════════
const FORTIGATE_120G = {
  id: 'fortigate-120g',
  label: 'FortiGate 120G',
  width: 720,
  height: 80,
  chassis: { x: 0, y: 0, w: 720, h: 80, rx: 6 },
  brandLabel: { text: 'FORTIGATE 120G', x: 12, y: 16, size: 8 },
  groups: [
    {
      label: 'MGMT',
      ports: [
        { name: 'USB', x: 20, y: 28, w: 14, h: 18, type: 'usb', patterns: ['usb'] },
        { name: 'HA', x: 40, y: 28, w: 16, h: 14, type: 'ha', patterns: ['ha', 'ha1'] },
        { name: 'MGMT', x: 40, y: 46, w: 16, h: 14, type: 'mgmt', patterns: ['mgmt', 'management'] },
      ],
    },
    {
      label: '1 GE RJ45 (1–16)',
      ports: Array.from({ length: 16 }, (_, i) => {
        const col = Math.floor(i / 2);
        const row = i % 2;
        return {
          name: `${i + 1}`,
          x: 72 + col * 26,
          y: 28 + row * 16,
          w: 16,
          h: 14,
          type: 'rj45',
          patterns: [`port${i + 1}`, `internal${i + 1}`, `${i + 1}`],
        };
      }),
    },
    {
      label: '10G SFP+ (X1–X4)',
      ports: Array.from({ length: 4 }, (_, i) => {
        const row = i % 2;
        const col = Math.floor(i / 2);
        return {
          name: `X${i + 1}`,
          x: 290 + col * 28,
          y: 28 + row * 16,
          w: 18,
          h: 14,
          type: 'sfp+',
          patterns: [`x${i + 1}`, `sfp+${i + 1}`],
        };
      }),
    },
    {
      label: '1 GE SFP (17–24)',
      ports: Array.from({ length: 8 }, (_, i) => {
        const col = Math.floor(i / 2);
        const row = i % 2;
        return {
          name: `${i + 17}`,
          x: 360 + col * 28,
          y: 28 + row * 16,
          w: 18,
          h: 14,
          type: 'sfp',
          patterns: [`port${i + 17}`, `${i + 17}`],
        };
      }),
    },
  ],
};

// ═══════════════════════════════════════════════
// FortiGate 70F / 71F
// Front panel: USB | WAN1 | WAN2 | 1-5 (internal) | A | B | DMZ
// ═══════════════════════════════════════════════
const FORTIGATE_70F = {
  id: 'fortigate-70f',
  label: 'FortiGate 70F',
  width: 380,
  height: 80,
  chassis: { x: 0, y: 0, w: 380, h: 80, rx: 6 },
  brandLabel: { text: 'FORTIGATE 70F', x: 12, y: 16, size: 8 },
  groups: [
    {
      label: 'MGMT',
      ports: [
        { name: 'USB', x: 20, y: 32, w: 14, h: 18, type: 'usb', patterns: ['usb'] },
      ],
    },
    {
      label: 'WAN',
      ports: [
        { name: 'WAN1', x: 48, y: 28, w: 16, h: 14, type: 'rj45', patterns: ['wan1'] },
        { name: 'WAN2', x: 48, y: 46, w: 16, h: 14, type: 'rj45', patterns: ['wan2'] },
      ],
    },
    {
      label: 'Internal (1–5)',
      ports: Array.from({ length: 5 }, (_, i) => ({
        name: `${i + 1}`,
        x: 82 + i * 24,
        y: 28 + (i % 2) * 18,
        w: 16,
        h: 14,
        type: 'rj45',
        patterns: [`internal${i + 1}`, `port${i + 1}`, `${i + 1}`],
      })),
    },
    {
      label: 'FortiLink',
      ports: [
        { name: 'A', x: 210, y: 28, w: 16, h: 14, type: 'rj45', patterns: ['a', 'fortilink-a'] },
        { name: 'B', x: 210, y: 46, w: 16, h: 14, type: 'rj45', patterns: ['b', 'fortilink-b'] },
      ],
    },
    {
      label: 'DMZ',
      ports: [
        { name: 'DMZ', x: 244, y: 36, w: 16, h: 14, type: 'rj45', patterns: ['dmz'] },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
// FortiGate 60F / 61F
// Front panel: USB | WAN1 | WAN2 | 1-5 (internal switch) | A | DMZ
// ═══════════════════════════════════════════════
const FORTIGATE_60F = {
  id: 'fortigate-60f',
  label: 'FortiGate 60F',
  width: 360,
  height: 80,
  chassis: { x: 0, y: 0, w: 360, h: 80, rx: 6 },
  brandLabel: { text: 'FORTIGATE 60F', x: 12, y: 16, size: 8 },
  groups: [
    {
      label: 'MGMT',
      ports: [
        { name: 'USB', x: 20, y: 32, w: 14, h: 18, type: 'usb', patterns: ['usb'] },
      ],
    },
    {
      label: 'WAN',
      ports: [
        { name: 'WAN1', x: 48, y: 28, w: 16, h: 14, type: 'rj45', patterns: ['wan1'] },
        { name: 'WAN2', x: 48, y: 46, w: 16, h: 14, type: 'rj45', patterns: ['wan2'] },
      ],
    },
    {
      label: 'Internal (1–5)',
      ports: Array.from({ length: 5 }, (_, i) => ({
        name: `${i + 1}`,
        x: 82 + i * 24,
        y: 28 + (i % 2) * 18,
        w: 16,
        h: 14,
        type: 'rj45',
        patterns: [`internal${i + 1}`, `port${i + 1}`, `${i + 1}`],
      })),
    },
    {
      label: 'FortiLink / DMZ',
      ports: [
        { name: 'A', x: 210, y: 28, w: 16, h: 14, type: 'rj45', patterns: ['a', 'fortilink'] },
        { name: 'DMZ', x: 210, y: 46, w: 16, h: 14, type: 'rj45', patterns: ['dmz'] },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
// FortiGate 100E (legacy in fleet for FG100E→FG120G migration)
// Front panel: HA | MGMT | WAN1 | WAN2 | 1-14 (GE RJ45) | X1-X2 (SFP shared)
// ═══════════════════════════════════════════════
const FORTIGATE_100E = {
  id: 'fortigate-100e',
  label: 'FortiGate 100E',
  width: 560,
  height: 80,
  chassis: { x: 0, y: 0, w: 560, h: 80, rx: 6 },
  brandLabel: { text: 'FORTIGATE 100E', x: 12, y: 16, size: 8 },
  groups: [
    {
      label: 'MGMT',
      ports: [
        { name: 'HA', x: 20, y: 28, w: 16, h: 14, type: 'ha', patterns: ['ha', 'ha1'] },
        { name: 'MGMT', x: 20, y: 46, w: 16, h: 14, type: 'mgmt', patterns: ['mgmt', 'management'] },
      ],
    },
    {
      label: 'WAN',
      ports: [
        { name: 'WAN1', x: 50, y: 28, w: 16, h: 14, type: 'rj45', patterns: ['wan1'] },
        { name: 'WAN2', x: 50, y: 46, w: 16, h: 14, type: 'rj45', patterns: ['wan2'] },
      ],
    },
    {
      label: '1 GE RJ45 (1–14)',
      ports: Array.from({ length: 14 }, (_, i) => {
        const col = Math.floor(i / 2);
        const row = i % 2;
        return {
          name: `${i + 1}`,
          x: 82 + col * 26,
          y: 28 + row * 16,
          w: 16,
          h: 14,
          type: 'rj45',
          patterns: [`port${i + 1}`, `internal${i + 1}`, `${i + 1}`],
        };
      }),
    },
    {
      label: 'SFP (X1–X2)',
      ports: [
        { name: 'X1', x: 274, y: 28, w: 18, h: 14, type: 'sfp', patterns: ['x1', 'sfp1'] },
        { name: 'X2', x: 274, y: 46, w: 18, h: 14, type: 'sfp', patterns: ['x2', 'sfp2'] },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════
// Generic switch template generators
// HP/Aruba switches come in 8/24/48 port variants
// ═══════════════════════════════════════════════
function generateSwitchTemplate(portCount, sfpCount, make, model) {
  const id = `switch-${portCount}-${sfpCount}`;
  const label = [make, model].filter(Boolean).join(' ') || `${portCount}-Port Switch`;
  const cols = Math.ceil(portCount / 2);
  const portWidth = 14;
  const portSpacing = portCount > 24 ? 18 : 22;
  const sfpStartX = 60 + cols * portSpacing + 20;
  const totalWidth = sfpStartX + (sfpCount > 0 ? sfpCount * 28 + 20 : 20);

  return {
    id,
    label,
    width: Math.max(totalWidth, 300),
    height: 80,
    chassis: { x: 0, y: 0, w: Math.max(totalWidth, 300), h: 80, rx: 6 },
    brandLabel: { text: label.toUpperCase(), x: 12, y: 16, size: 8 },
    groups: [
      {
        label: 'Console',
        ports: [
          { name: 'CON', x: 20, y: 36, w: 16, h: 14, type: 'console', patterns: ['console'] },
        ],
      },
      {
        label: `RJ45 (1–${portCount})`,
        ports: Array.from({ length: portCount }, (_, i) => {
          const col = Math.floor(i / 2);
          const row = i % 2;
          return {
            name: `${i + 1}`,
            x: 60 + col * portSpacing,
            y: 28 + row * 16,
            w: portWidth,
            h: 13,
            type: 'rj45',
            patterns: [
              `${i + 1}`,
              `port ${i + 1}`,
              `${i + 1}/1`,
              `gigabitethernet${i + 1}`,
              `ge-0/0/${i}`,
            ],
          };
        }),
      },
      ...(sfpCount > 0
        ? [{
            label: `SFP (1–${sfpCount})`,
            ports: Array.from({ length: sfpCount }, (_, i) => ({
              name: `SFP${i + 1}`,
              x: sfpStartX + i * 28,
              y: 32 + (i % 2) * 16,
              w: 18,
              h: 14,
              type: 'sfp',
              patterns: [
                `sfp${i + 1}`,
                `${portCount + i + 1}`,
                `gigabitethernet${portCount + i + 1}`,
                `tengigabitethernet${i + 1}`,
              ],
            })),
          }]
        : []),
    ],
  };
}

// ═══════════════════════════════════════════════
// GENERIC FALLBACK
// Auto-generates a stencil based on actual port count
// ═══════════════════════════════════════════════
function generateGenericStencil(ports, make, model, deviceType) {
  const rj45Ports = ports.filter(p =>
    p.type === 'ethernet' || p.mediaType === 'copper' || !p.type
  );
  const sfpPorts = ports.filter(p =>
    p.mediaType === 'fiber' || (p.speed && p.speed >= 10000000000)
  );
  const otherPorts = ports.filter(p =>
    !rj45Ports.includes(p) && !sfpPorts.includes(p)
  );

  const count = rj45Ports.length || ports.length;
  const cols = Math.ceil(count / 2);
  const portSpacing = count > 24 ? 16 : count > 12 ? 20 : 24;
  const sfpStartX = 40 + cols * portSpacing + 20;
  const totalWidth = sfpStartX + (sfpPorts.length > 0 ? sfpPorts.length * 26 + 20 : 20);
  const label = [make, model].filter(Boolean).join(' ') || deviceType?.replace(/_/g, ' ') || 'Device';

  return {
    id: 'generic',
    label,
    width: Math.max(totalWidth, 260),
    height: 80,
    chassis: { x: 0, y: 0, w: Math.max(totalWidth, 260), h: 80, rx: 6 },
    brandLabel: { text: label.toUpperCase(), x: 12, y: 16, size: 7 },
    groups: [
      {
        label: 'Ports',
        ports: (rj45Ports.length > 0 ? rj45Ports : ports).slice(0, 48).map((p, i) => {
          const col = Math.floor(i / 2);
          const row = i % 2;
          return {
            name: p.name || `${i + 1}`,
            x: 40 + col * portSpacing,
            y: 28 + row * 16,
            w: Math.min(14, portSpacing - 4),
            h: 13,
            type: p.mediaType === 'fiber' ? 'sfp' : 'rj45',
            patterns: [p.name?.toLowerCase()].filter(Boolean),
            _matchedPort: p, // direct reference for generic fallback
          };
        }),
      },
    ],
    isGeneric: true,
  };
}

// ═══════════════════════════════════════════════
// MODEL MATCHER
// ═══════════════════════════════════════════════
const MODEL_REGISTRY = [
  // FortiGate series
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /120g/i.test(model), template: FORTIGATE_120G },
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /121g/i.test(model), template: FORTIGATE_120G },
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /70f/i.test(model), template: FORTIGATE_70F },
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /71f/i.test(model), template: FORTIGATE_70F },
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /60f/i.test(model), template: FORTIGATE_60F },
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /61f/i.test(model), template: FORTIGATE_60F },
  { match: (make, model) => /fortinet|fortigate/i.test(make) && /100e/i.test(model), template: FORTIGATE_100E },

  // HP/Aruba — 48-port
  { match: (make, model) => /hp|aruba|hewlett/i.test(make) && /48/i.test(model), template: () => generateSwitchTemplate(48, 4, 'HP', 'Switch 48-Port') },
  // HP/Aruba — 24-port
  { match: (make, model) => /hp|aruba|hewlett/i.test(make) && /24/i.test(model), template: () => generateSwitchTemplate(24, 4, 'HP', 'Switch 24-Port') },
  // HP/Aruba — 8-port
  { match: (make, model) => /hp|aruba|hewlett/i.test(make) && /8(?:p| |g|-|$)/i.test(model), template: () => generateSwitchTemplate(8, 2, 'HP', 'Switch 8-Port') },
  // HP/Aruba — generic (infer port count from model number)
  { match: (make, model) => /hp|aruba|hewlett/i.test(make), template: (make, model) => {
    const portMatch = model?.match(/(\d+)(g|p)/i);
    const count = portMatch ? parseInt(portMatch[1]) : 24;
    return generateSwitchTemplate(Math.min(count, 48), 4, 'HP/Aruba', model);
  }},

  // Cisco — by port count
  { match: (make, model) => /cisco/i.test(make) && /48/i.test(model), template: () => generateSwitchTemplate(48, 4, 'Cisco', 'Switch 48-Port') },
  { match: (make, model) => /cisco/i.test(make) && /24/i.test(model), template: () => generateSwitchTemplate(24, 4, 'Cisco', 'Switch 24-Port') },
  { match: (make, model) => /cisco/i.test(make), template: () => generateSwitchTemplate(24, 4, 'Cisco', 'Switch') },
];

/**
 * Get the stencil template for a device.
 * @param {string} make - Device manufacturer
 * @param {string} model - Device model
 * @param {string} deviceType - device_type enum value
 * @param {Array} ports - Actual port data (for generic fallback sizing)
 * @returns {Object} Stencil template
 */
export function getStencilTemplate(make, model, deviceType, ports = []) {
  for (const entry of MODEL_REGISTRY) {
    if (entry.match(make || '', model || '')) {
      const t = typeof entry.template === 'function'
        ? entry.template(make, model)
        : entry.template;
      return t;
    }
  }

  // Generic fallback — auto-size from actual port data
  if (ports.length > 0) {
    return generateGenericStencil(ports, make, model, deviceType);
  }

  // Absolute fallback — empty device outline
  return {
    id: 'unknown',
    label: [make, model].filter(Boolean).join(' ') || 'Unknown Device',
    width: 200,
    height: 80,
    chassis: { x: 0, y: 0, w: 200, h: 80, rx: 6 },
    brandLabel: { text: (model || 'UNKNOWN').toUpperCase(), x: 12, y: 16, size: 7 },
    groups: [],
    isEmpty: true,
  };
}

/**
 * Match real port data to stencil template ports.
 * Returns a Map of stencil port name → matched port data.
 */
export function matchPortsToStencil(stencil, ports) {
  const matched = new Map();
  const usedPorts = new Set();

  // For generic stencils with _matchedPort, use direct mapping
  if (stencil.isGeneric) {
    for (const group of stencil.groups) {
      for (const sp of group.ports) {
        if (sp._matchedPort) {
          matched.set(sp.name, sp._matchedPort);
        }
      }
    }
    return matched;
  }

  // Pattern-based matching
  for (const group of stencil.groups) {
    for (const sp of group.ports) {
      if (!sp.patterns || sp.patterns.length === 0) continue;

      for (const port of ports) {
        if (usedPorts.has(port.interfaceId)) continue;
        const portName = (port.name || '').toLowerCase().trim();

        for (const pattern of sp.patterns) {
          const pat = pattern.toLowerCase();
          if (
            portName === pat ||
            portName.endsWith(pat) ||
            portName.includes(pat)
          ) {
            matched.set(sp.name, port);
            usedPorts.add(port.interfaceId);
            break;
          }
        }
        if (matched.has(sp.name)) break;
      }
    }
  }

  return matched;
}

// Port type visual configs
export const PORT_TYPE_STYLES = {
  rj45:    { shape: 'rect', label: 'RJ45',    baseColor: '#64748b' },
  sfp:     { shape: 'rect', label: 'SFP',     baseColor: '#8B5CF6' },
  'sfp+':  { shape: 'rect', label: 'SFP+',    baseColor: '#F97316' },
  console: { shape: 'rect', label: 'Console',  baseColor: '#06B6D4' },
  usb:     { shape: 'rect', label: 'USB',      baseColor: '#6366F1' },
  ha:      { shape: 'rect', label: 'HA',       baseColor: '#EC4899' },
  mgmt:    { shape: 'rect', label: 'MGMT',     baseColor: '#14B8A6' },
};

export const PORT_STATUS_COLORS = {
  online:   { fill: '#22c55e', stroke: '#16a34a', label: 'Online' },
  offline:  { fill: '#374151', stroke: '#4b5563', label: 'Offline' },
  disabled: { fill: '#1f2937', stroke: '#374151', label: 'Disabled' },
  testing:  { fill: '#f59e0b', stroke: '#d97706', label: 'Testing' },
  unknown:  { fill: '#374151', stroke: '#4b5563', label: 'Unknown' },
};