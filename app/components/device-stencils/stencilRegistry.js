/**
 * VEMIO™ — Device Stencil Registry
 *
 * Maps device make+model to a hardware-accurate front-panel port layout.
 * Covers the full Vinay Enterprises + AIA Engineering fleet:
 *   Firewalls: FortiGate 60F/70F/80E/80F/100E/120G, Sophos XGS 107
 *   Core Switches: Cisco C9300-24T, CBS350-24FP-4X, HP CX 8100, SG350X-48P
 *   Access Switches: Cisco SG300/SG350/CBS350/C1300/SF300/SG500/SRW, HP 2530/A5120/1830/5520/ProCurve, D-Link DGS-1210, Netgear GS724T
 *   Access Points: Aruba AP-345/505, Ruckus, Fortinet FP221E/222E, Cambium, Cisco, Netgear
 *   Routers: Cisco C1111-8P
 *   NAS: Synology RS3621/DS1821, QNAP, Hikvision
 *   UPS: Eaton  |  Printers  |  Servers: VMware, HP ProLiant, Microsoft
 */

// ═══════════════════════════════════════════════
// COMPANY LOGOS — brand color + abbreviation for chassis rendering
// ═══════════════════════════════════════════════
export const BRAND_LOGOS = {
  Fortinet: { color: '#EE3124', abbr: 'FN' },
  Sophos:   { color: '#0058A2', abbr: 'SO' },
  Cisco:    { color: '#049FD9', abbr: 'CS' },
  HP:       { color: '#0096D6', abbr: 'HP' },
  Aruba:    { color: '#FF8300', abbr: 'AR' },
  Ruckus:   { color: '#662D91', abbr: 'RK' },
  Cambium:  { color: '#00A651', abbr: 'CB' },
  Netgear:  { color: '#7AB648', abbr: 'NG' },
  'D-Link': { color: '#FF6600', abbr: 'DL' },
  Synology: { color: '#B5B5B6', abbr: 'SY' },
  QNAP:     { color: '#0078D4', abbr: 'QN' },
  Eaton:    { color: '#E31937', abbr: 'EA' },
  Brother:  { color: '#003DA6', abbr: 'BR' },
  Canon:    { color: '#CC0000', abbr: 'CN' },
  Samsung:  { color: '#034EA2', abbr: 'SS' },
  Kyocera:  { color: '#CC0000', abbr: 'KY' },
  'Konica Minolta': { color: '#003087', abbr: 'KM' },
  VMware:   { color: '#696566', abbr: 'VM' },
  Microsoft:{ color: '#00A4EF', abbr: 'MS' },
  Moxa:     { color: '#CC0000', abbr: 'MX' },
  Hikvision:{ color: '#CC0000', abbr: 'HK' },
};

export function getBrandInfo(make) {
  if (!make) return null;
  for (const [key, val] of Object.entries(BRAND_LOGOS)) {
    if (make.toLowerCase().includes(key.toLowerCase())) return { name: key, ...val };
  }
  return null;
}

// ═══════════════════════════════════════════════
// VIRTUAL INTERFACE FILTER
// ═══════════════════════════════════════════════
export const VIRTUAL_INTERFACE_PATTERNS = [
  /^br\d/i, /^bond\d/i, /^wifi\d/i, /^ath\d/i, /^wlan\d/i,
  /^radio\d/i, /^vlan\d/i, /^lo\d?$/i, /^tunnel\d/i, /^null\d?$/i,
  /^virbr/i, /^docker/i, /^veth/i, /^tap\d/i, /^tun\d/i,
  /^pimreg/i, /^sit\d/i, /^nve\d/i, /^mgmt\d/i,
  /^dummy\d/i, /^erspan\d/i, /^gretap\d/i, /^ifb\d/i,
  /^ipsec\d/i, /^mv-/i, /^mvmgmt/i, /^pport_/i, /^spq$/i,
  /_ppp$/i, /^wqt\./i, /^wqtn\./i, /^guestap$/i, /^modem$/i,
];

