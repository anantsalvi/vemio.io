// ════════════════════════════════════════════════════════════════════
//  VEMIO™ | Network Topology
//  app/(dashboard)/topology/page.jsx
//
//  Session 9 — Clean rewrite from Sessions 3-8 accumulated code.
//  Features: BFS hierarchical tiers, per-firewall WAN nodes,
//  vendor-based device colors, collapsible subnet clusters,
//  interactive sidebar legend, inspector panel, search/locate,
//  cable type filter, zoom controls, double-click navigate,
//  hover highlight, responsive layout.
// ════════════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Network, X, RefreshCw, Search, Minus, Plus,
  Maximize2, ChevronRight,
} from 'lucide-react';
import * as d3 from 'd3';
import { useDeviceCategory } from '@/contexts/DeviceCategoryContext';
import { useTenantSwitcher } from '@/contexts/TenantSwitcherContext';


// ═══════════════════════════════════════════════════════════════════
//  SECTION 1: CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

/* ── Device color system (type → base color, vendor overrides) ── */
const TYPE_COLORS = {
  firewall: '#EF4444', router: '#F97316', core_switch: '#3B82F6',
  access_switch: '#10B981', access_point: '#A855F7', server: '#6366F1',
  p2p_link: '#06B6D4', nas: '#8B5CF6', ups: '#F87171', printer: '#84CC16',
  cctv: '#14B8A6', access_control: '#C084FC', other: '#9CA3AF',
  internet: '#22c55e',
};

const VENDOR_COLORS = {
  'firewall:Fortinet': '#DC2626', 'firewall:Sophos': '#EA580C',
  'core_switch:Cisco': '#2563EB', 'core_switch:HP': '#0891B2',
  'access_point:Ruckus': '#EC4899', 'access_point:Fortinet': '#F59E0B',
  'access_point:Aruba': '#06B6D4', 'access_point:Cambium': '#8B5CF6',
  'access_point:Cisco': '#3B82F6', 'access_point:Netgear': '#84CC16',
  'router:Cisco': '#FB923C',
};

function getDeviceColor(type, make) {
  if (make) {
    const key = `${type}:${make}`;
    if (VENDOR_COLORS[key]) return VENDOR_COLORS[key];
  }
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

/* ── Status ring styles ── */
const STATUS_CFG = {
  up:       { label: 'Online',   color: '#22c55e', dash: 'none',  width: 2   },
  down:     { label: 'Offline',  color: '#ef4444', dash: 'none',  width: 2.5 },
  degraded: { label: 'Degraded', color: '#f59e0b', dash: '4,3',   width: 2   },
  unknown:  { label: 'Unknown',  color: '#6b7280', dash: '2,2',   width: 1.5 },
};

/* ── Edge / link styles ── */
const TUNNEL_TYPES = new Set(['router', 'firewall', 'p2p_link']);

const EDGE_STYLES = {
  fiber:   { color: '#F97316',                  width: 2,   dash: 'none', opacity: 0.7 },
  copper:  { color: 'rgba(148,163,184,0.30)',   width: 0.8, dash: 'none', opacity: 1   },
  tunnel:  { color: '#06B6D4',                  width: 2,   dash: '8,4',  opacity: 0.7 },
  wan:     { color: '#22c55e',                  width: 2.5, dash: 'none', opacity: 0.8 },
  unknown: { color: 'rgba(148,163,184,0.12)',   width: 0.8, dash: 'none', opacity: 1   },
};

function getEdgeStyle(edge) {
  if (edge.isWanLink) return EDGE_STYLES.wan;
  if (edge.isTunnel)  return EDGE_STYLES.tunnel;
  if (edge.mediaType === 'fiber')  return EDGE_STYLES.fiber;
  if (edge.mediaType === 'copper') return EDGE_STYLES.copper;
  return EDGE_STYLES.unknown;
}

function classifyEdgeMedia(edge, nodeMap) {
  if (nodeMap) {
    const s = nodeMap.get(edge.source);
    const t = nodeMap.get(edge.target);
    if (s && t && TUNNEL_TYPES.has(s.type) && TUNNEL_TYPES.has(t.type)) return 'tunnel';
  }
  if (edge.mediaType === 'fiber')  return 'fiber';
  if (edge.mediaType === 'copper') return 'copper';
  return 'unknown';
}

/* ── Tier system ── */
const TIER_ORDER = {
  internet: -1, firewall: 0, router: 0, core_switch: 1, p2p_link: 1,
  access_switch: 2, access_point: 3, server: 3, nas: 3,
  ups: 4, printer: 4, cctv: 4, access_control: 4, other: 4,
};

const TIER_LABELS = [
  'Internet',
  'Firewalls & Routers',
  'Core / Distribution',
  'Secondary Core',
  'Access Switches',
  'Daisy-Chained Switches',
  'APs \u00b7 Servers \u00b7 Endpoints',
  'Peripherals',
];

const TYPE_NAMES = {
  firewall: 'Firewall', core_switch: 'Core Switch', access_switch: 'Access Switch',
  access_point: 'Access Point', router: 'Router', server: 'Server', nas: 'NAS',
  ups: 'UPS', cctv: 'CCTV', printer: 'Printer', access_control: 'Access Control',
  p2p_link: 'P2P Link', other: 'Other',
};

const TYPE_ABBR = {
  firewall: 'FW', core_switch: 'CS', access_switch: 'AS', access_point: 'AP',
  router: 'RT', server: 'SV', nas: 'NA', ups: 'UP', cctv: 'CC',
  printer: 'PR', access_control: 'AC', p2p_link: 'P2', internet: 'WAN',
  other: '\u00b7\u00b7',
};

const CABLE_FILTER_OPTIONS = [
  { value: 'all',     label: 'All Links' },
  { value: 'fiber',   label: 'Fiber' },
  { value: 'copper',  label: 'Copper' },
  { value: 'tunnel',  label: 'Tunnel' },
  { value: 'wan',     label: 'WAN' },
];

/* ── Layout constants ── */
const TIER_Y          = { '-1': 10, 0: 80, 1: 200, 1.5: 268, 2: 360, 2.5: 428, 3: 520, 4: 630 };
const TIER_RADIUS_MAP = { '-1': 14, 0: 26, 1: 22, 1.5: 20, 2: 14, 2.5: 12, 3: 10, 4: 8 };
const TIER_MIN_SPACE  = { '-1': 60, 0: 100, 1: 90, 1.5: 80, 2: 60, 2.5: 50, 3: 36, 4: 30 };

const INTERNET_NODE_ID = '__internet__';

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};


// ═══════════════════════════════════════════════════════════════════
//  SECTION 2: HIERARCHY BUILDER (BFS with same-tier chaining)
// ═══════════════════════════════════════════════════════════════════

function buildHierarchy(nodes, edges, expandedClusters) {
  const nm = new Map();
  for (const n of nodes) nm.set(n.id, { ...n, tier: TIER_ORDER[n.type] ?? 4, children: [] });

  // Build adjacency list
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source).add(e.target);
      adj.get(e.target).add(e.source);
    }
  }

  // Bucket nodes by tier
  const tiers = [[], [], [], [], []];
  const internetNodes = [];
  for (const n of nm.values()) {
    if (n.tier < 0) { internetNodes.push(n); continue; }
    tiers[Math.min(n.tier, 4)].push(n);
  }

  const parented = new Set();
  const attached = new Set();
  const roots = [];

  // Phase 0: Internet nodes
  for (const n of internetNodes) attached.add(n.id);

  // Phase 1: Tier 0 are always roots
  for (const n of tiers[0]) { attached.add(n.id); roots.push(n); }

  // Phase 2: Tier 1 — attach to tier 0 or become independent root
  for (const node of tiers[1]) {
    const nb = adj.get(node.id) || new Set();
    let bestParent = null;
    for (const id of nb) {
      const n = nm.get(id);
      if (n && attached.has(n.id) && n.tier < node.tier) { bestParent = n; break; }
    }
    if (bestParent) {
      bestParent.children.push(node);
      parented.add(node.id);
    } else {
      roots.push(node);
    }
    attached.add(node.id);
  }

  // Phase 3: Tier 2+ — BFS flood-fill within each tier
  for (let t = 2; t <= 4; t++) {
    const tierNodes = tiers[t];
    const remaining = new Set(tierNodes.map(n => n.id));

    // Pass A: direct cross-tier parents
    for (const node of tierNodes) {
      const nb = adj.get(node.id) || new Set();
      let bestParent = null, bestTier = 99;
      for (const id of nb) {
        const n = nm.get(id);
        if (n && attached.has(n.id) && n.tier < t && n.tier < bestTier) {
          bestParent = n; bestTier = n.tier;
        }
      }
      if (bestParent) {
        bestParent.children.push(node);
        parented.add(node.id);
        attached.add(node.id);
        remaining.delete(node.id);
      }
    }

    // Pass B: BFS same-tier chaining
    let changed = true;
    while (changed && remaining.size > 0) {
      changed = false;
      for (const nodeId of remaining) {
        const nb = adj.get(nodeId) || new Set();
        let sameTierParent = null;
        for (const id of nb) {
          const n = nm.get(id);
          if (n && attached.has(n.id) && n.tier === t) { sameTierParent = n; break; }
        }
        if (sameTierParent) {
          sameTierParent.children.push(nm.get(nodeId));
          parented.add(nodeId);
          attached.add(nodeId);
          remaining.delete(nodeId);
          changed = true;
        }
      }
    }

    // Remaining orphans at this tier
    for (const nodeId of remaining) attached.add(nodeId);
  }

  // Collect the tree
  const att = new Set();
  function mark(n) { att.add(n.id); for (const c of n.children) mark(c); }
  for (const r of roots) mark(r);

  // Subnet-based orphan clustering
  const orphans = [];
  const subnetGroups = new Map();
  for (const n of nm.values()) {
    if (att.has(n.id)) continue;
    if (n.subnetParentId && nm.has(n.subnetParentId)) {
      if (!subnetGroups.has(n.subnetParentId)) subnetGroups.set(n.subnetParentId, []);
      subnetGroups.get(n.subnetParentId).push(n);
    } else {
      orphans.push(n);
    }
  }

  const clusterNodes = [];
  for (const [parentId, members] of subnetGroups) {
    const parent = nm.get(parentId);
    if (!parent) { orphans.push(...members); continue; }

    if (expandedClusters.has(parentId)) {
      for (const m of members) { parent.children.push(m); att.add(m.id); }
    } else {
      const clusterId = `cluster:${parentId}`;
      const clusterNode = {
        id: clusterId, name: `${members.length} endpoints`, type: 'cluster',
        tier: Math.min((parent.tier ?? 0) + 1, 4), children: [],
        isCluster: true, clusterParentId: parentId, clusterMembers: members,
        clusterCount: members.length, status: 'unknown',
        clusterStatusSummary: summarizeStatuses(members),
      };
      nm.set(clusterId, clusterNode);
      parent.children.push(clusterNode);
      att.add(clusterId);
      clusterNodes.push(clusterNode);
    }
  }

  assignSubTiers(roots);
  return { roots, orphans, nodeMap: nm, adj, clusterNodes, subnetGroups };
}

