/**
 * VEMIO Stencil Templates
 *
 * Model-specific faceplate definitions for known network device models.
 * Each template describes the visual layout of physical ports on the device's
 * front panel, mirroring how Auvik / LibreNMS render device stencils.
 *
 * To add a new model:
 *   1. Add an entry to STENCIL_TEMPLATES with a regex matcher
 *   2. Define the row layout — each row is an array of port "slots"
 *      Each slot is a port name (string) or null (gap/spacer)
 *   3. Optionally add fixed status LEDs, badges, or model labels
 *
 * Drop this file at:
 *   /tmp/vemio-frontend/app/components/stencil-templates.js
 */

export const STENCIL_TEMPLATES = [
  // ─── Sophos XGS 107 Firewall ───
  // Front panel: 8 GE copper (Port1-Port8) + 1 SFP (PortF1) + 2 USB + management
  // Layout from real device: PortF1 SFP on left, then 8 GE in 2 rows of 4
  {
    id: 'sophos-xgs-107',
    match: { make: /sophos/i, model: /xgs\s*107/i },
    label: 'Sophos XGS 107',
    color: '#0a4d8c',
    rows: [
      [
        { type: 'sfp',  name: 'PortF1' },
        { type: 'gap',  width: 8 },
        { type: 'port', name: 'Port1' },
        { type: 'port', name: 'Port3' },
        { type: 'port', name: 'Port5' },
        { type: 'port', name: 'Port7' },
      ],
      [
        { type: 'gap',  width: 56 },
        { type: 'port', name: 'Port2' },
        { type: 'port', name: 'Port4' },
        { type: 'port', name: 'Port6' },
        { type: 'port', name: 'Port8' },
      ],
    ],
    badge: 'XGS 107',
  },

  // ─── Sophos XGS 116 / 126 / 136 (similar layout, more ports) ───
  {
    id: 'sophos-xgs-1xx',
    match: { make: /sophos/i, model: /xgs\s*1[1-3][0-9]/i },
    label: 'Sophos XGS Firewall',
    color: '#0a4d8c',
    rows: [
      [
        { type: 'sfp',  name: 'PortF1' },
        { type: 'sfp',  name: 'PortF2' },
        { type: 'gap',  width: 8 },
        { type: 'port', name: 'Port1' },
        { type: 'port', name: 'Port3' },
        { type: 'port', name: 'Port5' },
        { type: 'port', name: 'Port7' },
      ],
      [
        { type: 'gap',  width: 80 },
        { type: 'port', name: 'Port2' },
        { type: 'port', name: 'Port4' },
        { type: 'port', name: 'Port6' },
        { type: 'port', name: 'Port8' },
      ],
    ],
  },

  // ─── HPE Aruba Instant On 1930 / 24p PoE ───
  // 24 RJ45 ports + 4 SFP+ uplinks
  {
    id: 'aruba-instant-on-24p',
    match: { make: /(hpe?|aruba)/i, model: /(instant\s*on|1930).*24/i },
    label: 'Instant On 1930 24G',
    color: '#01a982',
    rows: [
      Array.from({ length: 12 }, (_, i) => ({ type: 'port', name: String(i * 2 + 1) })),
      Array.from({ length: 12 }, (_, i) => ({ type: 'port', name: String(i * 2 + 2) })),
    ],
    sfpRow: [
      { type: 'sfp', name: '25' }, { type: 'sfp', name: '26' },
      { type: 'sfp', name: '27' }, { type: 'sfp', name: '28' },
    ],
  },

  // ─── HP ProCurve 3500yl-24G-PoE+ ───
  // 24 GE PoE+ ports + 4 SFP, modular slot
  {
    id: 'hp-procurve-3500yl-24g',
    match: { make: /^hp$/i, model: /procurve\s*3500yl/i },
    label: 'HP ProCurve 3500yl-24G',
    color: '#0096d6',
    rows: [
      Array.from({ length: 12 }, (_, i) => ({ type: 'port', name: String(i * 2 + 1) })),
      Array.from({ length: 12 }, (_, i) => ({ type: 'port', name: String(i * 2 + 2) })),
    ],
    sfpRow: [
      { type: 'sfp', name: '25' }, { type: 'sfp', name: '26' },
      { type: 'sfp', name: '27' }, { type: 'sfp', name: '28' },
    ],
  },

  // ─── Aruba AP-505 / AP-345 (Wireless APs — uplink only) ───
  {
    id: 'aruba-ap-5xx',
    match: { make: /aruba/i, model: /ap-?(5[0-9][0-9]|3[0-9][0-9])/i },
    label: 'Aruba Access Point',
    color: '#ff8300',
    rows: [
      [
        { type: 'port', name: 'eth0', label: 'UPLINK' },
      ],
    ],
  },
];

/**
 * Find the matching stencil template for a given device's make/model.
 * Returns the template object or null if no match.
 */
export function findStencilTemplate(make, model) {
  if (!make && !model) return null;
  // Strip trailing commas and whitespace from model strings
  const cleanMake = String(make || '').trim().replace(/,$/, '');
  const cleanModel = String(model || '').trim().replace(/,$/, '');

  for (const tmpl of STENCIL_TEMPLATES) {
    const m = tmpl.match;
    const makeOk  = !m.make  || m.make.test(cleanMake);
    const modelOk = !m.model || m.model.test(cleanModel);
    if (makeOk && modelOk) return tmpl;
  }
  return null;
}

/**
 * Map an actual port from the API to a template slot by name.
 * Used to look up live port status when rendering the stencil.
 */
export function findPortByName(ports, name) {
  if (!ports || !name) return null;
  return ports.find(p =>
    p.name === name ||
    String(p.index) === name ||
    (p.name && p.name.toLowerCase() === name.toLowerCase())
  ) || null;
}