export function isPhysicalPort(port) {
  if (!port) return false;
  const name = (port.name || '').trim();
  if (!name) return false;
  // Filter by interface type — only ethernet and fiber-channel are physical
  const ifType = (port.type || '').toLowerCase();
  if (ifType && ifType !== 'ethernet' && ifType !== 'fiber' && ifType !== 'other' && ifType !== 'unknown') return false;
  // Filter named zones/policies (FortiGate zone interfaces have type 'other' and mixed-case multi-word names)
  if (ifType === 'other' && /[A-Z]/.test(name) && /[\s_-]/.test(name)) return false;
  // Filter single-word 'other' type with all-lowercase that look like zone names (e.g., 'guest', 'test')
  if (ifType === 'other' && !(/^(port|eth|wan|lan|dmz|ha|mgmt|internal|sfp|console|x\d)/i.test(name))) return false;
  for (const p of VIRTUAL_INTERFACE_PATTERNS) { if (p.test(name)) return false; }
  return true;
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════
function pairedRJ45(count, startX, startNum = 1, spacing = 22) {
  return Array.from({ length: count }, (_, i) => {
    const col = Math.floor(i / 2), row = i % 2, num = startNum + i;
    return {
      name: `${num}`, x: startX + col * spacing, y: 28 + row * 16, w: 14, h: 13, type: 'rj45',
      patterns: [`port${num}`, `internal${num}`, `${num}`, `ge-0/0/${num - 1}`, `gigabitethernet${num}`, `gigabitethernet0/${num}`, `gi0/${num}`],
    };
  });
}

// ════════════════════════════════════════
// FORTIGATE SERIES
// ════════════════════════════════════════
const FORTIGATE_120G = {
  id: 'fortigate-120g', label: 'FortiGate 120G', make: 'Fortinet', width: 580, height: 80,
  chassis: { x: 0, y: 0, w: 580, h: 80, rx: 6 }, brandLabel: { text: 'FORTIGATE 120G', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'MGMT', ports: [
      { name: 'USB', x: 18, y: 30, w: 12, h: 16, type: 'usb', patterns: ['usb'] },
      { name: 'HA', x: 36, y: 28, w: 14, h: 13, type: 'ha', patterns: ['ha', 'ha1'] },
      { name: 'MGMT', x: 36, y: 44, w: 14, h: 13, type: 'mgmt', patterns: ['mgmt', 'management'] },
    ]},
    { label: 'GE RJ45 (1–16)', ports: pairedRJ45(16, 62, 1, 20) },
    { label: '10G SFP+', ports: [
      { name: 'X1', x: 230, y: 28, w: 16, h: 13, type: 'sfp+', patterns: ['x1'] },
      { name: 'X2', x: 230, y: 44, w: 16, h: 13, type: 'sfp+', patterns: ['x2'] },
      { name: 'X3', x: 252, y: 28, w: 16, h: 13, type: 'sfp+', patterns: ['x3'] },
      { name: 'X4', x: 252, y: 44, w: 16, h: 13, type: 'sfp+', patterns: ['x4'] },
    ]},
    { label: 'GE SFP (17–24)', ports: Array.from({ length: 8 }, (_, i) => ({
      name: `${i+17}`, x: 280 + Math.floor(i/2)*22, y: 28 + (i%2)*16, w: 16, h: 13, type: 'sfp', patterns: [`port${i+17}`, `${i+17}`],
    }))},
  ],
};

const FORTIGATE_100E = {
  id: 'fortigate-100e', label: 'FortiGate 100E', make: 'Fortinet', width: 400, height: 80,
  chassis: { x: 0, y: 0, w: 400, h: 80, rx: 6 }, brandLabel: { text: 'FORTIGATE 100E', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'MGMT', ports: [
      { name: 'HA', x: 18, y: 28, w: 14, h: 13, type: 'ha', patterns: ['ha','ha1'] },
      { name: 'MGMT', x: 18, y: 44, w: 14, h: 13, type: 'mgmt', patterns: ['mgmt','management'] },
    ]},
    { label: 'WAN', ports: [
      { name: 'WAN1', x: 42, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['wan1'] },
      { name: 'WAN2', x: 42, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['wan2'] },
    ]},
    { label: 'GE RJ45 (1–14)', ports: pairedRJ45(14, 68, 1, 20) },
    { label: 'SFP', ports: [
      { name: 'X1', x: 214, y: 28, w: 16, h: 13, type: 'sfp', patterns: ['x1','sfp1'] },
      { name: 'X2', x: 214, y: 44, w: 16, h: 13, type: 'sfp', patterns: ['x2','sfp2'] },
    ]},
  ],
};