/** Same-tier children get bumped to sub-tier row (e.g. core→1.5, access→2.5) */
function assignSubTiers(roots) {
  function walk(node) {
    for (const child of node.children) {
      const nt = node.tier, ct = child.tier;
      if (ct === Math.floor(nt) && ct === nt) {
        child.tier = ct + 0.5;
      } else if (Math.floor(nt) === Math.floor(ct) && nt > ct) {
        child.tier = nt;
      }
      walk(child);
    }
  }
  for (const r of roots) walk(r);
}

function summarizeStatuses(members) {
  const counts = { up: 0, down: 0, degraded: 0, unknown: 0 };
  for (const m of members) counts[m.status || 'unknown']++;
  return counts;
}


// ═══════════════════════════════════════════════════════════════════
//  SECTION 3: ROOT ORDERING BY AFFINITY
// ═══════════════════════════════════════════════════════════════════

function orderRootsByAffinity(roots, edges, nodeMap, gwFn) {
  if (roots.length <= 2) return roots;

  const nodeToRoot = new Map();
  function mapToRoot(node, rootId) {
    nodeToRoot.set(node.id, rootId);
    for (const child of node.children) mapToRoot(child, rootId);
  }
  for (const r of roots) mapToRoot(r, r.id);

  const MEDIA_WEIGHTS = { fiber: 10, tunnel: 8, copper: 3, unknown: 1 };
  const affinity = new Map();
  const rootIds = new Set(roots.map(r => r.id));
  const affinityKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;

  if (edges) {
    for (const e of edges) {
      const rootA = nodeToRoot.get(e.source);
      const rootB = nodeToRoot.get(e.target);
      if (!rootA || !rootB || rootA === rootB) continue;
      if (!rootIds.has(rootA) || !rootIds.has(rootB)) continue;
      const key = affinityKey(rootA, rootB);
      const weight = MEDIA_WEIGHTS[e.mediaType] || MEDIA_WEIGHTS.unknown;
      affinity.set(key, (affinity.get(key) || 0) + weight);
    }
  }

  if (affinity.size === 0) {
    return [...roots].sort((a, b) => gwFn(b) - gwFn(a));
  }

  const totalAffinity = new Map();
  for (const r of roots) totalAffinity.set(r.id, 0);
  for (const [key, weight] of affinity) {
    const [a, b] = key.split(':');
    totalAffinity.set(a, (totalAffinity.get(a) || 0) + weight);
    totalAffinity.set(b, (totalAffinity.get(b) || 0) + weight);
  }

  const rootMap = new Map();
  for (const r of roots) rootMap.set(r.id, r);

  const visited = new Set();
  const ordered = [];
  let startId = roots[0].id, maxAff = -1;
  for (const [id, aff] of totalAffinity) {
    if (aff > maxAff) { maxAff = aff; startId = id; }
  }

  let currentId = startId;
  while (ordered.length < roots.length) {
    visited.add(currentId);
    ordered.push(rootMap.get(currentId));
    let bestNext = null, bestWeight = -1;
    for (const r of roots) {
      if (visited.has(r.id)) continue;
      const key = affinityKey(currentId, r.id);
      const w = affinity.get(key) || 0;
      if (w > bestWeight) { bestWeight = w; bestNext = r.id; }
    }
    if (bestNext) { currentId = bestNext; }
    else { for (const r of roots) { if (!visited.has(r.id)) { currentId = r.id; break; } } }
  }

  return ordered;
}


// ═══════════════════════════════════════════════════════════════════
//  SECTION 4: LAYOUT ENGINE
// ═══════════════════════════════════════════════════════════════════

function layoutHierarchy(roots, orphans, edges, nodeMap) {
  const pos = new Map();
  const PAD = 30;
  const CLUSTER_MIN_SPACE = 50;
  const widthCache = new Map();

  const tierY  = (t) => TIER_Y[String(t)]          ?? TIER_Y[Math.min(Math.floor(t), 4)]          ?? 630;
  const tierR  = (t) => TIER_RADIUS_MAP[String(t)]  ?? TIER_RADIUS_MAP[Math.min(Math.floor(t), 4)]  ?? 8;
  const tierMS = (t) => TIER_MIN_SPACE[String(t)]    ?? TIER_MIN_SPACE[Math.min(Math.floor(t), 4)]    ?? 30;

  function getWidth(n) {
    if (widthCache.has(n.id)) return widthCache.get(n.id);
    let w;
    if (n.isCluster) {
      w = CLUSTER_MIN_SPACE;
    } else if (!n.children.length) {
      w = tierMS(n.tier);
    } else {
      w = 0;
      for (const c of n.children) w += getWidth(c);
      w += (n.children.length - 1) * PAD;
      w = Math.max(w, tierMS(n.tier));
    }
    widthCache.set(n.id, w);
    return w;
  }

  function positionSubtree(node, leftX, availWidth) {
    const cx = leftX + availWidth / 2;
    const r = node.isCluster ? 18 : tierR(node.tier);
    pos.set(node.id, { ...node, x: cx, y: tierY(node.tier), radius: r });
    if (!node.children.length) return;
    const childWidths = node.children.map(c => getWidth(c));
    const totalW = childWidths.reduce((s, w) => s + w, 0) + (node.children.length - 1) * PAD;
    let cur = cx - totalW / 2;
    for (let i = 0; i < node.children.length; i++) {
      positionSubtree(node.children[i], cur, childWidths[i]);
      cur += childWidths[i] + PAD;
    }
  }

  // Order roots by affinity and position them
  const ordered = orderRootsByAffinity(roots, edges, nodeMap, getWidth);
  const rootWidths = ordered.map(r => getWidth(r));
  let cur = PAD;
  for (let i = 0; i < ordered.length; i++) {
    positionSubtree(ordered[i], cur, rootWidths[i]);
    cur += rootWidths[i] + PAD * 2;
  }

  // Orphans row at bottom
  if (orphans.length > 0) {
    const oy = TIER_Y[4] + 100;
    for (let i = 0; i < orphans.length; i++) {
      const o = orphans[i];
      pos.set(o.id, { ...o, x: PAD + i * 32, y: oy, radius: tierR(o.tier), isOrphan: true });
    }
  }

  // Position WAN Internet nodes in a row above their parent firewalls (non-overlapping)
  const wanNodes = [];
  for (const n of nodeMap.values()) {
    if (n.isInternet && n.wanParentId) {
      const parentPos = pos.get(n.wanParentId);
      if (parentPos) {
        wanNodes.push({ node: n, parentX: parentPos.x, parentName: parentPos.name });
      }
    }
  }

  if (wanNodes.length > 0) {
    // Sort by parent firewall X position (left to right)
    wanNodes.sort((a, b) => a.parentX - b.parentX);

    const WAN_R = 14;
    const WAN_GAP = 80;
    const wanY = TIER_Y['-1'];

    if (wanNodes.length === 1) {
      const { node, parentX } = wanNodes[0];
      pos.set(node.id, { ...node, x: parentX, y: wanY, radius: WAN_R, isInternet: true });
    } else {
      const positions_x = new Array(wanNodes.length);

      // Start from each firewall-aligned ideal position
      for (let i = 0; i < wanNodes.length; i++) {
        positions_x[i] = wanNodes[i].parentX;
      }

      // Forward pass: enforce minimum spacing left to right
      for (let i = 1; i < wanNodes.length; i++) {
        const minX = positions_x[i - 1] + WAN_GAP;
        if (positions_x[i] < minX) positions_x[i] = minX;
      }

      // Place each WAN node
      for (let i = 0; i < wanNodes.length; i++) {
        const { node } = wanNodes[i];
        pos.set(node.id, {
          ...node,
          x: positions_x[i],
          y: wanY,
          radius: WAN_R,
          isInternet: true,
        });
      }
    }
  }

  // Calculate canvas bounds
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x - p.radius);
    maxX = Math.max(maxX, p.x + p.radius);
    maxY = Math.max(maxY, p.y + p.radius + 30);
  }
  const canvasWidth  = Math.max(maxX - minX + PAD * 4, 800);
  const canvasHeight = Math.max(maxY + 60, 650);

  // Shift all positions so nothing is off-screen left
  const shiftX = PAD * 2 - minX;
  if (shiftX) for (const p of pos.values()) p.x += shiftX;

  return { positions: pos, canvasWidth, canvasHeight };
}