const FORTIGATE_80E = {
  id: 'fortigate-80e', label: 'FortiGate 80E', make: 'Fortinet', width: 400, height: 80,
  chassis: { x: 0, y: 0, w: 400, h: 80, rx: 6 }, brandLabel: { text: 'FORTIGATE 80E', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'MGMT', ports: [
      { name: 'HA', x: 18, y: 28, w: 14, h: 13, type: 'ha', patterns: ['ha','ha1'] },
      { name: 'DMZ', x: 18, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['dmz'] },
    ]},
    { label: 'GE RJ45 (1–12)', ports: pairedRJ45(12, 44, 1, 20) },
    { label: 'WAN/SFP', ports: [
      { name: 'WAN1', x: 172, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['wan1'] },
      { name: 'WAN2', x: 172, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['wan2'] },
      { name: 'SFP1', x: 194, y: 28, w: 16, h: 13, type: 'sfp', patterns: ['sfp1','x1'] },
      { name: 'SFP2', x: 194, y: 44, w: 16, h: 13, type: 'sfp', patterns: ['sfp2','x2'] },
    ]},
  ],
};

const FORTIGATE_80F = {
  id: 'fortigate-80f', label: 'FortiGate 80F', make: 'Fortinet', width: 320, height: 80,
  chassis: { x: 0, y: 0, w: 320, h: 80, rx: 6 }, brandLabel: { text: 'FORTIGATE 80F', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'USB', ports: [{ name: 'USB', x: 18, y: 32, w: 12, h: 16, type: 'usb', patterns: ['usb'] }]},
    { label: 'GE RJ45 (1–8)', ports: pairedRJ45(8, 40, 1, 22) },
    { label: 'WAN/SFP', ports: [
      { name: 'WAN1', x: 136, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['wan1'] },
      { name: 'WAN2', x: 136, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['wan2'] },
      { name: 'SFP1', x: 158, y: 28, w: 16, h: 13, type: 'sfp', patterns: ['sfp1','x1'] },
      { name: 'SFP2', x: 158, y: 44, w: 16, h: 13, type: 'sfp', patterns: ['sfp2','x2'] },
    ]},
  ],
};

const FORTIGATE_70F = {
  id: 'fortigate-70f', label: 'FortiGate 70F', make: 'Fortinet', width: 280, height: 80,
  chassis: { x: 0, y: 0, w: 280, h: 80, rx: 6 }, brandLabel: { text: 'FORTIGATE 70F', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'USB', ports: [{ name: 'USB', x: 18, y: 32, w: 12, h: 16, type: 'usb', patterns: ['usb'] }]},
    { label: 'WAN', ports: [
      { name: 'WAN1', x: 40, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['wan1'] },
      { name: 'WAN2', x: 40, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['wan2'] },
    ]},
    { label: 'Internal (1–5)', ports: Array.from({ length: 5 }, (_, i) => ({
      name: `${i+1}`, x: 68 + i * 22, y: 28 + (i%2)*16, w: 14, h: 13, type: 'rj45',
      patterns: [`internal${i+1}`, `port${i+1}`, `${i+1}`],
    }))},
    { label: 'FortiLink', ports: [
      { name: 'A', x: 184, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['a','fortilink-a'] },
      { name: 'B', x: 184, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['b','fortilink-b'] },
    ]},
    { label: 'DMZ', ports: [{ name: 'DMZ', x: 210, y: 36, w: 14, h: 13, type: 'rj45', patterns: ['dmz'] }]},
  ],
};

const FORTIGATE_60F = {
  id: 'fortigate-60f', label: 'FortiGate 60F', make: 'Fortinet', width: 260, height: 80,
  chassis: { x: 0, y: 0, w: 260, h: 80, rx: 6 }, brandLabel: { text: 'FORTIGATE 60F', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'USB', ports: [{ name: 'USB', x: 18, y: 32, w: 12, h: 16, type: 'usb', patterns: ['usb'] }]},
    { label: 'WAN', ports: [
      { name: 'WAN1', x: 40, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['wan1'] },
      { name: 'WAN2', x: 40, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['wan2'] },
    ]},
    { label: 'Internal (1–5)', ports: Array.from({ length: 5 }, (_, i) => ({
      name: `${i+1}`, x: 68 + i * 22, y: 28 + (i%2)*16, w: 14, h: 13, type: 'rj45',
      patterns: [`internal${i+1}`, `port${i+1}`, `${i+1}`],
    }))},
    { label: 'FortiLink/DMZ', ports: [
      { name: 'A', x: 184, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['a','fortilink'] },
      { name: 'DMZ', x: 184, y: 44, w: 14, h: 13, type: 'rj45', patterns: ['dmz'] },
    ]},
  ],
};

// ════════════════════════════════════════
// SOPHOS
// ════════════════════════════════════════
const SOPHOS_XGS_107 = {
  id: 'sophos-xgs-107', label: 'Sophos XGS 107', make: 'Sophos', width: 300, height: 80,
  chassis: { x: 0, y: 0, w: 300, h: 80, rx: 6 }, brandLabel: { text: 'SOPHOS XGS 107', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'GE RJ45 (1–8)', ports: pairedRJ45(8, 20, 1, 22) },
    { label: 'SFP', ports: [{ name: 'SFP', x: 118, y: 34, w: 18, h: 14, type: 'sfp', patterns: ['sfp','sfp1','port9','portf1'] }]},
  ],
};

// ════════════════════════════════════════
// CISCO ROUTER
// ════════════════════════════════════════
const CISCO_C1111_8P = {
  id: 'cisco-c1111-8p', label: 'Cisco C1111-8P', make: 'Cisco', width: 340, height: 80,
  chassis: { x: 0, y: 0, w: 340, h: 80, rx: 6 }, brandLabel: { text: 'CISCO ISR 1100', x: 12, y: 16, size: 8 },
  groups: [
    { label: 'WAN', ports: [
      { name: 'GE0/0/0', x: 20, y: 28, w: 14, h: 13, type: 'rj45', patterns: ['gigabitethernet0/0/0','ge0/0/0'] },
      { name: 'SFP', x: 20, y: 44, w: 16, h: 13, type: 'sfp', patterns: ['gigabitethernet0/0/1','ge0/0/1','sfp'] },
    ]},
    { label: 'LAN (1–8)', ports: pairedRJ45(8, 48, 1, 22) },
    { label: 'Console', ports: [{ name: 'CON', x: 146, y: 36, w: 14, h: 12, type: 'console', patterns: ['console'] }]},
  ],
};

// ════════════════════════════════════════
// SWITCH GENERATORS
// ════════════════════════════════════════
function generateSwitchTemplate(portCount, sfpCount, make, model, sfpPlusCount = 0) {
  const label = [make, model].filter(Boolean).join(' ') || `${portCount}-Port Switch`;
  const cols = Math.ceil(portCount / 2);
  const sp = portCount > 24 ? 16 : portCount > 12 ? 20 : 22;
  const sfpStartX = 50 + cols * sp + 16;
  const sfpPlusStartX = sfpStartX + sfpCount * 24 + (sfpCount > 0 ? 12 : 0);
  const endX = sfpPlusCount > 0 ? sfpPlusStartX + sfpPlusCount * 24 + 16 : sfpStartX + sfpCount * 24 + 16;
  return {
    id: `switch-${portCount}`, label, make, width: Math.max(endX, 260), height: 80,
    chassis: { x: 0, y: 0, w: Math.max(endX, 260), h: 80, rx: 6 },
    brandLabel: { text: label.toUpperCase().slice(0, 40), x: 12, y: 16, size: 7 },
    groups: [
      { label: 'Console', ports: [{ name: 'CON', x: 18, y: 36, w: 14, h: 12, type: 'console', patterns: ['console'] }]},
      { label: `RJ45 (1–${portCount})`, ports: pairedRJ45(portCount, 50, 1, sp) },
      ...(sfpCount > 0 ? [{ label: `SFP`, ports: Array.from({ length: sfpCount }, (_, i) => ({
        name: `SFP${i+1}`, x: sfpStartX + i * 24, y: 30 + (i%2)*16, w: 16, h: 13, type: 'sfp',
        patterns: [`sfp${i+1}`, `${portCount+i+1}`, `gi0/${portCount+i+1}`],
      }))}] : []),
      ...(sfpPlusCount > 0 ? [{ label: `SFP+`, ports: Array.from({ length: sfpPlusCount }, (_, i) => ({
        name: `SFP+${i+1}`, x: sfpPlusStartX + i * 24, y: 30 + (i%2)*16, w: 16, h: 13, type: 'sfp+',
        patterns: [`sfp+${i+1}`, `te0/${i+1}`, `tengigabitethernet0/${i+1}`],
      }))}] : []),
    ],
  };
}

function generateSFPOnlySwitch(sfpCount, make, model) {
  const label = [make, model].filter(Boolean).join(' ');
  const cols = Math.ceil(sfpCount / 2);
  return {
    id: 'sfp-switch', label, make, width: Math.max(50 + cols * 24 + 30, 300), height: 80,
    chassis: { x: 0, y: 0, w: Math.max(50 + cols * 24 + 30, 300), h: 80, rx: 6 },
    brandLabel: { text: label.toUpperCase().slice(0, 40), x: 12, y: 16, size: 7 },
    groups: [
      { label: 'Console', ports: [{ name: 'CON', x: 18, y: 36, w: 14, h: 12, type: 'console', patterns: ['console'] }]},
      { label: `SFP+ (1–${sfpCount})`, ports: Array.from({ length: sfpCount }, (_, i) => ({
        name: `${i+1}`, x: 50 + Math.floor(i/2)*24, y: 28 + (i%2)*16, w: 16, h: 13, type: 'sfp+',
        patterns: [`${i+1}`, `1/1/${i+1}`, `te0/${i+1}`],
      }))},
    ],
  };
}