// ═══════════════════════════════════════════════════════════════════
//  SECTION 5: MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TopologyPage() {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);
  const zoomRef = useRef(null);
  const gRef    = useRef(null);
  const router  = useRouter();

  const [data, setData]                       = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState(null);
  const [sites, setSites]                     = useState([]);
  const [selectedSite, setSelectedSite]       = useState('');
  const [selected, setSelected]               = useState(null);
  const [viewDims, setViewDims]               = useState({ w: 1200, h: 700 });
  const [searchQuery, setSearchQuery]         = useState('');
  const [searchResults, setSearchResults]     = useState([]);
  const [highlightedId, setHighlightedId]     = useState(null);
  const [expandedClusters, setExpandedClusters] = useState(new Set());
  const [cableFilter, setCableFilter]         = useState('all');
  // Endpoints shown when category === "all" (via Network/All toggle)
  const [endpointData, setEndpointData]      = useState(null);
  const { category } = useDeviceCategory();
  const { selectedTenantId } = useTenantSwitcher();
  useEffect(() => {
    if (category === "all" && !endpointData) {
      fetch("/api/topology/endpoints").then(r => r.json()).then(d => setEndpointData(d)).catch(e => console.error("Endpoint fetch:", e));
    }
  }, [category]);
  useEffect(() => {
    if (!selectedTenantId) return;
    fetch(`/api/sites?tenantId=${selectedTenantId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSites(d.sites || d || []))
      .catch(() => {});
  }, [selectedTenantId]);

  // ── Fetch topology data ──
  const fetchTopology = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (selectedSite) p.set('site', selectedSite);
      if (category !== 'network') p.set('category', category);
      if (selectedTenantId) p.set('tenantId', selectedTenantId);
      const res = await fetch(`/api/topology?${p}`);
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setSelected(null);
      setHighlightedId(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      setError(`Failed to load topology data${err.message ? ` (${err.message})` : ''}`);
    } finally {
      setLoading(false);
    }
  }, [selectedSite, category, selectedTenantId]);

  useEffect(() => { fetchTopology(); }, [fetchTopology]);

  // ── ResizeObserver for graph dimensions ──
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setViewDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Cluster toggle ──
  const toggleCluster = useCallback((parentId) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  }, []);

  // ── Raw node map for edge media classification ──
  const rawNodeMap = useMemo(() => {
    if (!data?.nodes) return new Map();
    const m = new Map();
    for (const n of data.nodes) m.set(n.id, n);
    return m;
  }, [data]);

  // ── Inject WAN nodes + apply cable filter ──
  const filteredView = useMemo(() => {
    if (!data?.nodes || !data?.edges) return null;

    let nodes = data.nodes;
    let edges = data.edges;

    // Inject per-firewall WAN Internet nodes
    const wanLinks = data.wanLinks || [];
    if (wanLinks.length > 0) {
      const wanByDevice = new Map();
      for (const wl of wanLinks) {
        if (!wanByDevice.has(wl.deviceId)) wanByDevice.set(wl.deviceId, []);
        wanByDevice.get(wl.deviceId).push(wl);
      }

      const internetNodes = [];
      const wanEdges = [];
      for (const [deviceId, links] of wanByDevice) {
        const nodeId = `__wan_${deviceId}__`;
        internetNodes.push({
          id: nodeId, name: 'Internet', type: 'internet', status: 'up',
          isInternet: true, tier: -1, wanParentId: deviceId, wanLinks: links,
        });
        wanEdges.push({
          source: deviceId, target: nodeId,
          sourceInterface: links.map(l => l.interfaceName).join(', '),
          targetInterface: null, mediaType: 'wan',
          wanIp: links.map(l => l.wanIp).filter(Boolean).join(', '),
          isWanLink: true,
        });
      }
      nodes = [...internetNodes, ...nodes];
      edges = [...edges, ...wanEdges];
    }

    if (cableFilter === 'all') return { nodes, edges, isFiltered: false };

    // Filter by cable type
    const matchingEdges = [];
    const visibleNodeIds = new Set();
    for (const e of edges) {
      const mc = e.isWanLink ? 'wan' : classifyEdgeMedia(e, rawNodeMap);
      if (mc === cableFilter) {
        matchingEdges.push(e);
        visibleNodeIds.add(e.source);
        visibleNodeIds.add(e.target);
      }
    }
    return { nodes: nodes.filter(n => visibleNodeIds.has(n.id)), edges: matchingEdges, isFiltered: true };
  }, [data, cableFilter, rawNodeMap]);

  // ── Compute layout ──
  const layout = useMemo(() => {
    if (!filteredView?.nodes?.length) return null;
    const { roots, orphans, nodeMap, adj, clusterNodes, subnetGroups } =
      buildHierarchy(filteredView.nodes, filteredView.edges, expandedClusters);
    const { positions, canvasWidth, canvasHeight } =
      layoutHierarchy(roots, orphans, filteredView.edges, nodeMap);
    return { positions, canvasWidth, canvasHeight, nodeMap, adj, clusterNodes, subnetGroups };
  }, [filteredView, expandedClusters]);

  // ── Search ──
  useEffect(() => {
    if (!searchQuery.trim() || !data?.nodes) {
      setSearchResults([]);
      if (!searchQuery.trim()) setHighlightedId(null);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    setSearchResults(
      data.nodes.filter(n =>
        (n.name || '').toLowerCase().includes(q) ||
        (n.ipAddress || '').toLowerCase().includes(q) ||
        (n.serialNumber || '').toLowerCase().includes(q) ||
        (n.model || '').toLowerCase().includes(q) ||
        (n.make || '').toLowerCase().includes(q)
      ).slice(0, 8)
    );
  }, [searchQuery, data]);

  // ── Locate device (pan + zoom + highlight) ──
  const locateDevice = useCallback((id) => {
    if (!layout || !svgRef.current || !zoomRef.current) return;
    const p = layout.positions.get(id);
    if (!p) return;
    setHighlightedId(id);
    setSearchResults([]);
    setSearchQuery('');
    const { w, h } = viewDims;
    const s = 1.5;
    d3.select(svgRef.current)
      .transition().duration(600).ease(d3.easeCubicInOut)
      .call(zoomRef.current.transform,
        d3.zoomIdentity.translate(w / 2 - p.x * s, h / 2 - p.y * s).scale(s));
    const node = layout.nodeMap.get(id);
    if (node) setSelected(node);
    setTimeout(() => setHighlightedId(null), 4000);
  }, [layout, viewDims]);

  // ── Zoom controls ──
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomRef.current)
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
  }, []);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current || !layout) return;
    const { w, h } = viewDims;
    const pad = 40;
    const s = Math.min((w - pad * 2) / layout.canvasWidth, (h - pad * 2) / layout.canvasHeight, 1.0);
    d3.select(svgRef.current)
      .transition().duration(500)
      .call(zoomRef.current.transform,
        d3.zoomIdentity
          .translate((w - layout.canvasWidth * s) / 2, (h - layout.canvasHeight * s) / 2 + pad / 2)
          .scale(s));
  }, [layout, viewDims]);


  // ═══════════════════════════════════════════════════════════════
  //  D3 RENDER
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!filteredView || !layout || !svgRef.current || !filteredView.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = viewDims;
    const { positions, canvasWidth, canvasHeight, adj } = layout;

    const g = svg.append('g').attr('class', 'tp-main-group');
    gRef.current = g.node();

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.08, 4])
      .on('zoom', (ev) => g.attr('transform', ev.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    // ── Tier separator lines ──
    const tierYEntries = Object.entries(TIER_Y);
    const usedTiers = new Set();
    for (const p of positions.values()) {
      if (p.isCluster) continue;
      for (const [tk, ty] of tierYEntries) {
        if (Math.abs(p.y - ty) < 5) usedTiers.add(tk);
      }
    }
    for (const tk of usedTiers) {
      const y = TIER_Y[tk] - 35;
      const tierIdx = tierYEntries.findIndex(([k]) => k === tk);
      g.append('line')
        .attr('x1', 0).attr('x2', canvasWidth)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', 'rgba(148,163,184,0.06)').attr('stroke-width', 1);
      g.append('text')
        .attr('x', 8).attr('y', y - 6)
        .attr('font-size', 9).attr('fill', 'rgba(148,163,184,0.3)')
        .attr('font-weight', 600).attr('letter-spacing', '0.06em')
        
        .text(({"-1":"Internet","0":"Firewalls & Routers","1":"Core / Distribution","1.5":"Secondary Core","2":"Access Switches","2.5":"Daisy-Chained Switches","3":"APs · Servers · Endpoints","4":"Peripherals"})[tk] || '')
;
    }

    // ── Edges ──
    const linkG = g.append('g').attr('class', 'tp-links');
    const edgePaths = [];

    for (const e of filteredView.edges) {
      const s = positions.get(e.source), t = positions.get(e.target);
      if (!s || !t) continue;
      const isTunnel = !e.isWanLink && TUNNEL_TYPES.has(s.type) && TUNNEL_TYPES.has(t.type);
      edgePaths.push({
        source: s, target: t, isTunnel, mediaType: e.mediaType || null,
        isClusterEdge: false, isWanLink: e.isWanLink || false,
        wanIp: e.wanIp || null, sourceInterface: e.sourceInterface || null,
      });
    }

    // Synthetic cluster edges
    for (const p of positions.values()) {
      if (p.isCluster && p.clusterParentId) {
        const parent = positions.get(p.clusterParentId);
        if (parent) edgePaths.push({ source: parent, target: p, isTunnel: false, mediaType: null, isClusterEdge: true });
      }
    }
    // Expanded cluster member edges
    if (expandedClusters.size > 0 && layout.subnetGroups) {
      for (const parentId of expandedClusters) {
        const members = layout.subnetGroups.get(parentId);
        if (!members) continue;
        const parent = positions.get(parentId);
        if (!parent) continue;
        for (const m of members) {
          const mp = positions.get(m.id);
          if (mp) edgePaths.push({ source: parent, target: mp, isTunnel: false, mediaType: null, isClusterEdge: true });
        }
      }
    }

    linkG.selectAll('path').data(edgePaths).join('path')
      .attr('d', e => {
        const dy = e.target.y - e.source.y;
        const dx = e.target.x - e.source.x;
        if (e.isClusterEdge) return `M${e.source.x},${e.source.y} L${e.target.x},${e.target.y}`;
        // Same-tier: arc above
        if (Math.abs(dy) < 10) {
          const mx = (e.source.x + e.target.x) / 2;
          const my = e.source.y - Math.min(30, Math.abs(dx) * 0.15);
          return `M${e.source.x},${e.source.y} Q${mx},${my} ${e.target.x},${e.target.y}`;
        }
        // Cross-tier: S-curve
        const my = (e.source.y + e.target.y) / 2;
        return `M${e.source.x},${e.source.y} C${e.source.x},${my} ${e.target.x},${my} ${e.target.x},${e.target.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', e => e.isClusterEdge ? 'rgba(148,163,184,0.15)' : getEdgeStyle(e).color)
      .attr('stroke-width', e => e.isClusterEdge ? 1 : getEdgeStyle(e).width)
      .attr('stroke-dasharray', e => e.isClusterEdge ? '4,4' : getEdgeStyle(e).dash)
      .attr('stroke-opacity', e => e.isClusterEdge ? 0.6 : getEdgeStyle(e).opacity);

    // ── Nodes ──
    const nodeG = g.append('g').attr('class', 'tp-nodes');
    const nd = Array.from(positions.values());
    const node = nodeG.selectAll('g').data(nd, d => d.id).join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer');

    const internetG = node.filter(d => d.isInternet);
    const clusterG  = node.filter(d => d.isCluster && !d.isInternet);
    const regularG  = node.filter(d => !d.isCluster && !d.isInternet);

    // ── Internet WAN node rendering ──
    internetG.each(function(d) {
      const el = d3.select(this);
      const r = 18;

      // Outer glow ring
      el.append('circle').attr('r', r + 4)
        .attr('fill', 'none').attr('stroke', '#22c55e')
        .attr('stroke-width', 1).attr('stroke-opacity', 0.15)
        .attr('stroke-dasharray', '3,3');

      // Main circle
      el.append('circle').attr('r', r)
        .attr('fill', '#22c55e08').attr('stroke', '#22c55e')
        .attr('stroke-width', 1.5).attr('stroke-opacity', 0.7);

      // "WAN" label inside
      el.append('text')
        .attr('y', -2).attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
        .attr('font-size', 7).attr('font-weight', 700).attr('fill', '#22c55e')
        .attr('pointer-events', 'none').text('WAN');

      // Public IP(s) inside circle, below WAN label
      if (d.wanLinks && d.wanLinks.length > 0) {
        const ipText = d.wanLinks.map(wl => wl.wanIp).filter(Boolean).join(', ');
        if (ipText) {
          el.append('text')
            .attr('y', 7).attr('text-anchor', 'middle')
            .attr('font-size', 5).attr('fill', '#22c55e').attr('opacity', 0.6)
            .attr('font-family', 'system-ui, sans-serif')
            .attr('pointer-events', 'none')
            .text(ipText.length > 16 ? ipText.slice(0, 15) + '\u2026' : ipText);
        }
      }

      // Firewall name below the circle (from parent device)
      if (d.wanParentId) {
        const parentNode = layout.nodeMap.get(d.wanParentId);
        if (parentNode) {
          const fname = parentNode.name || '';
          el.append('text')
            .attr('y', r + 12).attr('text-anchor', 'middle')
            .attr('font-size', 7).attr('fill', 'rgba(148,163,184,0.4)')
            .attr('pointer-events', 'none')
            .text(fname.length > 18 ? fname.slice(0, 17) + '\u2026' : fname);
        }
      }
    });

    // ── Cluster node rendering ──
    clusterG.append('rect')
      .attr('x', -18).attr('y', -14).attr('width', 36).attr('height', 28)
      .attr('rx', 8).attr('ry', 8)
      .attr('fill', 'rgba(156,163,175,0.08)')
      .attr('stroke', 'rgba(156,163,175,0.25)')
      .attr('stroke-width', 1.5).attr('stroke-dasharray', '3,2');

    clusterG.each(function(d) {
      const el = d3.select(this);
      const ss = d.clusterStatusSummary || {};
      el.append('circle').attr('cx', -5).attr('cy', -2).attr('r', 4)
        .attr('fill', ss.up > 0 ? '#22c55e20' : '#6b728020')
        .attr('stroke', ss.up > 0 ? '#22c55e' : '#6b7280').attr('stroke-width', 1);
      el.append('circle').attr('cx', 5).attr('cy', -2).attr('r', 4)
        .attr('fill', ss.down > 0 ? '#ef444420' : '#6b728020')
        .attr('stroke', ss.down > 0 ? '#ef4444' : '#6b7280').attr('stroke-width', 1);
    });

    clusterG.append('text')
      .attr('y', 24).attr('text-anchor', 'middle')
      .attr('font-size', 9).attr('font-weight', 600)
      .attr('fill', 'rgba(148,163,184,0.6)')
      .text(d => `${d.clusterCount} devices`);
    clusterG.append('text')
      .attr('y', 35).attr('text-anchor', 'middle')
      .attr('font-size', 7).attr('fill', 'rgba(148,163,184,0.35)')
      .text('click to expand');
    clusterG.on('click', (ev, d) => {
      ev.stopPropagation();
      if (d.clusterParentId) toggleCluster(d.clusterParentId);
    });

    // ── Regular device rendering ──
    // Status ring
    regularG.append('circle').attr('class', 'node-ring')
      .attr('r', d => d.radius + 3).attr('fill', 'none')
      .attr('stroke', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).color)
      .attr('stroke-width', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).width)
      .attr('stroke-dasharray', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).dash)
      .attr('stroke-opacity', 0.5);

    // Body circle
    regularG.append('circle').attr('class', 'node-body')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const c = getDeviceColor(d.type, d.make);
        return d.tier <= 1.5 ? c + '30' : c + '1A';
      })
      .attr('stroke', d => getDeviceColor(d.type, d.make))
      .attr('stroke-width', d => d.tier <= 1.5 ? 2.5 : 1.5);

    // Type abbreviation label (inside node)
    regularG.filter(d => d.radius >= 10)
      .append('text')
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(7, d.radius * 0.55))
      .attr('font-weight', 700)
      .attr('fill', d => getDeviceColor(d.type, d.make))
      .attr('pointer-events', 'none')
      .text(d => TYPE_ABBR[d.type] || '?');

    // Device name label (below node, tier 0-2 only)
    regularG.filter(d => d.tier <= 2)
      .append('text')
      .attr('y', d => d.radius + 11).attr('text-anchor', 'middle')
      .attr('font-size', d => d.tier <= 1.5 ? 9 : 7)
      .attr('fill', 'rgba(148,163,184,0.55)')
      .attr('pointer-events', 'none')
      .text(d => {
        const n = d.name || '';
        const maxLen = d.tier <= 1.5 ? 20 : 14;
        return n.length > maxLen ? n.slice(0, maxLen - 1) + '\u2026' : n;
      });

    // Vendor label (below name, tier 0-1.5 only)
    regularG.filter(d => d.tier <= 1.5 && d.make)
      .append('text')
      .attr('y', d => d.radius + 22).attr('text-anchor', 'middle')
      .attr('font-size', 7)
      .attr('fill', d => getDeviceColor(d.type, d.make) + '80')
      .attr('font-weight', 500).attr('pointer-events', 'none')
      .text(d => d.make);
    // ── Endpoint nodes + connection lines ──
    if (category === "all" && endpointData?.byDevice) {
      const epLinkG = g.append('g').attr('class', 'tp-endpoint-links');
      const epNodeG = g.append('g').attr('class', 'tp-endpoint-nodes');
      const EP_R = 4;
      const EP_Y_OFFSET = 55;
      const EP_SPACING = 12;
      const MAX_VISIBLE = 30; // Max endpoints to draw per device

      for (const [deviceId, info] of Object.entries(endpointData.byDevice)) {
        const parentPos = positions.get(deviceId);
        if (!parentPos) continue;
        const eps = info.endpoints || [];
        if (eps.length === 0) continue;

        // Sort: wired first, then wireless
        eps.sort((a, b) => {
          if (a.connectionType === b.connectionType) return 0;
          return a.connectionType === 'wired' ? -1 : 1;
        });

        const visible = eps.slice(0, MAX_VISIBLE);
        const totalWidth = (visible.length - 1) * EP_SPACING;
        const startX = parentPos.x - totalWidth / 2;
        const epY = parentPos.y + EP_Y_OFFSET;

        for (let ei = 0; ei < visible.length; ei++) {
          const ep = visible[ei];
          const epX = startX + ei * EP_SPACING;
          const isWireless = ep.connectionType === 'wireless';
          const epColor = isWireless ? '#A855F7' : '#3B82F6';

          // S-curve connection line from parent to endpoint
          const ly = parentPos.y + parentPos.radius + 2;
          const my = (ly + epY) / 2;
          epLinkG.append('path')
            .attr('d', `M${parentPos.x},${ly} C${parentPos.x},${my} ${epX},${my} ${epX},${epY}`)
            .attr('fill', 'none')
            .attr('stroke', epColor)
            .attr('stroke-width', isWireless ? 0.8 : 0.6)
            .attr('stroke-dasharray', isWireless ? '3,2' : 'none')
            .attr('stroke-opacity', 0.35);

          // Endpoint dot
          const epGrp = epNodeG.append('g')
            .attr('transform', `translate(${epX},${epY})`)
            .attr('cursor', 'pointer');

          epGrp.append('circle')
            .attr('r', EP_R)
            .attr('fill', epColor + '25')
            .attr('stroke', epColor)
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 0.7);

          // Hover tooltip
          const tip = [
            ep.manufacturer || 'Unknown',
            ep.mac || '',
            ep.ip || 'No IP',
            isWireless ? 'Wireless' + (ep.apName ? ' via ' + ep.apName.replace(/ \(.*\)/, '') : '') : 'Wired Port ' + (ep.port || '?'),
          ].join('\n');
          epGrp.append('title').text(tip);
          epGrp.on('click', (ev) => {
            ev.stopPropagation();
            setSelected({
              isEndpoint: true,
              name: ep.hostname || ep.manufacturer || 'Endpoint',
              mac: ep.mac,
              ipAddress: ep.ip || null,
              manufacturer: ep.manufacturer || 'Unknown',
              connectionType: ep.connectionType,
              port: ep.port,
              apName: ep.apName,
              switchName: ep.switchName || info.deviceName,
              parentDeviceId: deviceId,
            });
          });
        }

        // Count badge next to parent device
        const total = eps.length;
        const wCount = eps.filter(e => e.connectionType === 'wired').length;
        const wlCount = eps.filter(e => e.connectionType === 'wireless').length;
        const badgeX = parentPos.x + parentPos.radius + 6;
        const badgeY = parentPos.y - 6;
        const label = total + ' ep';
        const bw = Math.max(28, label.length * 7 + 8);

        epNodeG.append('rect')
          .attr('x', badgeX).attr('y', badgeY - 7)
          .attr('width', bw).attr('height', 14)
          .attr('rx', 7)
          .attr('fill', wlCount > 0 ? 'rgba(168,85,247,0.8)' : 'rgba(59,130,246,0.8)');
        epNodeG.append('text')
          .attr('x', badgeX + bw / 2).attr('y', badgeY + 3)
          .attr('text-anchor', 'middle').attr('font-size', '8px')
          .attr('fill', '#fff').attr('font-weight', '600')
          .attr('pointer-events', 'none').text(label);

        // Overflow indicator
        if (eps.length > MAX_VISIBLE) {
          const overX = startX + MAX_VISIBLE * EP_SPACING;
          epNodeG.append('text')
            .attr('x', overX + 8).attr('y', epY + 3)
            .attr('font-size', '8px').attr('fill', 'rgba(148,163,184,0.5)')
            .text('+' + (eps.length - MAX_VISIBLE));
        }
      }
    }
    // ── Click handlers ──
    regularG.on('click', (ev, d) => {
      ev.stopPropagation();
      setSelected(prev => prev?.id === d.id ? null : d);
    });
    regularG.on('dblclick', (ev, d) => {
      ev.stopPropagation();
      if (!d.isInternet) router.push(`/devices/${d.id}`);
    });

    // ── Hover highlight ──
    node.on('mouseenter', (ev, d) => {
      if (d.isCluster) return;
      const nId = d.id;
      const conn = new Set([nId]);
      const nb = adj.get(nId);
      if (nb) for (const x of nb) conn.add(x);

      linkG.selectAll('path')
        .attr('stroke', e => {
          if (e.isClusterEdge) return 'rgba(148,163,184,0.15)';
          return (e.source.id === nId || e.target.id === nId) ? getEdgeStyle(e).color : 'rgba(148,163,184,0.03)';
        })
        .attr('stroke-width', e => {
          if (e.isClusterEdge) return 1;
          return (e.source.id === nId || e.target.id === nId) ? getEdgeStyle(e).width + 1 : 0.4;
        })
        .attr('stroke-opacity', e => {
          if (e.isClusterEdge) return 0.3;
          return (e.source.id === nId || e.target.id === nId) ? 1 : 0.3;
        });
      nodeG.selectAll('g').attr('opacity', n => conn.has(n.id) ? 1 : 0.15);
    });

    node.on('mouseleave', () => {
      linkG.selectAll('path')
        .attr('stroke', e => e.isClusterEdge ? 'rgba(148,163,184,0.15)' : getEdgeStyle(e).color)
        .attr('stroke-width', e => e.isClusterEdge ? 1 : getEdgeStyle(e).width)
        .attr('stroke-opacity', e => e.isClusterEdge ? 0.6 : getEdgeStyle(e).opacity);
      nodeG.selectAll('g').attr('opacity', 1);
    });

    // Click background to deselect
    svg.on('click', () => { setSelected(null); setHighlightedId(null); });

    // Auto-fit on load
    requestAnimationFrame(() => {
      const pad = 40;
      const s = Math.min((w - pad * 2) / canvasWidth, (h - pad * 2) / canvasHeight, 1.0);
      svg.call(zoom.transform,
        d3.zoomIdentity
          .translate((w - canvasWidth * s) / 2, (h - canvasHeight * s) / 2 + pad / 2)
          .scale(s));
    });
  }, [filteredView, layout, viewDims, expandedClusters, toggleCluster, router]);


  // ── Highlight ring animation ──
  useEffect(() => {
    if (!gRef.current || !layout) return;
    const g = d3.select(gRef.current);
    const ng = g.select('.tp-nodes').selectAll('g');

    if (!highlightedId) {
      ng.attr('opacity', 1);
      ng.selectAll('.node-highlight-ring').remove();
      return;
    }

    ng.attr('opacity', d => d.id === highlightedId ? 1 : 0.12);
    ng.each(function(d) {
      const el = d3.select(this);
      el.selectAll('.node-highlight-ring').remove();
      if (d.id === highlightedId) {
        // Expanding ring animation
        el.append('circle').attr('class', 'node-highlight-ring')
          .attr('r', d.radius + 8).attr('fill', 'none')
          .attr('stroke', '#FBBF24').attr('stroke-width', 3).attr('stroke-opacity', 1)
          .transition().duration(600).ease(d3.easeLinear)
          .attr('r', d.radius + 22).attr('stroke-opacity', 0)
          .on('end', function() { d3.select(this).remove(); });
        // Static dashed ring
        el.append('circle').attr('class', 'node-highlight-ring')
          .attr('r', d.radius + 6).attr('fill', 'none')
          .attr('stroke', '#FBBF24').attr('stroke-width', 2.5).attr('stroke-dasharray', '4,3');
      }
    });
  }, [highlightedId, layout]);


  // ═══════════════════════════════════════════════════════════════
  //  COMPUTED DATA FOR LEGEND & INSPECTOR
  // ═══════════════════════════════════════════════════════════════

  const legendGroups = useMemo(() => {
    if (!data?.nodes) return [];
    const gm = new Map();
    for (const n of data.nodes) {
      let key, label, so;
      if (n.type === 'access_point' && n.make) {
        key = `ap:${n.make}`; label = `AP \u00b7 ${n.make}`; so = 30;
      } else if (n.type === 'firewall' && n.make) {
        key = `fw:${n.make}`; label = `FW \u00b7 ${n.make}`; so = 1;
      } else if (n.type === 'core_switch' && n.make) {
        key = `cs:${n.make}`; label = `Core \u00b7 ${n.make}`; so = 10;
      } else {
        key = `type:${n.type}`;
        const tn = (n.type || 'other').replace(/_/g, ' ');
        label = tn.charAt(0).toUpperCase() + tn.slice(1);
        so = (TIER_ORDER[n.type] ?? 4) * 10 + 5;
      }
      if (!gm.has(key)) gm.set(key, { color: getDeviceColor(n.type, n.make), label, count: 0, sortOrder: so });
      gm.get(key).count++;
    }
    return Array.from(gm.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  const edgeMediaCounts = useMemo(() => {
    if (!data?.edges) return {};
    const c = { fiber: 0, copper: 0, tunnel: 0, wan: 0, unknown: 0 };
    for (const e of data.edges) c[classifyEdgeMedia(e, rawNodeMap)]++;
    if (data.wanLinks) c.wan = data.wanLinks.length;
    return c;
  }, [data, rawNodeMap]);

  const clusterSummary = useMemo(() => {
    if (!data?.subnetClusters) return null;
    const total = data.subnetClusters.reduce((s, c) => s + c.count, 0);
    if (total === 0) return null;
    return { clusters: data.subnetClusters.length, devices: total };
  }, [data]);

  const neighborsWithPorts = useMemo(() => {
    if (!selected || !data || selected.isCluster) return [];
    const result = [];
    for (const e of data.edges) {
      let neighborId = null, localPort = null, remotePort = null;
      if (e.source === selected.id) {
        neighborId = e.target; localPort = e.sourceInterface; remotePort = e.targetInterface;
      } else if (e.target === selected.id) {
        neighborId = e.source; localPort = e.targetInterface; remotePort = e.sourceInterface;
      }
      if (!neighborId) continue;
      const neighbor = data.nodes.find(n => n.id === neighborId);
      if (!neighbor) continue;
      result.push({ ...neighbor, localPort, remotePort, linkType: classifyEdgeMedia(e, rawNodeMap) });
    }
    return result;
  }, [selected, data, rawNodeMap]);


  // ═══════════════════════════════════════════════════════════════
  //  LEGEND HIGHLIGHT HELPERS
  // ═══════════════════════════════════════════════════════════════

  const highlightByColor = useCallback((color) => {
    if (!gRef.current || !layout) return;
    const nodeG = d3.select(gRef.current).select('.tp-nodes');
    const linkG = d3.select(gRef.current).select('.tp-links');
    const matchIds = new Set();
    for (const [id, p] of layout.positions) {
      if (getDeviceColor(p.type, p.make) === color) matchIds.add(id);
    }
    nodeG.selectAll('g').attr('opacity', n => matchIds.has(n.id) ? 1 : 0.08);
    linkG.selectAll('path').attr('stroke-opacity', 0.05);
    setTimeout(() => {
      nodeG.selectAll('g').attr('opacity', 1);
      linkG.selectAll('path').each(function(e) {
        d3.select(this).attr('stroke-opacity', e.isClusterEdge ? 0.6 : getEdgeStyle(e).opacity);
      });
    }, 3000);
  }, [layout]);

  const highlightByStatus = useCallback((status) => {
    if (!gRef.current || !layout) return;
    const nodeG = d3.select(gRef.current).select('.tp-nodes');
    const linkG = d3.select(gRef.current).select('.tp-links');
    const matchIds = new Set();
    for (const [id, p] of layout.positions) {
      if (p.status === status) matchIds.add(id);
    }
    nodeG.selectAll('g').attr('opacity', n => matchIds.has(n.id) ? 1 : 0.08);
    linkG.selectAll('path').attr('stroke-opacity', 0.05);
    setTimeout(() => {
      nodeG.selectAll('g').attr('opacity', 1);
      linkG.selectAll('path').each(function(e) {
        d3.select(this).attr('stroke-opacity', e.isClusterEdge ? 0.6 : getEdgeStyle(e).opacity);
      });
    }, 3000);
  }, [layout]);

  const filterLabel = cableFilter !== 'all' ? ` (${cableFilter} only)` : '';


  // ═══════════════════════════════════════════════════════════════
  //  JSX RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      <motion.div
        initial="hidden" animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
        className="tp-root"
      >
        {/* ── Header ── */}
        <motion.div variants={fadeUp} className="tp-header">
          <div>
            <p className="tp-subtitle">
              {data
                ? `${filteredView?.nodes?.length ?? data.nodes.length} devices \u00b7 ${filteredView?.edges?.length ?? data.edges.length} connections${filterLabel}`
                : 'Loading\u2026'}
              {clusterSummary && cableFilter === 'all'
                ? ` \u00b7 ${clusterSummary.devices} endpoints in ${clusterSummary.clusters} subnet clusters`
                : ''}
            </p>
          </div>
          <div className="tp-header-actions">
            <select value={cableFilter} onChange={e => setCableFilter(e.target.value)} className="tp-cable-select" title="Filter by link type">
              {CABLE_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}{edgeMediaCounts[o.value] != null && o.value !== 'all' ? ` (${edgeMediaCounts[o.value]})` : ''}
                </option>
              ))}
            </select>
            {sites.length > 0 && (
              <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)} className="tp-site-select">
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button onClick={fetchTopology} className="tp-refresh-btn" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--color-vemio-text-muted)' }} />
            </button>
          </div>
        </motion.div>

        {/* ── Graph + Legend Row ── */}
        <div className="tp-graph-row">

          {/* ── Graph Panel ── */}
          <motion.div variants={fadeUp} className="tp-graph-panel">
            {/* Search bar */}
            <div className="tp-search-bar">
              <Search className="tp-search-icon w-4 h-4" />
              <input
                type="text"
                className="tp-search-input"
                placeholder="Search devices by name, IP, model, serial..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="tp-search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]); setHighlightedId(null); }}>
                  <X className="w-3 h-3" />
                </button>
              )}
              {searchResults.length > 0 && (
                <div className="tp-search-dropdown">
                  {searchResults.map(n => (
                    <button key={n.id} className="tp-search-result" onClick={() => locateDevice(n.id)}>
                      <span className="tp-sr-dot" style={{ background: getDeviceColor(n.type, n.make) }} />
                      <span className="tp-sr-name">{n.name}</span>
                      <span className="tp-sr-meta">{n.ipAddress || TYPE_ABBR[n.type]}</span>
                      <ChevronRight className="tp-sr-locate w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div ref={wrapRef} className="tp-graph-wrap">
              {loading && !data && (
                <div className="tp-loading">
                  <div className="tp-loading-spinner" />
                  <span>Building topology, hold on a sec</span>
                </div>
              )}
              {error && (
                <div className="tp-empty">
                  <Network className="w-10 h-10" style={{ color: 'var(--color-vemio-text-dim)', marginBottom: 8 }} />
                  <p>{error}</p>
                  <button onClick={fetchTopology} className="tp-retry-btn">Retry</button>
                </div>
              )}
              {!loading && filteredView && !filteredView.nodes.length && (
                <div className="tp-empty">
                  <Network className="w-10 h-10" style={{ color: 'var(--color-vemio-text-dim)', marginBottom: 8 }} />
                  <p>{cableFilter !== 'all' ? `No ${cableFilter} connections found` : 'No topology data available yet'}</p>
                  {cableFilter !== 'all' && <button onClick={() => setCableFilter('all')} className="tp-retry-btn">Show all links</button>}
                </div>
              )}
              <svg ref={svgRef} width={viewDims.w} height={viewDims.h} style={{ display: filteredView && filteredView.nodes.length ? 'block' : 'none' }} />
              {filteredView && filteredView.nodes.length > 0 && (
                <div className="tp-zoom-controls">
                  <button onClick={handleZoomIn} className="tp-zoom-btn" title="Zoom in"><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={handleZoomOut} className="tp-zoom-btn" title="Zoom out"><Minus className="w-3.5 h-3.5" /></button>
                  <button onClick={handleFitView} className="tp-zoom-btn" title="Fit to view"><Maximize2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── Sidebar Legend ── */}
          {data && data.nodes.length > 0 && (
            <motion.div variants={fadeUp} className="tp-legend-panel">
              {/* Devices group */}
              <div className="tp-legend-group">
                <span className="tp-legend-group-title">Devices</span>
                {legendGroups.map(g => (
                  <button key={g.label} className="tp-legend-btn" onClick={() => highlightByColor(g.color)}>
                    <span className="tp-legend-btn-dot" style={{ background: g.color }} />
                    <span className="tp-legend-btn-label">{g.label}</span>
                    <span className="tp-legend-btn-count">{g.count}</span>
                  </button>
                ))}
              </div>

              {/* Links group */}
              <div className="tp-legend-group">
                <span className="tp-legend-group-title">Links</span>
                {edgeMediaCounts.fiber > 0 && (
                  <button className="tp-legend-btn" onClick={() => setCableFilter(f => f === 'fiber' ? 'all' : 'fiber')}>
                    <span className="tp-legend-btn-line" style={{ background: EDGE_STYLES.fiber.color }} />
                    <span className="tp-legend-btn-label">Fiber</span>
                    <span className="tp-legend-btn-count">{edgeMediaCounts.fiber}</span>
                  </button>
                )}
                {edgeMediaCounts.copper > 0 && (
                  <button className="tp-legend-btn" onClick={() => setCableFilter(f => f === 'copper' ? 'all' : 'copper')}>
                    <span className="tp-legend-btn-line" style={{ background: 'rgba(148,163,184,0.5)' }} />
                    <span className="tp-legend-btn-label">Copper</span>
                    <span className="tp-legend-btn-count">{edgeMediaCounts.copper}</span>
                  </button>
                )}
                {edgeMediaCounts.tunnel > 0 && (
                  <button className="tp-legend-btn" onClick={() => setCableFilter(f => f === 'tunnel' ? 'all' : 'tunnel')}>
                    <span className="tp-legend-btn-line tp-legend-btn-line--dashed" style={{ borderColor: '#06B6D4' }} />
                    <span className="tp-legend-btn-label">Tunnel</span>
                    <span className="tp-legend-btn-count">{edgeMediaCounts.tunnel}</span>
                  </button>
                )}
                {edgeMediaCounts.wan > 0 && (
                  <button className="tp-legend-btn" onClick={() => setCableFilter(f => f === 'wan' ? 'all' : 'wan')}>
                    <span className="tp-legend-btn-line" style={{ background: '#22c55e' }} />
                    <span className="tp-legend-btn-label">WAN</span>
                    <span className="tp-legend-btn-count">{edgeMediaCounts.wan}</span>
                  </button>
                )}
                {edgeMediaCounts.unknown > 0 && (
                  <button className="tp-legend-btn" onClick={() => setCableFilter(f => f === 'unknown' ? 'all' : 'unknown')}>
                    <span className="tp-legend-btn-line" style={{ background: 'rgba(148,163,184,0.2)' }} />
                    <span className="tp-legend-btn-label">Unclassified</span>
                    <span className="tp-legend-btn-count">{edgeMediaCounts.unknown}</span>
                  </button>
                )}
              </div>

              {/* Status group */}
              <div className="tp-legend-group">
                <span className="tp-legend-group-title">Status</span>
                {Object.entries(STATUS_CFG).map(([k, c]) => (
                  <button key={k} className="tp-legend-btn" onClick={() => highlightByStatus(k)}>
                    <span className="tp-legend-btn-ring" style={{
                      borderColor: c.color,
                      borderStyle: c.dash === 'none' ? 'solid' : c.dash === '4,3' ? 'dashed' : 'dotted',
                    }} />
                    <span className="tp-legend-btn-label">{c.label}</span>
                  </button>
                ))}
              </div>

              {/* Clusters group */}
              {clusterSummary && cableFilter === 'all' && (
                <div className="tp-legend-group">
                  <span className="tp-legend-group-title">Clusters</span>
                  <span className="tp-legend-btn">
                    <span className="tp-legend-btn-cluster" />
                    <span className="tp-legend-btn-label">Subnet Groups</span>
                    <span className="tp-legend-btn-count">{clusterSummary.clusters}</span>
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* ═══════════ INSPECTOR PANEL ═══════════ */}
        <AnimatePresence>
          {/* Regular device inspector */}
          {selected && !selected.isCluster && !selected.isInternet && !selected.isEndpoint && (
            <motion.div
              key="inspector"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25 }}
              className="tp-inspector"
            >
              <div className="tp-insp-header">
                <h3 className="tp-insp-title">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="tp-insp-close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="tp-insp-badges">
                <span className="tp-insp-badge" style={{
                  background: (STATUS_CFG[selected.status] || STATUS_CFG.unknown).color + '18',
                  color: (STATUS_CFG[selected.status] || STATUS_CFG.unknown).color,
                }}>
                  <span className="tp-insp-dot" style={{ background: (STATUS_CFG[selected.status] || STATUS_CFG.unknown).color }} />
                  {(STATUS_CFG[selected.status] || STATUS_CFG.unknown).label}
                </span>
                <span className="tp-insp-badge" style={{
                  background: getDeviceColor(selected.type, selected.make) + '18',
                  color: getDeviceColor(selected.type, selected.make),
                }}>
                  {TYPE_NAMES[selected.type] || selected.type?.replace(/_/g, ' ')}
                  {selected.make ? ` \u00b7 ${selected.make}` : ''}
                </span>
              </div>

              <div className="tp-insp-fields">
                <Field label="Type" value={TYPE_NAMES[selected.type] || selected.type?.replace(/_/g, ' ')} />
                <Field label="IP Address" value={selected.ipAddress} mono />
                <Field label="Make" value={selected.make} />
                <Field label="Model" value={selected.model} />
                <Field label="Serial" value={selected.serialNumber} mono />
                <Field label="Site" value={selected.siteName} />
                {selected.subnetGatewayIp && <Field label="Subnet Gateway" value={selected.subnetGatewayIp} mono />}
              </div>

              {/* WAN Connections (for firewalls) */}
              {data?.wanLinks?.filter(wl => wl.deviceId === selected.id).length > 0 && (
                <div className="tp-insp-wan">
                  <span className="tp-insp-wan-title">WAN Connections</span>
                  {data.wanLinks.filter(wl => wl.deviceId === selected.id).map((wl, i) => (
                    <div key={i} className="tp-insp-wan-item">
                      <span className="tp-insp-wan-dot" />
                      <div className="tp-insp-wan-info">
                        <span className="tp-insp-wan-ip">{wl.wanIp || 'No IP'}</span>
                        <span className="tp-insp-wan-port">
                          {wl.interfaceName}
                          {wl.speed ? ` \u00b7 ${wl.speed >= 1000000000 ? (wl.speed / 1000000000) + 'G' : wl.speed >= 1000000 ? (wl.speed / 1000000) + 'M' : wl.speed}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button className="tp-insp-view-btn" onClick={() => router.push(`/devices/${selected.id}`)}>
                <ChevronRight size={14} /> View device details
              </button>

              {/* Neighbors */}
              {neighborsWithPorts.length > 0 && (
                <div className="tp-insp-neighbors">
                  <span className="tp-insp-nbr-title">Connected ({neighborsWithPorts.length})</span>
                  <div className="tp-insp-nbr-list">
                    {neighborsWithPorts.slice(0, 30).map(n => (
                      <button key={n.id} className="tp-insp-nbr-item" onClick={() => {
                        setSelected(data.nodes.find(nd => nd.id === n.id) || n);
                        locateDevice(n.id);
                      }}>
                        <span className="tp-insp-dot" style={{ background: getDeviceColor(n.type, n.make), width: 6, height: 6 }} />
                        <div className="tp-insp-nbr-info">
                          <span className="tp-insp-nbr-name">{n.name}</span>
                          <span className="tp-insp-nbr-ports">
                            {n.localPort && <span className="tp-port-tag">{n.localPort}</span>}
                            {n.localPort && n.remotePort && <span className="tp-port-arrow">{'\u2194'}</span>}
                            {n.remotePort && <span className="tp-port-tag">{n.remotePort}</span>}
                            {n.linkType && n.linkType !== 'unknown' && (
                              <span className={`tp-link-tag tp-link-tag--${n.linkType}`}>{n.linkType}</span>
                            )}
                          </span>
                        </div>
                        <span className="tp-insp-nbr-type" style={{ color: getDeviceColor(n.type, n.make) }}>
                          {TYPE_ABBR[n.type]}{n.make ? ' \u00b7 ' + n.make : ''}
                        </span>
                      </button>
                    ))}
                    {neighborsWithPorts.length > 30 && (
                      <span className="tp-insp-nbr-more">+{neighborsWithPorts.length - 30} more</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}


          {/* Endpoint inspector */}
          {selected && selected.isEndpoint && (
            <motion.div
              key="endpoint-inspector"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25 }}
              className="tp-inspector"
            >
              <div className="tp-insp-header">
                <h3 className="tp-insp-title">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="tp-insp-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="tp-insp-badges">
                <span className="tp-insp-badge" style={{ background: selected.connectionType === "wireless" ? "rgba(168,85,247,0.15)" : "rgba(59,130,246,0.15)", color: selected.connectionType === "wireless" ? "#A855F7" : "#3B82F6" }}>
                  {selected.connectionType === "wireless" ? "Wireless" : "Wired"}
                </span>
                <span className="tp-insp-badge" style={{ background: "rgba(148,163,184,0.1)", color: "rgba(148,163,184,0.8)" }}>
                  Endpoint
                </span>
              </div>
              <div className="tp-insp-fields">
                <Field label="MAC Address" value={selected.mac} mono />
                <Field label="IP Address" value={selected.ipAddress || "No IP"} mono />
                <Field label="Manufacturer" value={selected.manufacturer} />
                <Field label="Connection" value={selected.connectionType === "wireless" ? "Wireless" + (selected.apName ? " via " + selected.apName.replace(/ \(.*\)/, "") : "") : "Wired Port " + (selected.port || "?")} />
                <Field label="Connected To" value={selected.switchName || selected.apName || "Unknown"} />
              </div>
            </motion.div>
          )}

          {/* Cluster inspector */}
          {selected && selected.isCluster && (
            <motion.div
              key="cluster-inspector"
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25 }}
              className="tp-inspector"
            >
              <div className="tp-insp-header">
                <h3 className="tp-insp-title">Subnet Cluster</h3>
                <button onClick={() => setSelected(null)} className="tp-insp-close"><X className="w-4 h-4" /></button>
              </div>
              <div className="tp-insp-badges">
                <span className="tp-insp-badge" style={{ background: 'rgba(156,163,175,0.12)', color: '#9CA3AF' }}>
                  {selected.clusterCount} devices
                </span>
              </div>
              <div className="tp-insp-fields">
                <Field label="Gateway" value={(() => {
                  const p = layout?.nodeMap?.get(selected.clusterParentId);
                  return p?.name || 'Unknown';
                })()} />
                <Field label="Status" value={(() => {
                  const ss = selected.clusterStatusSummary || {};
                  const parts = [];
                  if (ss.up) parts.push(`${ss.up} up`);
                  if (ss.down) parts.push(`${ss.down} down`);
                  if (ss.degraded) parts.push(`${ss.degraded} degraded`);
                  if (ss.unknown) parts.push(`${ss.unknown} unknown`);
                  return parts.join(', ');
                })()} />
              </div>
              <button className="tp-cluster-expand-btn" onClick={() => {
                if (selected.clusterParentId) toggleCluster(selected.clusterParentId);
                setSelected(null);
              }}>
                <ChevronRight size={14} /> Expand to show all {selected.clusterCount} devices
              </button>
              {selected.clusterMembers && selected.clusterMembers.length > 0 && (
                <div className="tp-insp-neighbors">
                  <span className="tp-insp-nbr-title">Devices in cluster</span>
                  <div className="tp-insp-nbr-list">
                    {selected.clusterMembers.slice(0, 30).map(n => (
                      <div key={n.id} className="tp-insp-nbr-item" style={{ cursor: 'default' }}>
                        <span className="tp-insp-dot" style={{ background: getDeviceColor(n.type, n.make), width: 6, height: 6 }} />
                        <span className="tp-insp-nbr-name">{n.name}</span>
                        <span className="tp-insp-nbr-type" style={{ color: (STATUS_CFG[n.status] || STATUS_CFG.unknown).color }}>
                          {(STATUS_CFG[n.status] || STATUS_CFG.unknown).label}
                        </span>
                      </div>
                    ))}
                    {selected.clusterMembers.length > 30 && (
                      <span className="tp-insp-nbr-more">+{selected.clusterMembers.length - 30} more</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ═══════════ STYLES ═══════════ */}
      <style>{`
        /* ── Layout ── */
        .tp-root { display: flex; flex-direction: column; gap: 12px; max-width: 1600px; position: relative; }
        .tp-graph-row { display: flex; gap: 12px; align-items: flex-start; }
        .tp-graph-row .tp-graph-panel { flex: 1; min-width: 0; }
        @media (max-width: 1023px) {
          .tp-graph-row { flex-direction: column; }
          .tp-legend-panel { max-height: 200px; }
        }

        /* ── Header ── */
        .tp-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .tp-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 0; }
        .tp-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
        .tp-cable-select,
        .tp-site-select {
          padding: 8px 12px; border-radius: 8px; font-size: 13px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text); outline: none; cursor: pointer;
        }
        .tp-cable-select { min-width: 110px; }
        .tp-site-select { min-width: 140px; }
        .tp-refresh-btn {
          padding: 8px; border-radius: 8px; border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface); cursor: pointer; display: flex;
          align-items: center; transition: background 0.15s;
        }
        .tp-refresh-btn:hover { background: var(--color-vemio-surface-raised); }

        /* ── Graph Panel ── */
        .tp-graph-panel {
          border-radius: 16px; overflow: hidden;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
          position: relative;
        }

        /* ── Search Bar ── */
        .tp-search-bar {
          position: relative; padding: 10px 14px; display: flex; align-items: center;
          border-bottom: 1px solid var(--color-vemio-border);
        }
        .tp-search-icon {
          position: absolute; left: 24px; top: 50%; transform: translateY(-50%);
          color: var(--vemio-text-muted); pointer-events: none;
        }
        .tp-search-input {
          width: 100%; padding: 7px 28px 7px 32px; font-size: 13px; border-radius: 8px;
          background: var(--color-vemio-bg); border: 1px solid rgba(255,255,255,0.06);
          color: var(--vemio-text); outline: none; transition: border-color 0.15s;
        }
        .tp-search-input::placeholder { color: rgba(148,163,184,0.4); }
        .tp-search-input:focus { border-color: rgba(245,158,11,0.3); }
        .tp-search-clear {
          position: absolute; right: 22px; top: 50%; transform: translateY(-50%);
          border: none; background: rgba(148,163,184,0.15); border-radius: 50%;
          width: 18px; height: 18px; display: flex; align-items: center;
          justify-content: center; cursor: pointer; color: var(--vemio-text-muted);
        }
        .tp-search-dropdown {
          position: absolute; top: calc(100% - 2px); left: 14px; right: 14px;
          background: var(--color-vemio-bg); border: 1px solid var(--color-vemio-border);
          border-radius: 10px; z-index: 30; padding: 4px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4); max-height: 280px; overflow-y: auto;
        }
        .tp-search-result {
          display: flex; align-items: center; gap: 8px; padding: 8px 10px;
          border-radius: 7px; border: none; background: transparent; cursor: pointer;
          width: 100%; text-align: left; transition: background 0.1s; color: inherit;
        }
        .tp-search-result:hover { background: rgba(255,255,255,0.04); }
        .tp-sr-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .tp-sr-name { font-size: 13px; color: var(--vemio-text); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tp-sr-meta { font-size: 11px; color: var(--color-vemio-text-dim); font-family: monospace; }
        .tp-sr-locate { color: var(--color-vemio-text-dim); flex-shrink: 0; }

        /* ── Graph Viewport ── */
        .tp-graph-wrap { width: 100%; height: clamp(500px, 70vh, 900px); position: relative; overflow: hidden; }
        .tp-graph-wrap svg { display: block; }

        /* ── Zoom Controls ── */
        .tp-zoom-controls { position: absolute; bottom: 12px; right: 12px; display: flex; flex-direction: column; gap: 2px; z-index: 10; }
        .tp-zoom-btn {
          padding: 7px; border-radius: 8px; border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface); cursor: pointer; display: flex;
          align-items: center; justify-content: center; color: var(--color-vemio-text-muted);
          transition: background 0.15s;
        }
        .tp-zoom-btn:hover { background: var(--color-vemio-surface-raised); }

        /* ── Loading & Empty States ── */
        .tp-loading {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 12px;
          font-size: 13px; color: var(--color-vemio-text-dim);
        }
        .tp-loading-spinner {
          width: 28px; height: 28px;
          border: 2.5px solid rgba(148,163,184,0.15);
          border-top-color: rgba(245,158,11,0.6);
          border-radius: 50%; animation: tp-spin 0.8s linear infinite;
        }
        @keyframes tp-spin { to { transform: rotate(360deg); } }
        .tp-empty {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 6px;
          font-size: 13px; color: var(--color-vemio-text-muted);
        }
        .tp-retry-btn {
          margin-top: 8px; padding: 6px 16px; border-radius: 8px; font-size: 12px;
          background: var(--color-vemio-surface-raised); border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text); cursor: pointer;
        }

        /* ── Sidebar Legend ── */
        .tp-legend-panel {
          width: 200px; flex-shrink: 0; border-radius: 16px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
          padding: 12px; display: flex; flex-direction: column; gap: 12px;
          max-height: clamp(500px, 70vh, 900px); overflow-y: auto;
        }
        .tp-legend-group { display: flex; flex-direction: column; gap: 2px; }
        .tp-legend-group-title {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
          font-weight: 600; color: var(--color-vemio-text-dim);
          padding: 0 6px 4px; border-bottom: 1px solid var(--color-vemio-border); margin-bottom: 2px;
        }
        .tp-legend-btn {
          display: flex; align-items: center; gap: 6px; padding: 4px 6px;
          border-radius: 6px; border: none; background: transparent; cursor: pointer;
          text-align: left; color: inherit; font-family: inherit; font-size: 11px;
          transition: background 0.12s; width: 100%;
        }
        .tp-legend-btn:hover { background: rgba(255,255,255,0.04); }
        .tp-legend-btn-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .tp-legend-btn-line { width: 14px; height: 2px; border-radius: 1px; flex-shrink: 0; }
        .tp-legend-btn-line--dashed { width: 14px; height: 0; border-top: 2px dashed; background: none; }
        .tp-legend-btn-ring {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid; background: transparent;
        }
        .tp-legend-btn-cluster {
          width: 12px; height: 8px; border-radius: 3px; flex-shrink: 0;
          border: 1.5px dashed rgba(156,163,175,0.4); background: rgba(156,163,175,0.06);
        }
        .tp-legend-btn-label {
          flex: 1; color: var(--color-vemio-text-muted); overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap;
        }
        .tp-legend-btn-count {
          font-size: 10px; color: var(--color-vemio-text-dim);
          font-variant-numeric: tabular-nums; flex-shrink: 0;
        }

        /* ── Inspector Panel ── */
        .tp-inspector {
          position: absolute; top: 52px; right: 0; width: 340px;
          max-height: calc(100% - 64px); overflow-y: auto;
          background: var(--color-vemio-bg); border: 1px solid var(--color-vemio-border);
          border-radius: 14px; padding: 16px; z-index: 20;
          display: flex; flex-direction: column; gap: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        }
        @media (max-width: 639px) {
          .tp-inspector {
            position: fixed; top: auto; bottom: 0; left: 0; right: 0;
            width: 100%; max-height: 55vh; border-radius: 16px 16px 0 0;
          }
        }
        .tp-insp-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .tp-insp-title {
          font-size: 14px; font-weight: 600; color: var(--vemio-text); margin: 0;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tp-insp-close {
          padding: 4px; border-radius: 6px; border: none; background: transparent;
          color: var(--color-vemio-text-dim); cursor: pointer; display: flex; flex-shrink: 0;
        }
        .tp-insp-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .tp-insp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px; font-size: 10px;
          font-weight: 600; letter-spacing: 0.04em;
        }
        .tp-insp-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .tp-insp-fields { display: flex; flex-direction: column; gap: 8px; }
        .tp-field { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .tp-field-label { font-size: 11px; color: var(--color-vemio-text-dim); flex-shrink: 0; }
        .tp-field-value {
          font-size: 12px; color: var(--color-vemio-text-muted); text-align: right;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: capitalize;
        }
        .tp-field-value--mono { font-family: monospace; font-size: 11px; text-transform: none; }

        /* ── WAN section in inspector ── */
        .tp-insp-wan {
          display: flex; flex-direction: column; gap: 4px; padding: 8px 10px;
          border-radius: 8px; background: rgba(34,197,94,0.04);
          border: 1px solid rgba(34,197,94,0.12);
        }
        .tp-insp-wan-title {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em;
          font-weight: 600; color: #22c55e; margin-bottom: 2px;
        }
        .tp-insp-wan-item { display: flex; align-items: center; gap: 6px; }
        .tp-insp-wan-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
        .tp-insp-wan-info { display: flex; flex-direction: column; gap: 1px; }
        .tp-insp-wan-ip { font-size: 12px; font-family: monospace; color: #22c55e; font-weight: 600; }
        .tp-insp-wan-port { font-size: 9px; color: var(--color-vemio-text-dim); }

        /* ── View / Expand buttons ── */
        .tp-insp-view-btn,
        .tp-cluster-expand-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 12px;
          border-radius: 8px; border: 1px solid var(--color-vemio-border);
          background: rgba(245,158,11,0.06); color: var(--color-vemio-amber);
          font-size: 12px; font-weight: 500; cursor: pointer; transition: background 0.15s;
          width: 100%;
        }
        .tp-insp-view-btn:hover,
        .tp-cluster-expand-btn:hover { background: rgba(245,158,11,0.12); }

        /* ── Neighbors section ── */
        .tp-insp-neighbors {
          display: flex; flex-direction: column; gap: 6px;
          border-top: 1px solid var(--color-vemio-border); padding-top: 12px;
        }
        .tp-insp-nbr-title {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em;
          font-weight: 600; color: var(--color-vemio-text-dim);
        }
        .tp-insp-nbr-list { display: flex; flex-direction: column; gap: 2px; max-height: 280px; overflow-y: auto; }
        .tp-insp-nbr-item {
          display: flex; align-items: flex-start; gap: 6px; padding: 6px 8px;
          border-radius: 6px; border: none; background: transparent; cursor: pointer;
          text-align: left; transition: background 0.12s; color: inherit;
        }
        .tp-insp-nbr-item:hover { background: rgba(255,255,255,0.04); }
        .tp-insp-nbr-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
        .tp-insp-nbr-name {
          font-size: 12px; color: var(--vemio-text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tp-insp-nbr-ports { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
        .tp-port-tag {
          font-size: 9px; font-family: monospace; color: var(--color-vemio-text-dim);
          background: rgba(148,163,184,0.08); padding: 1px 5px; border-radius: 3px;
        }
        .tp-port-arrow { font-size: 9px; color: var(--color-vemio-text-dim); }
        .tp-link-tag {
          font-size: 8px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; padding: 1px 5px; border-radius: 3px;
        }
        .tp-link-tag--fiber { background: rgba(249,115,22,0.12); color: #F97316; }
        .tp-link-tag--copper { background: rgba(148,163,184,0.12); color: rgba(148,163,184,0.7); }
        .tp-link-tag--tunnel { background: rgba(6,182,212,0.12); color: #06B6D4; }
        .tp-insp-nbr-type { font-size: 9px; font-weight: 600; flex-shrink: 0; margin-top: 2px; }
        .tp-insp-nbr-more { font-size: 11px; color: var(--color-vemio-text-dim); padding: 4px 8px; }
      `}</style>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════
//  SECTION 6: HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function Field({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="tp-field">
      <span className="tp-field-label">{label}</span>
      <span className={`tp-field-value ${mono ? 'tp-field-value--mono' : ''}`}>{value}</span>
    </div>
  );
}