// ════════════════════════════════════════
// AP / SIMPLE DEVICE GENERATORS
// ════════════════════════════════════════
function generateAPTemplate(make, model) {
  const label = [make, model].filter(Boolean).join(' ') || 'Access Point';
  return { id: 'ap', label, make, isAP: true, width: 200, height: 80,
    chassis: { x: 0, y: 0, w: 200, h: 80, rx: 10 },
    brandLabel: { text: label.toUpperCase().slice(0, 30), x: 12, y: 16, size: 7 },
    groups: [
      { label: 'Ethernet', ports: [
        { name: 'ETH0', x: 30, y: 30, w: 18, h: 16, type: 'rj45', patterns: ['eth0','enet0','ge0','port0','ethernet0','gi0','e0'] },
        { name: 'ETH1', x: 60, y: 30, w: 18, h: 16, type: 'rj45', patterns: ['eth1','enet1','ge1','port1','ethernet1','gi1','e1'] },
      ]},
      { label: 'Console', ports: [{ name: 'CON', x: 100, y: 33, w: 14, h: 12, type: 'console', patterns: ['console','con0'] }]},
    ],
  };
}

function generateAPSinglePort(make, model) {
  const label = [make, model].filter(Boolean).join(' ') || 'Access Point';
  return { id: 'ap-1', label, make, isAP: true, width: 160, height: 80,
    chassis: { x: 0, y: 0, w: 160, h: 80, rx: 10 },
    brandLabel: { text: label.toUpperCase().slice(0, 30), x: 12, y: 16, size: 7 },
    groups: [
      { label: 'Ethernet', ports: [{ name: 'ETH0', x: 30, y: 32, w: 18, h: 16, type: 'rj45', patterns: ['eth0','enet0','ge0','port0','ethernet0'] }]},
      { label: 'Console', ports: [{ name: 'CON', x: 70, y: 35, w: 14, h: 12, type: 'console', patterns: ['console'] }]},
    ],
  };
}

function generateSimpleDevice(make, model, deviceType, portCount = 2) {
  const typeLabel = { nas: 'NAS', ups: 'UPS', printer: 'Printer', server: 'Server' };
  const label = [make, model].filter(Boolean).join(' ') || typeLabel[deviceType] || 'Device';
  return { id: `simple-${deviceType}`, label, make, width: 50 + portCount * 36, height: 80,
    chassis: { x: 0, y: 0, w: 50 + portCount * 36, h: 80, rx: 8 },
    brandLabel: { text: label.toUpperCase().slice(0, 30), x: 12, y: 16, size: 7 },
    groups: [{ label: 'Ethernet', ports: Array.from({ length: portCount }, (_, i) => ({
      name: `ETH${i}`, x: 24 + i * 34, y: 32, w: 18, h: 16, type: 'rj45',
      patterns: [`eth${i}`, `lan${i+1}`, `port${i+1}`, `${i+1}`],
    }))}],
  };
}

function generateGenericStencil(ports, make, model, deviceType) {
  const count = Math.min(ports.length, 48);
  const cols = Math.ceil(count / 2);
  const sp = count > 24 ? 16 : count > 12 ? 20 : 24;
  const label = [make, model].filter(Boolean).join(' ') || deviceType?.replace(/_/g, ' ') || 'Device';
  return { id: 'generic', label, make, isGeneric: true, width: Math.max(40 + cols * sp + 30, 200), height: 80,
    chassis: { x: 0, y: 0, w: Math.max(40 + cols * sp + 30, 200), h: 80, rx: 6 },
    brandLabel: { text: label.toUpperCase().slice(0, 30), x: 12, y: 16, size: 7 },
    groups: [{ label: 'Ports', ports: ports.slice(0, 48).map((p, i) => ({
      name: p.name || `${i+1}`, x: 30 + Math.floor(i/2)*sp, y: 28 + (i%2)*16,
      w: Math.min(14, sp - 4), h: 13, type: p.mediaType === 'fiber' ? 'sfp' : 'rj45',
      patterns: [p.name?.toLowerCase()].filter(Boolean), _matchedPort: p,
    }))}],
  };
}

// ═══════════════════════════════════════════════
// MODEL REGISTRY — first match wins
// ═══════════════════════════════════════════════
const MODEL_REGISTRY = [
  // ── Fortinet Firewalls ──
  { match: (m, o) => /fortinet/i.test(m) && /120g|121g/i.test(o), template: FORTIGATE_120G },
  { match: (m, o) => /fortinet/i.test(m) && /100e|101e/i.test(o), template: FORTIGATE_100E },
  { match: (m, o) => /fortinet/i.test(m) && /80e|81e/i.test(o), template: FORTIGATE_80E },
  { match: (m, o) => /fortinet/i.test(m) && /80f|81f/i.test(o), template: FORTIGATE_80F },
  { match: (m, o) => /fortinet/i.test(m) && /70f|71f/i.test(o), template: FORTIGATE_70F },
  { match: (m, o) => /fortinet/i.test(m) && /60f|61f/i.test(o), template: FORTIGATE_60F },

  // ── Sophos Firewalls ──
  { match: (m, o, t) => /sophos/i.test(m) && t === 'firewall', template: SOPHOS_XGS_107 },

  // ── Access Points (BEFORE switch matchers) ──
  { match: (m, o, t) => t === 'access_point' && /aruba/i.test(m), template: (m, o) => generateAPTemplate(m, o) },
  { match: (m, o, t) => t === 'access_point' && /ruckus/i.test(m), template: (m, o) => generateAPTemplate(m, o) },
  { match: (m, o, t) => t === 'access_point' && /fortinet/i.test(m), template: (m, o) => generateAPSinglePort(m, o) },
  { match: (m, o, t) => t === 'access_point' && /cambium/i.test(m), template: (m, o) => generateAPSinglePort(m, o) },
  { match: (m, o, t) => t === 'access_point' && /cisco/i.test(m), template: (m, o) => generateAPTemplate(m, o) },
  { match: (m, o, t) => t === 'access_point' && /netgear/i.test(m), template: (m, o) => generateAPSinglePort(m, o) },
  { match: (m, o, t) => t === 'access_point', template: (m, o) => generateAPTemplate(m || 'AP', o) },

  // ── Cisco Router ──
  { match: (m, o) => /cisco/i.test(m) && /c1111/i.test(o), template: CISCO_C1111_8P },
  { match: (m, o, t) => t === 'router' && /cisco/i.test(m), template: () => ({ ...CISCO_C1111_8P }) },

  // ── Cisco Switches (specific models from fleet) ──
  { match: (m, o) => /cisco/i.test(m) && /c9300.*24/i.test(o), template: () => generateSwitchTemplate(24, 0, 'Cisco', 'C9300-24T', 4) },
  { match: (m, o) => /cisco/i.test(m) && /cbs350.*48/i.test(o), template: (_, o) => generateSwitchTemplate(48, 4, 'Cisco', o) },
  { match: (m, o) => /cisco/i.test(m) && /cbs350.*24/i.test(o), template: (_, o) => generateSwitchTemplate(24, 0, 'Cisco', o, 4) },
  { match: (m, o) => /cisco/i.test(m) && /cbs350.*8/i.test(o), template: (_, o) => generateSwitchTemplate(8, 2, 'Cisco', o) },
  { match: (m, o) => /cisco/i.test(m) && /c1300.*48/i.test(o), template: () => generateSwitchTemplate(48, 4, 'Cisco', 'C1300-48P') },
  { match: (m, o) => /cisco/i.test(m) && /sg500.*52|sg500 52/i.test(o), template: () => generateSwitchTemplate(48, 4, 'Cisco', 'SG500-52') },
  { match: (m, o) => /cisco/i.test(m) && /sg500.*28/i.test(o), template: () => generateSwitchTemplate(24, 4, 'Cisco', 'SG500-28') },
  { match: (m, o) => /cisco/i.test(m) && /sg350x.*48/i.test(o), template: () => generateSwitchTemplate(48, 0, 'Cisco', 'SG350X-48P', 4) },
  { match: (m, o) => /cisco/i.test(m) && /sg350.*52/i.test(o), template: () => generateSwitchTemplate(48, 4, 'Cisco', 'SG350-52') },
  { match: (m, o) => /cisco/i.test(m) && /sg350.*28/i.test(o), template: () => generateSwitchTemplate(24, 4, 'Cisco', 'SG350-28') },
  { match: (m, o) => /cisco/i.test(m) && /sg350.*10/i.test(o), template: () => generateSwitchTemplate(8, 2, 'Cisco', 'SG350-10P') },
  { match: (m, o) => /cisco/i.test(m) && /sg300.*52/i.test(o), template: () => generateSwitchTemplate(48, 4, 'Cisco', 'SG300-52') },
  { match: (m, o) => /cisco/i.test(m) && /sg300.*28/i.test(o), template: () => generateSwitchTemplate(24, 4, 'Cisco', 'SG300-28') },
  { match: (m, o) => /cisco/i.test(m) && /sg300.*10/i.test(o), template: () => generateSwitchTemplate(8, 2, 'Cisco', 'SG300-10') },
  { match: (m, o) => /cisco/i.test(m) && /sf300.*24/i.test(o), template: () => generateSwitchTemplate(24, 2, 'Cisco', 'SF300-24') },
  { match: (m, o) => /cisco/i.test(m) && /srw2024/i.test(o), template: () => generateSwitchTemplate(24, 2, 'Cisco', 'SRW2024') },
  // Cisco generic switch
  { match: (m, o, t) => /cisco/i.test(m) && (t === 'access_switch' || t === 'core_switch'), template: (m, o) => {
    const n = o?.match(/(\d+)/); const c = n ? Math.min(parseInt(n[1]), 48) : 24;
    return generateSwitchTemplate(c >= 8 ? c : 24, 4, 'Cisco', o);
  }},

  // ── HP/Aruba Switches ──
  { match: (m, o) => /hp/i.test(m) && /cx.?8100/i.test(o), template: () => generateSFPOnlySwitch(24, 'HP', 'CX 8100 24x10G') },
  { match: (m, o) => /hp/i.test(m) && /55[12]0.*24/i.test(o), template: (_, o) => generateSwitchTemplate(24, 0, 'HP', o, 4) },
  { match: (m, o) => /hp/i.test(m) && /a?5120.*48/i.test(o), template: () => generateSwitchTemplate(48, 4, 'HP', 'A5120-48G') },
  { match: (m, o) => /hp/i.test(m) && /a?5120.*24/i.test(o), template: () => generateSwitchTemplate(24, 4, 'HP', 'A5120-24G') },
  { match: (m, o) => /hp/i.test(m) && /procurve.*3500/i.test(o), template: () => generateSwitchTemplate(24, 4, 'HP', 'ProCurve 3500yl') },
  { match: (m, o) => /hp/i.test(m) && /2530.*48/i.test(o), template: () => generateSwitchTemplate(48, 4, 'HP', '2530-48G') },
  { match: (m, o) => /hp/i.test(m) && /2530.*24/i.test(o), template: () => generateSwitchTemplate(24, 4, 'HP', '2530-24G') },
  { match: (m, o) => /hp/i.test(m) && /2530.*8/i.test(o), template: () => generateSwitchTemplate(8, 2, 'HP', '2530-8G') },
  { match: (m, o) => /hp/i.test(m) && /1830.*24/i.test(o), template: () => generateSwitchTemplate(24, 2, 'HP', '1830 24G') },
  { match: (m, o) => /hp/i.test(m) && /1830.*8/i.test(o), template: () => generateSwitchTemplate(8, 2, 'HP', '1830 8G') },
  // HP generic switch
  { match: (m, o, t) => /hp|aruba|hewlett/i.test(m) && (t === 'access_switch' || t === 'core_switch'), template: (m, o) => {
    const n = o?.match(/(\d+)/); const c = n ? Math.min(parseInt(n[1]), 48) : 24;
    return generateSwitchTemplate(c >= 8 ? c : 24, 4, 'HP', o);
  }},

  // ── D-Link ──
  { match: (m, o) => /d-?link/i.test(m) && /dgs.*1210.*10/i.test(o), template: () => generateSwitchTemplate(8, 2, 'D-Link', 'DGS-1210-10P') },
  { match: (m, o, t) => /d-?link/i.test(m) && (t === 'access_switch' || t === 'core_switch'), template: (_, o) => generateSwitchTemplate(24, 4, 'D-Link', o) },

  // ── Netgear ──
  { match: (m, o) => /netgear/i.test(m) && /gs724/i.test(o), template: () => generateSwitchTemplate(24, 2, 'Netgear', 'GS724T') },
  { match: (m, o, t) => /netgear/i.test(m) && (t === 'access_switch' || t === 'core_switch'), template: (_, o) => generateSwitchTemplate(24, 2, 'Netgear', o) },

  // ── NAS ──
  { match: (m, o, t) => t === 'nas' && /synology/i.test(m) && /rs/i.test(o), template: (m, o) => generateSimpleDevice(m, o, 'nas', 4) },
  { match: (m, o, t) => t === 'nas' && /synology/i.test(m), template: (m, o) => generateSimpleDevice(m, o, 'nas', 2) },
  { match: (m, o, t) => t === 'nas' && /qnap/i.test(m), template: (m, o) => generateSimpleDevice(m, o, 'nas', 2) },
  { match: (m, o, t) => t === 'nas', template: (m, o) => generateSimpleDevice(m, o, 'nas', 1) },

  // ── UPS / Printer / Server ──
  { match: (m, o, t) => t === 'ups', template: (m, o) => generateSimpleDevice(m, o, 'ups', 1) },
  { match: (m, o, t) => t === 'printer', template: (m, o) => generateSimpleDevice(m, o, 'printer', 1) },
  { match: (m, o, t) => t === 'server' && /proliant/i.test(o), template: (m, o) => generateSimpleDevice(m, o, 'server', 4) },
  { match: (m, o, t) => t === 'server', template: (m, o) => generateSimpleDevice(m, o, 'server', 2) },
];


// ═══════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════

export function getStencilTemplate(make, model, deviceType, ports = []) {
  const physicalPorts = ports.filter(isPhysicalPort);
  for (const entry of MODEL_REGISTRY) {
    if (entry.match(make || '', model || '', deviceType || '')) {
      const t = typeof entry.template === 'function' ? entry.template(make, model) : entry.template;
      return t;
    }
  }
  if (physicalPorts.length > 0) return generateGenericStencil(physicalPorts, make, model, deviceType);
  return {
    id: 'unknown', label: [make, model].filter(Boolean).join(' ') || 'Unknown Device',
    width: 200, height: 80, chassis: { x: 0, y: 0, w: 200, h: 80, rx: 6 },
    brandLabel: { text: (model || 'UNKNOWN').toUpperCase(), x: 12, y: 16, size: 7 },
    groups: [], isEmpty: true,
  };
}

export function matchPortsToStencil(stencil, ports) {
  const matched = new Map(), usedPorts = new Set();
  if (stencil.isGeneric) {
    for (const g of stencil.groups) for (const sp of g.ports) { if (sp._matchedPort) matched.set(sp.name, sp._matchedPort); }
    return matched;
  }
  for (const g of stencil.groups) {
    for (const sp of g.ports) {
      if (!sp.patterns?.length) continue;
      for (const port of ports) {
        if (usedPorts.has(port.interfaceId)) continue;
        const pn = (port.name || '').toLowerCase().trim();
        let isMatch = false;
        for (const pat of sp.patterns) {
          const p = pat.toLowerCase();
          // Exact match first
          if (pn === p) { isMatch = true; break; }
          // For short patterns (1-2 chars), only allow exact match to prevent greedy matching
          // e.g., pattern '1' should NOT match 'port13'
          if (p.length <= 2) continue;
          // For longer patterns, allow endsWith and includes
          if (pn.endsWith(p) || pn.includes(p)) { isMatch = true; break; }
        }
        if (isMatch) { matched.set(sp.name, port); usedPorts.add(port.interfaceId); break; }
      }
    }
  }
  return matched;
}

export const PORT_TYPE_STYLES = {
  rj45: { shape: 'rect', label: 'RJ45', baseColor: '#64748b' },
  sfp: { shape: 'rect', label: 'SFP', baseColor: '#8B5CF6' },
  'sfp+': { shape: 'rect', label: 'SFP+', baseColor: '#F97316' },
  console: { shape: 'rect', label: 'Console', baseColor: '#06B6D4' },
  usb: { shape: 'rect', label: 'USB', baseColor: '#6366F1' },
  ha: { shape: 'rect', label: 'HA', baseColor: '#EC4899' },
  mgmt: { shape: 'rect', label: 'MGMT', baseColor: '#14B8A6' },
};

export const PORT_STATUS_COLORS = {
  online: { fill: '#22c55e', stroke: '#16a34a', label: 'Online' },
  offline: { fill: '#374151', stroke: '#4b5563', label: 'Offline' },
  disabled: { fill: '#1f2937', stroke: '#374151', label: 'Disabled' },
  testing: { fill: '#f59e0b', stroke: '#d97706', label: 'Testing' },
  unknown: { fill: '#374151', stroke: '#4b5563', label: 'Unknown' },
};