'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, X, RefreshCw, Globe,
  Shield, MonitorSpeaker, Wifi, HardDrive, Radio, Cpu, Server,
  Printer, Camera, Lock, Zap, CircleDot, ChevronDown, ChevronRight,
  Minus, Plus, Maximize2,
} from 'lucide-react';
import * as d3 from 'd3';

/* ── Status config ── */
const STATUS_CONFIG = {
  up:       { label: 'Online',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  down:     { label: 'Offline',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  degraded: { label: 'Degraded', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  unknown:  { label: 'Unknown',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)'},
};

/* ── Device type → icon component ── */
const TYPE_ICONS = {
  firewall:       Shield,
  core_switch:    MonitorSpeaker,
  access_switch:  MonitorSpeaker,
  access_point:   Wifi,
  router:         Radio,
  server:         Cpu,
  nas:            HardDrive,
  ups:            Zap,
  cctv:           Camera,
  access_control: Lock,
  printer:        Printer,
  p2p_link:       Globe,
  other:          CircleDot,
};

/* ── Tier definitions: device_type → tier index ── */
const TIER_ORDER = {
  firewall:       0,
  router:         0,
  core_switch:    1,
  access_switch:  2,
  access_point:   3,
  server:         3,
  p2p_link:       1,
  nas:            3,
  ups:            4,
  printer:        4,
  cctv:           4,
  access_control: 4,
  other:          4,
};

const TIER_LABELS = [
  'Firewalls & Routers',
  'Core / L3 Switches',
  'Access / L2 Switches',
  'APs · Servers · Endpoints',
  'Peripherals',
];

/* ── Node sizing by tier ── */
const TIER_RADIUS = { 0: 24, 1: 22, 2: 14, 3: 11, 4: 9 };
const CLUSTER_HEAD_RADIUS = 28; // Collapsed cluster node size

/* ── Type abbreviations ── */
const TYPE_ABBR = {
  firewall: 'FW', core_switch: 'CS', access_switch: 'AS',
  access_point: 'AP', router: 'RT', server: 'SV',
  nas: 'NA', ups: 'UP', cctv: 'CC', printer: 'PR',
  access_control: 'AC', p2p_link: 'P2', other: '?',
};

/* ── Network device types (tier 0–1 stay in top rows) ── */
const TOP_TIER_TYPES = new Set([
  'firewall', 'router', 'core_switch', 'p2p_link',
]);

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ================================================================
   CLUSTER TREE BUILDER
   ================================================================
   Builds parent→children relationships from edges.
   - Tier 0–1 nodes stay as top-row nodes.
   - Each tier-1 node (core switch) becomes a cluster head.
   - Tier 2 nodes attach to their tier-1 parent via edges.
   - Tier 3+ nodes attach to their tier-2 parent via edges.
   - Orphans (no parent in higher tier) go to "Unassigned" cluster.
   ================================================================ */
function buildClusterTree(nodes, edges) {
  const nodeMap = new Map();
  for (const n of nodes) {
    nodeMap.set(n.id, { ...n, tier: TIER_ORDER[n.type] ?? 4 });
  }

  // Adjacency list
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source).add(e.target);
      adj.get(e.target).add(e.source);
    }
  }

  // Separate top-tier (0–1) from clusterable (2+)
  const topNodes = [];  // tier 0 and 1 — rendered in horizontal rows
  const clusterHeads = []; // tier 1 specifically — these become cluster parents
  const lowerNodes = []; // tier 2+

  for (const n of nodeMap.values()) {
    if (n.tier <= 1) {
      topNodes.push(n);
      if (n.tier === 1) clusterHeads.push(n);
    } else {
      lowerNodes.push(n);
    }
  }

  // Assign tier-2 nodes to their tier-1 parent (direct edge)
  const clusterMap = new Map(); // clusterHeadId → { head, children: [] }
  const assigned = new Set();

  for (const head of clusterHeads) {
    clusterMap.set(head.id, { head, children: [], grandchildren: new Map() });
  }

  // First pass: assign tier-2 nodes to tier-1 parents
  for (const node of lowerNodes) {
    if (node.tier !== 2) continue;
    const neighbors = adj.get(node.id) || new Set();
    let bestParent = null;

    for (const nbId of neighbors) {
      const nb = nodeMap.get(nbId);
      if (nb && nb.tier === 1 && clusterMap.has(nb.id)) {
        bestParent = nb.id;
        break;
      }
    }

    if (bestParent) {
      clusterMap.get(bestParent).children.push(node);
      assigned.add(node.id);
    }
  }

  // Second pass: assign tier-3+ nodes to their tier-2 parent within clusters
  for (const node of lowerNodes) {
    if (node.tier < 3) continue;
    const neighbors = adj.get(node.id) || new Set();
    let parentAccessSwitch = null;

    for (const nbId of neighbors) {
      const nb = nodeMap.get(nbId);
      if (nb && nb.tier === 2 && assigned.has(nb.id)) {
        parentAccessSwitch = nbId;
        break;
      }
    }

    if (parentAccessSwitch) {
      // Find which cluster this access switch belongs to
      for (const [headId, cluster] of clusterMap) {
        if (cluster.children.some(c => c.id === parentAccessSwitch)) {
          if (!cluster.grandchildren.has(parentAccessSwitch)) {
            cluster.grandchildren.set(parentAccessSwitch, []);
          }
          cluster.grandchildren.get(parentAccessSwitch).push(node);
          assigned.add(node.id);
          break;
        }
      }
    }
  }

  // Orphans: tier 2+ not assigned to any cluster
  const orphans = lowerNodes.filter(n => !assigned.has(n.id));

  // Build clusters array
  const clusters = [];
  for (const [headId, cluster] of clusterMap) {
    const totalDescendants = cluster.children.length +
      Array.from(cluster.grandchildren.values()).reduce((s, arr) => s + arr.length, 0);
    if (totalDescendants > 0) {
      clusters.push({
        id: headId,
        head: cluster.head,
        children: cluster.children,
        grandchildren: cluster.grandchildren,
        totalDevices: totalDescendants,
      });
    }
  }

  // Sort clusters by total devices descending (largest first for better layout)
  clusters.sort((a, b) => b.totalDevices - a.totalDevices);

  return {
    topNodes,         // Tier 0–1 nodes (rendered in horizontal rows)
    clusters,         // Each core switch + its sub-tree
    orphans,          // Unassigned tier 2+ nodes
    nodeMap,
    adj,
  };
}

/* ================================================================
   TOPOLOGY PAGE — Clustered Sub-Tree Layout
   ================================================================ */
export default function TopologyPage() {
  const svgRef  = useRef(null);
  const wrapRef = useRef(null);
  const zoomRef = useRef(null);

  const [data, setData]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [sites, setSites]                 = useState([]);
  const [selectedSite, setSelectedSite]   = useState('');
  const [category, setCategory]           = useState('network');
  const [selected, setSelected]           = useState(null);
  const [dimensions, setDimensions]       = useState({ w: 1200, h: 700 });
  const [expandedClusters, setExpandedClusters] = useState(new Set());

  /* ── Fetch sites ── */
  useEffect(() => {
    fetch('/api/sites')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setSites(d.sites || d || []))
      .catch(() => {});
  }, []);

  /* ── Fetch topology data ── */
  const fetchTopology = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedSite) params.set('site', selectedSite);
      if (category !== 'network') params.set('category', category);
      const res = await fetch(`/api/topology?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setSelected(null);
      setExpandedClusters(new Set());
    } catch (err) {
      console.error('Topology fetch error:', err);
      setError('Failed to load topology data');
    } finally {
      setLoading(false);
    }
  }, [selectedSite, category]);

  useEffect(() => { fetchTopology(); }, [fetchTopology]);

  /* ── Resize observer ── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setDimensions({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Build cluster tree ── */
  const tree = useMemo(() => {
    if (!data?.nodes) return null;
    return buildClusterTree(data.nodes, data.edges);
  }, [data]);

  /* ── Toggle cluster expand/collapse ── */
  const toggleCluster = useCallback((clusterId) => {
    setExpandedClusters(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }, []);

  /* ── Expand / Collapse all ── */
  const expandAll = useCallback(() => {
    if (!tree) return;
    const allIds = new Set(tree.clusters.map(c => c.id));
    if (tree.orphans.length > 0) allIds.add('__orphans__');
    setExpandedClusters(allIds);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedClusters(new Set());
  }, []);

  /* ── Zoom controls ── */
  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7);
  }, []);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select('g.tp-main-group');
    if (g.empty()) return;
    const bounds = g.node().getBBox();
    const { w, h } = dimensions;
    const pad = 60;
    const scale = Math.min(
      (w - pad * 2) / (bounds.width || 1),
      (h - pad * 2) / (bounds.height || 1),
      1.2
    );
    const tx = (w - bounds.width * scale) / 2 - bounds.x * scale;
    const ty = (h - bounds.height * scale) / 2 - bounds.y * scale;
    svg.transition().duration(500).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }, [dimensions]);

  /* ================================================================
     D3 RENDER — Clustered Sub-Tree Layout
     ================================================================ */
  useEffect(() => {
    if (!data || !tree || !svgRef.current) return;
    if (!data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = dimensions;
    const { topNodes, clusters, orphans, nodeMap, adj } = tree;

    /* ── Layout constants ── */
    const TOP_PAD = 60;
    const TIER_GAP = 80;       // vertical gap between tier rows
    const CLUSTER_GAP_X = 40;  // horizontal gap between clusters
    const CLUSTER_PAD = 20;    // internal padding in cluster box
    const NODE_GAP_X = 44;     // horizontal gap between child nodes in cluster
    const NODE_GAP_Y = 50;     // vertical gap between tier-2 and tier-3 rows
    const CHILD_ROW_MAX = 12;  // max children per row before wrapping

    /* ── Position top-tier nodes (tier 0, tier 1) ── */
    const tier0 = topNodes.filter(n => n.tier === 0);
    const tier1 = topNodes.filter(n => n.tier === 1);

    const allPositioned = new Map(); // nodeId → { x, y, radius, ...node }

    // Internet icon position
    const internetY = TOP_PAD;
    const tier0Y = TOP_PAD + TIER_GAP;
    const tier1Y = tier0Y + TIER_GAP;

    // Center tier-0 nodes
    const tier0Spacing = Math.min(90, (w - 120) / Math.max(tier0.length, 1));
    const tier0StartX = (w - (tier0.length - 1) * tier0Spacing) / 2;
    for (let i = 0; i < tier0.length; i++) {
      const n = tier0[i];
      allPositioned.set(n.id, {
        ...n, x: tier0StartX + i * tier0Spacing, y: tier0Y,
        radius: TIER_RADIUS[0],
      });
    }

    // Center tier-1 nodes
    const tier1Spacing = Math.min(100, (w - 120) / Math.max(tier1.length, 1));
    const tier1StartX = (w - (tier1.length - 1) * tier1Spacing) / 2;
    for (let i = 0; i < tier1.length; i++) {
      const n = tier1[i];
      allPositioned.set(n.id, {
        ...n, x: tier1StartX + i * tier1Spacing, y: tier1Y,
        radius: TIER_RADIUS[1],
      });
    }

    /* ── Position clusters below tier 1 ── */
    const clusterStartY = tier1Y + TIER_GAP + 20;
    let clusterCursorX = CLUSTER_GAP_X;
    const clusterBounds = []; // { id, x, y, w, h, headX, headY }

    // Include orphans as a virtual cluster
    const allClusterGroups = [...clusters];
    if (orphans.length > 0) {
      allClusterGroups.push({
        id: '__orphans__',
        head: { id: '__orphans__', name: 'Unassigned', type: 'other', status: 'unknown', tier: 1 },
        children: orphans.filter(o => o.tier === 2 || o.tier === 3 || o.tier === 4),
        grandchildren: new Map(),
        totalDevices: orphans.length,
        isOrphan: true,
      });
    }

    for (const cluster of allClusterGroups) {
      const isExpanded = expandedClusters.has(cluster.id);

      if (!isExpanded) {
        // ── COLLAPSED: single node with badge ──
        const cx = clusterCursorX + CLUSTER_HEAD_RADIUS + 10;
        const cy = clusterStartY + CLUSTER_HEAD_RADIUS + 10;
        const nodeData = {
          ...cluster.head,
          x: cx, y: cy,
          radius: CLUSTER_HEAD_RADIUS,
          isClusterHead: true,
          clusterId: cluster.id,
          childCount: cluster.totalDevices,
          isCollapsed: true,
          isOrphan: cluster.isOrphan || false,
        };
        allPositioned.set(`cluster_${cluster.id}`, nodeData);
        clusterBounds.push({
          id: cluster.id,
          x: clusterCursorX,
          y: clusterStartY,
          w: CLUSTER_HEAD_RADIUS * 2 + 20,
          h: CLUSTER_HEAD_RADIUS * 2 + 40,
          headX: cx,
          headY: cy,
        });
        clusterCursorX += CLUSTER_HEAD_RADIUS * 2 + 20 + CLUSTER_GAP_X;
      } else {
        // ── EXPANDED: head + children grid + grandchildren ──
        const children = cluster.children;
        const grandchildren = cluster.grandchildren;

        // Calculate rows for children
        const cols = Math.min(children.length, CHILD_ROW_MAX);
        const rows = Math.ceil(children.length / cols);
        const clusterWidth = Math.max(cols * NODE_GAP_X, 100);

        const clusterX = clusterCursorX;
        const clusterY = clusterStartY;

        // Cluster head at top center of its box
        const headX = clusterX + CLUSTER_PAD + clusterWidth / 2;
        const headY = clusterY + CLUSTER_PAD + 20;
        const headData = {
          ...cluster.head,
          x: headX, y: headY,
          radius: TIER_RADIUS[1],
          isClusterHead: true,
          clusterId: cluster.id,
          childCount: cluster.totalDevices,
          isCollapsed: false,
          isOrphan: cluster.isOrphan || false,
        };
        // Don't double-position the real tier-1 node if it's already in topNodes
        if (!cluster.isOrphan) {
          allPositioned.set(`cluster_${cluster.id}`, headData);
        } else {
          allPositioned.set(`cluster_${cluster.id}`, headData);
        }

        // Position children (tier 2) in grid below head
        const childStartY = headY + 50;
        const childStartX = clusterX + CLUSTER_PAD + (clusterWidth - (cols - 1) * NODE_GAP_X) / 2;
        let maxChildY = childStartY;
        let maxGrandY = childStartY;

        for (let ci = 0; ci < children.length; ci++) {
          const child = children[ci];
          const row = Math.floor(ci / cols);
          const col = ci % cols;
          const cx = childStartX + col * NODE_GAP_X;
          const cy = childStartY + row * NODE_GAP_Y;
          allPositioned.set(child.id, {
            ...child, x: cx, y: cy,
            radius: TIER_RADIUS[2],
            parentCluster: cluster.id,
          });
          maxChildY = Math.max(maxChildY, cy);

          // Position grandchildren (tier 3+) below their parent access switch
          const gc = grandchildren.get(child.id);
          if (gc && gc.length > 0) {
            const gcStartY = cy + NODE_GAP_Y * 0.7;
            const gcSpacing = Math.min(NODE_GAP_X * 0.7, 30);
            const gcStartX = cx - ((gc.length - 1) * gcSpacing) / 2;
            for (let gi = 0; gi < gc.length; gi++) {
              const gNode = gc[gi];
              const gx = gcStartX + gi * gcSpacing;
              const gy = gcStartY;
              allPositioned.set(gNode.id, {
                ...gNode, x: gx, y: gy,
                radius: TIER_RADIUS[gNode.tier] || 9,
                parentCluster: cluster.id,
              });
              maxGrandY = Math.max(maxGrandY, gy);
            }
          }
        }

        const totalHeight = Math.max(maxChildY, maxGrandY) - clusterY + 50;
        const totalWidth = clusterWidth + CLUSTER_PAD * 2;

        clusterBounds.push({
          id: cluster.id,
          x: clusterX,
          y: clusterY,
          w: totalWidth,
          h: totalHeight,
          headX,
          headY,
          isExpanded: true,
        });

        clusterCursorX += totalWidth + CLUSTER_GAP_X;
      }
    }

    /* ── Draw ── */
    const g = svg.append('g').attr('class', 'tp-main-group');

    const zoom = d3.zoom()
      .scaleExtent([0.15, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    // Auto-fit on render
    requestAnimationFrame(() => {
      const bounds = g.node()?.getBBox();
      if (!bounds || bounds.width === 0) return;
      const pad = 50;
      const scale = Math.min(
        (w - pad * 2) / (bounds.width || 1),
        (h - pad * 2) / (bounds.height || 1),
        1.0
      );
      const tx = (w - bounds.width * scale) / 2 - bounds.x * scale;
      const ty = (h - bounds.height * scale) / 2 - bounds.y * scale;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    /* ── Internet icon ── */
    const internetG = g.append('g').attr('transform', `translate(${w / 2}, ${internetY})`);
    internetG.append('circle')
      .attr('r', 18)
      .attr('fill', 'rgba(59,130,246,0.10)')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5);
    internetG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 9).attr('font-weight', 700).attr('fill', '#3b82f6')
      .text('WAN');
    internetG.append('text')
      .attr('y', 28).attr('text-anchor', 'middle')
      .attr('font-size', 8).attr('fill', 'rgba(148,163,184,0.6)')
      .text('Internet');

    // Lines from WAN to tier 0
    for (const n of tier0) {
      const pos = allPositioned.get(n.id);
      if (!pos) continue;
      g.append('line')
        .attr('x1', w / 2).attr('y1', internetY + 18)
        .attr('x2', pos.x).attr('y2', pos.y - pos.radius - 4)
        .attr('stroke', 'rgba(59,130,246,0.18)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');
    }

    /* ── Tier labels ── */
    if (tier0.length > 0) {
      g.append('text')
        .attr('x', 12).attr('y', tier0Y - 28)
        .attr('font-size', 8).attr('fill', 'rgba(148,163,184,0.35)')
        .attr('text-transform', 'uppercase').attr('letter-spacing', '0.08em').attr('font-weight', 600)
        .text(TIER_LABELS[0]);
    }
    if (tier1.length > 0) {
      g.append('text')
        .attr('x', 12).attr('y', tier1Y - 28)
        .attr('font-size', 8).attr('fill', 'rgba(148,163,184,0.35)')
        .attr('text-transform', 'uppercase').attr('letter-spacing', '0.08em').attr('font-weight', 600)
        .text(TIER_LABELS[1]);
      // Separator
      g.append('line')
        .attr('x1', 10).attr('x2', w - 10)
        .attr('y1', tier1Y - 38).attr('y2', tier1Y - 38)
        .attr('stroke', 'rgba(148,163,184,0.06)').attr('stroke-width', 1);
    }

    // Separator above clusters
    if (allClusterGroups.length > 0) {
      g.append('line')
        .attr('x1', 10).attr('x2', Math.max(w, clusterCursorX) - 10)
        .attr('y1', clusterStartY - 15).attr('y2', clusterStartY - 15)
        .attr('stroke', 'rgba(148,163,184,0.06)').attr('stroke-width', 1);
      g.append('text')
        .attr('x', 12).attr('y', clusterStartY - 22)
        .attr('font-size', 8).attr('fill', 'rgba(148,163,184,0.35)')
        .attr('text-transform', 'uppercase').attr('letter-spacing', '0.08em').attr('font-weight', 600)
        .text('Device Clusters');
    }

    /* ── Cluster bounding boxes ── */
    for (const cb of clusterBounds) {
      const cluster = allClusterGroups.find(c => c.id === cb.id);
      const isExpanded = cb.isExpanded;

      // Background rect
      g.append('rect')
        .attr('x', cb.x)
        .attr('y', cb.y)
        .attr('width', cb.w)
        .attr('height', cb.h)
        .attr('rx', 12)
        .attr('fill', isExpanded ? 'rgba(148,163,184,0.03)' : 'rgba(148,163,184,0.02)')
        .attr('stroke', isExpanded ? 'rgba(148,163,184,0.10)' : 'rgba(148,163,184,0.06)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', isExpanded ? 'none' : '4,3')
        .attr('cursor', 'pointer')
        .on('click', (event) => {
          event.stopPropagation();
          toggleCluster(cb.id);
        });

      // Cluster label below box
      const labelText = cluster?.isOrphan
        ? `Unassigned (${cluster.totalDevices})`
        : `${cluster?.head?.name || 'Cluster'} (${cluster?.totalDevices || 0})`;

      g.append('text')
        .attr('x', cb.x + cb.w / 2)
        .attr('y', cb.y + cb.h + 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', 9)
        .attr('fill', 'rgba(148,163,184,0.5)')
        .attr('font-weight', 500)
        .text(labelText.length > 30 ? labelText.slice(0, 28) + '…' : labelText);

      // Expand/collapse icon
      const iconX = cb.x + cb.w - 14;
      const iconY = cb.y + 12;
      g.append('text')
        .attr('x', iconX)
        .attr('y', iconY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-size', 12)
        .attr('fill', 'rgba(148,163,184,0.4)')
        .attr('cursor', 'pointer')
        .text(isExpanded ? '−' : '+')
        .on('click', (event) => {
          event.stopPropagation();
          toggleCluster(cb.id);
        });
    }

    /* ── Edges between top-tier nodes ── */
    const linkG = g.append('g').attr('class', 'tp-links');

    // Collect all edges between nodes that are positioned
    const visibleEdges = [];
    for (const e of data.edges) {
      const src = allPositioned.get(e.source);
      const tgt = allPositioned.get(e.target);
      if (src && tgt) {
        visibleEdges.push({ source: src, target: tgt });
      }
    }

    // Also draw edges from tier-1 to cluster heads (for expanded clusters)
    for (const cb of clusterBounds) {
      if (!cb.isExpanded) continue;
      const cluster = allClusterGroups.find(c => c.id === cb.id);
      if (!cluster || cluster.isOrphan) continue;

      // Draw edge from the real tier-1 position to cluster head position
      const tier1Pos = allPositioned.get(cluster.head.id);
      const clusterHeadPos = allPositioned.get(`cluster_${cluster.id}`);
      if (tier1Pos && clusterHeadPos && tier1Pos !== clusterHeadPos) {
        visibleEdges.push({ source: tier1Pos, target: clusterHeadPos, isDashed: true });
      }

      // Draw edges from cluster head to children
      for (const child of cluster.children) {
        const childPos = allPositioned.get(child.id);
        if (childPos && clusterHeadPos) {
          visibleEdges.push({ source: clusterHeadPos, target: childPos, isInternal: true });
        }
      }

      // Draw edges from children to grandchildren
      for (const [parentId, gcs] of cluster.grandchildren) {
        const parentPos = allPositioned.get(parentId);
        if (!parentPos) continue;
        for (const gc of gcs) {
          const gcPos = allPositioned.get(gc.id);
          if (gcPos) {
            visibleEdges.push({ source: parentPos, target: gcPos, isInternal: true });
          }
        }
      }
    }

    // Also for collapsed clusters: draw edge from tier-1 node to collapsed cluster node
    for (const cb of clusterBounds) {
      if (cb.isExpanded) continue;
      const cluster = allClusterGroups.find(c => c.id === cb.id);
      if (!cluster || cluster.isOrphan) continue;
      const tier1Pos = allPositioned.get(cluster.head.id);
      const collapsedPos = allPositioned.get(`cluster_${cluster.id}`);
      if (tier1Pos && collapsedPos) {
        visibleEdges.push({ source: tier1Pos, target: collapsedPos, isDashed: true });
      }
    }

    // Top-tier inter-node edges
    for (const e of data.edges) {
      const src = allPositioned.get(e.source);
      const tgt = allPositioned.get(e.target);
      if (src && tgt && src.tier <= 1 && tgt.tier <= 1) {
        // Already in visibleEdges from the general pass — skip duplicates
      }
    }

    linkG.selectAll('path')
      .data(visibleEdges)
      .join('path')
      .attr('d', e => {
        const sx = e.source.x, sy = e.source.y;
        const tx = e.target.x, ty = e.target.y;
        if (Math.abs(sy - ty) < 5) {
          const mx = (sx + tx) / 2;
          const my = sy - 25;
          return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
        }
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('fill', 'none')
      .attr('stroke', e => e.isDashed ? 'rgba(245,158,11,0.15)' :
                           e.isInternal ? 'rgba(148,163,184,0.10)' :
                           'rgba(148,163,184,0.12)')
      .attr('stroke-width', e => e.isInternal ? 0.8 : 1)
      .attr('stroke-dasharray', e => e.isDashed ? '4,3' : 'none');

    /* ── Render nodes ── */
    const nodeG = g.append('g').attr('class', 'tp-nodes');
    const allNodeEntries = Array.from(allPositioned.values());

    const node = nodeG.selectAll('g')
      .data(allNodeEntries, d => d.id || `cluster_${d.clusterId}`)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer');

    // Outer glow
    node.append('circle')
      .attr('r', d => d.radius + 3)
      .attr('fill', 'none')
      .attr('stroke', d => {
        if (d.isCollapsed) return 'rgba(245,158,11,0.25)';
        return (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.2);

    // Main circle
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        if (d.isCollapsed) return 'rgba(245,158,11,0.10)';
        const c = (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
        return d.tier <= 1 ? c + '25' : c + '15';
      })
      .attr('stroke', d => {
        if (d.isCollapsed) return 'rgba(245,158,11,0.5)';
        return (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
      })
      .attr('stroke-width', d => d.isClusterHead ? 2 : 1.5);

    // Type abbreviation
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => {
        if (d.isCollapsed) return 10;
        return Math.max(8, d.radius * 0.55);
      })
      .attr('font-weight', 700)
      .attr('fill', d => {
        if (d.isCollapsed) return 'rgba(245,158,11,0.8)';
        return (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
      })
      .attr('pointer-events', 'none')
      .text(d => {
        if (d.isOrphan) return '?';
        return TYPE_ABBR[d.type] || '?';
      });

    // Child count badge for collapsed clusters
    node.filter(d => d.isCollapsed && d.childCount > 0)
      .append('g')
      .attr('transform', d => `translate(${d.radius - 2}, ${-d.radius + 2})`)
      .call(badge => {
        badge.append('rect')
          .attr('x', -12).attr('y', -8)
          .attr('width', 24).attr('height', 16)
          .attr('rx', 8)
          .attr('fill', 'rgba(245,158,11,0.85)');
        badge.append('text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', 8)
          .attr('font-weight', 700)
          .attr('fill', '#000')
          .attr('pointer-events', 'none')
          .text(d => d.childCount);
      });

    // Label below node
    node.append('text')
      .attr('y', d => d.radius + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.isCollapsed ? 9 : d.tier >= 3 ? 7 : 8)
      .attr('fill', 'rgba(148,163,184,0.6)')
      .attr('pointer-events', 'none')
      .text(d => {
        if (d.isOrphan && d.isCollapsed) return 'Unassigned';
        const name = d.name || '';
        const max = d.tier >= 3 ? 12 : 18;
        return name.length > max ? name.slice(0, max - 2) + '…' : name;
      });

    // Click → inspector or toggle cluster
    node.on('click', (event, d) => {
      event.stopPropagation();
      if (d.isClusterHead && d.clusterId) {
        toggleCluster(d.clusterId);
      } else {
        setSelected(prev => prev?.id === d.id ? null : d);
      }
    });

    // Right-click on cluster head → inspector (so users can still inspect)
    node.filter(d => d.isClusterHead).on('contextmenu', (event, d) => {
      event.preventDefault();
      event.stopPropagation();
      setSelected(prev => prev?.id === d.id ? null : d);
    });

    // Hover highlight
    node.on('mouseenter', (event, d) => {
      const nodeId = d.id;
      linkG.selectAll('path')
        .attr('stroke', e => {
          if (e.source.id === nodeId || e.target.id === nodeId ||
              (e.source.clusterId === nodeId) || (e.target.clusterId === nodeId)) {
            return (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
          }
          return e.isDashed ? 'rgba(245,158,11,0.06)' :
                 e.isInternal ? 'rgba(148,163,184,0.04)' :
                 'rgba(148,163,184,0.06)';
        })
        .attr('stroke-width', e => {
          if (e.source.id === nodeId || e.target.id === nodeId) return 2;
          return e.isInternal ? 0.5 : 0.8;
        });
    });

    node.on('mouseleave', () => {
      linkG.selectAll('path')
        .attr('stroke', e => e.isDashed ? 'rgba(245,158,11,0.15)' :
                             e.isInternal ? 'rgba(148,163,184,0.10)' :
                             'rgba(148,163,184,0.12)')
        .attr('stroke-width', e => e.isInternal ? 0.8 : 1);
    });

    // Click background → deselect
    svg.on('click', () => setSelected(null));

  }, [data, tree, dimensions, expandedClusters, toggleCluster]);

  /* ── Counts for legend ── */
  const statusCounts = {};
  const typeCounts = {};
  if (data?.nodes) {
    for (const n of data.nodes) {
      statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
  }

  /* ── Neighbor list for inspector ── */
  const neighbors = [];
  if (selected && data) {
    const neighborIds = new Set();
    for (const e of data.edges) {
      if (e.source === selected.id) neighborIds.add(e.target);
      if (e.target === selected.id) neighborIds.add(e.source);
    }
    for (const n of data.nodes) {
      if (neighborIds.has(n.id)) neighbors.push(n);
    }
  }

  /* ── Cluster summary for header ── */
  const clusterSummary = tree ? `${tree.clusters.length} clusters · ${tree.orphans.length} unassigned` : '';

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
            <h1 className="tp-title">Network Topology</h1>
            <p className="tp-subtitle">
              {data
                ? `${data.nodes.length} devices · ${data.edges.length} connections` +
                  (tree && tree.clusters.length > 0 ? ` · ${clusterSummary}` : '')
                : 'Loading…'}
            </p>
          </div>
          <div className="tp-header-actions">
            {/* Expand/Collapse all */}
            {tree && tree.clusters.length > 0 && (
              <div className="tp-cluster-controls">
                <button
                  onClick={expandAll}
                  className="tp-ctrl-btn"
                  title="Expand all clusters"
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: 'var(--color-vemio-text-muted)' }} />
                  <span>Expand All</span>
                </button>
                <button
                  onClick={collapseAll}
                  className="tp-ctrl-btn"
                  title="Collapse all clusters"
                >
                  <Minus className="w-3.5 h-3.5" style={{ color: 'var(--color-vemio-text-muted)' }} />
                  <span>Collapse All</span>
                </button>
              </div>
            )}

            <div className="tp-category-toggle">
              <button
                onClick={() => setCategory('network')}
                className={`tp-cat-btn ${category === 'network' ? 'tp-cat-btn--active' : ''}`}
              >
                Network
              </button>
              <button
                onClick={() => setCategory('all')}
                className={`tp-cat-btn ${category === 'all' ? 'tp-cat-btn--active' : ''}`}
              >
                All Devices
              </button>
            </div>
            {sites.length > 0 && (
              <select
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                className="tp-site-select"
              >
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <button onClick={fetchTopology} className="tp-refresh-btn" aria-label="Refresh topology">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                style={{ color: 'var(--color-vemio-text-muted)' }} />
            </button>
          </div>
        </motion.div>

        {/* ── Graph area ── */}
        <motion.div variants={fadeUp} className="tp-graph-panel">
          <div ref={wrapRef} className="tp-graph-wrap">
            {loading && !data && (
              <div className="tp-loading">
                <div className="tp-loading-spinner" />
                <span>Building topology graph…</span>
              </div>
            )}

            {error && (
              <div className="tp-empty">
                <Network className="w-10 h-10" style={{ color: 'var(--color-vemio-text-dim)', marginBottom: 8 }} />
                <p>{error}</p>
                <button onClick={fetchTopology} className="tp-retry-btn">Retry</button>
              </div>
            )}

            {!loading && data && data.nodes.length === 0 && (
              <div className="tp-empty">
                <Network className="w-10 h-10" style={{ color: 'var(--color-vemio-text-dim)', marginBottom: 8 }} />
                <p>No topology data available yet</p>
                <span style={{ fontSize: 12, color: 'var(--color-vemio-text-dim)' }}>
                  The topology worker syncs every 2 hours
                </span>
              </div>
            )}

            <svg
              ref={svgRef}
              width={dimensions.w}
              height={dimensions.h}
              style={{ display: data && data.nodes.length ? 'block' : 'none' }}
            />

            {/* Zoom controls overlay */}
            {data && data.nodes.length > 0 && (
              <div className="tp-zoom-controls">
                <button onClick={handleZoomIn} className="tp-zoom-btn" title="Zoom in">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleZoomOut} className="tp-zoom-btn" title="Zoom out">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button onClick={handleFitView} className="tp-zoom-btn" title="Fit to view">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ── Legend ── */}
          {data && data.nodes.length > 0 && (
            <div className="tp-legend">
              <div className="tp-legend-section">
                <span className="tp-legend-title">Status</span>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  statusCounts[key] ? (
                    <span key={key} className="tp-legend-item">
                      <span className="tp-legend-dot" style={{ background: cfg.color }} />
                      {cfg.label} ({statusCounts[key]})
                    </span>
                  ) : null
                ))}
              </div>
              <div className="tp-legend-section">
                <span className="tp-legend-title">Types</span>
                {Object.entries(typeCounts)
                  .sort((a, b) => (TIER_ORDER[a[0]] ?? 9) - (TIER_ORDER[b[0]] ?? 9))
                  .map(([type, count]) => (
                    <span key={type} className="tp-legend-item">
                      <span className="tp-legend-abbr">{TYPE_ABBR[type] || '?'}</span>
                      {type.replace(/_/g, ' ')} ({count})
                    </span>
                  ))
                }
              </div>
              <div className="tp-legend-section">
                <span className="tp-legend-title">Clusters</span>
                <span className="tp-legend-item">
                  <span className="tp-legend-dot" style={{ background: 'rgba(245,158,11,0.6)', border: '1px solid rgba(245,158,11,0.8)' }} />
                  Click cluster to expand/collapse
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Inspector Panel ── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key="inspector"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="tp-inspector"
            >
              <div className="tp-insp-header">
                <h3 className="tp-insp-title">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="tp-insp-close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="tp-insp-status">
                <span className="tp-insp-badge"
                  style={{
                    background: (STATUS_CONFIG[selected.status] || STATUS_CONFIG.unknown).bg,
                    color: (STATUS_CONFIG[selected.status] || STATUS_CONFIG.unknown).color,
                  }}>
                  <span className="tp-insp-dot"
                    style={{ background: (STATUS_CONFIG[selected.status] || STATUS_CONFIG.unknown).color }} />
                  {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.unknown).label}
                </span>
              </div>

              <div className="tp-insp-fields">
                <Field label="Type" value={selected.type?.replace(/_/g, ' ')} />
                <Field label="IP Address" value={selected.ipAddress} mono />
                <Field label="Make" value={selected.make} />
                <Field label="Model" value={selected.model} />
                <Field label="Site" value={selected.siteName} />
                {selected.isClusterHead && selected.childCount > 0 && (
                  <Field label="Cluster Size" value={`${selected.childCount} devices`} />
                )}
              </div>

              {neighbors.length > 0 && (
                <div className="tp-insp-neighbors">
                  <span className="tp-insp-nbr-title">Connected Devices ({neighbors.length})</span>
                  <div className="tp-insp-nbr-list">
                    {neighbors.map(n => {
                      const cfg = STATUS_CONFIG[n.status] || STATUS_CONFIG.unknown;
                      return (
                        <button
                          key={n.id}
                          className="tp-insp-nbr-item"
                          onClick={() => setSelected(n)}
                        >
                          <span className="tp-insp-dot" style={{ background: cfg.color, width: 6, height: 6 }} />
                          <span className="tp-insp-nbr-name">{n.name}</span>
                          <span className="tp-insp-nbr-type">{n.type?.replace(/_/g, ' ')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`
        .tp-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 1400px;
          position: relative;
        }

        .tp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .tp-title    { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .tp-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }
        .tp-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          flex-wrap: wrap;
        }
        .tp-cluster-controls {
          display: flex;
          gap: 2px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--color-vemio-border);
        }
        .tp-ctrl-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 7px 10px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-surface);
          color: var(--color-vemio-text-dim);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .tp-ctrl-btn:first-child { border-right: 1px solid var(--color-vemio-border); }
        .tp-ctrl-btn:hover {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text-muted);
        }
        .tp-category-toggle {
          display: flex;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--color-vemio-border);
        }
        .tp-cat-btn {
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          background: var(--color-vemio-surface);
          color: var(--color-vemio-text-dim);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .tp-cat-btn:first-child { border-right: 1px solid var(--color-vemio-border); }
        .tp-cat-btn--active {
          background: rgba(245,158,11,0.12);
          color: var(--color-vemio-amber);
        }
        .tp-cat-btn:hover:not(.tp-cat-btn--active) {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text-muted);
        }
        .tp-site-select {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          cursor: pointer;
          min-width: 140px;
        }
        .tp-refresh-btn {
          padding: 8px;
          border-radius: 8px;
          border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: background 0.15s;
        }
        .tp-refresh-btn:hover { background: var(--color-vemio-surface-raised); }

        .tp-graph-panel {
          border-radius: 16px;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          position: relative;
        }
        .tp-graph-wrap {
          width: 100%;
          height: clamp(500px, 70vh, 900px);
          position: relative;
          overflow: hidden;
        }
        .tp-graph-wrap svg { display: block; }

        .tp-zoom-controls {
          position: absolute;
          bottom: 12px;
          right: 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 10;
        }
        .tp-zoom-btn {
          padding: 7px;
          border-radius: 8px;
          border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-vemio-text-muted);
          transition: background 0.15s;
        }
        .tp-zoom-btn:hover {
          background: var(--color-vemio-surface-raised);
        }

        .tp-loading {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; font-size: 13px; color: var(--color-vemio-text-dim);
        }
        .tp-loading-spinner {
          width: 28px; height: 28px;
          border: 2.5px solid rgba(148,163,184,0.15);
          border-top-color: rgba(245,158,11,0.6);
          border-radius: 50%;
          animation: tp-spin 0.8s linear infinite;
        }
        @keyframes tp-spin { to { transform: rotate(360deg); } }

        .tp-empty {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px; font-size: 13px; color: var(--color-vemio-text-muted);
        }
        .tp-retry-btn {
          margin-top: 8px; padding: 6px 16px; border-radius: 8px; font-size: 12px;
          background: var(--color-vemio-surface-raised); border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text); cursor: pointer;
        }

        .tp-legend {
          display: flex; gap: 24px; padding: 10px 16px;
          border-top: 1px solid var(--color-vemio-border); flex-wrap: wrap;
        }
        .tp-legend-section { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .tp-legend-title {
          font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em;
          font-weight: 600; color: var(--color-vemio-text-dim); margin-right: 2px;
        }
        .tp-legend-item {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; color: var(--color-vemio-text-muted); white-space: nowrap;
        }
        .tp-legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .tp-legend-abbr {
          display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 14px; border-radius: 3px; font-size: 8px; font-weight: 700;
          background: rgba(148,163,184,0.1); color: var(--color-vemio-text-dim);
          flex-shrink: 0; text-transform: uppercase;
        }

        .tp-inspector {
          position: absolute; top: 52px; right: 0; width: 320px;
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
        .tp-insp-close:hover { background: rgba(255,255,255,0.05); }

        .tp-insp-status { display: flex; }
        .tp-insp-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px; font-size: 10px;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
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

        .tp-insp-neighbors { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid var(--color-vemio-border); padding-top: 12px; }
        .tp-insp-nbr-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; color: var(--color-vemio-text-dim); }
        .tp-insp-nbr-list { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow-y: auto; }
        .tp-insp-nbr-item {
          display: flex; align-items: center; gap: 6px; padding: 5px 8px;
          border-radius: 6px; border: none; background: transparent; cursor: pointer;
          text-align: left; transition: background 0.12s; color: inherit;
        }
        .tp-insp-nbr-item:hover { background: rgba(255,255,255,0.04); }
        .tp-insp-nbr-name { font-size: 12px; color: var(--vemio-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .tp-insp-nbr-type { font-size: 10px; color: var(--color-vemio-text-dim); text-transform: capitalize; flex-shrink: 0; }

        @media (max-width: 479px) {
          .tp-site-select { min-width: 100px; font-size: 12px; }
          .tp-legend { padding: 8px 10px; gap: 12px; }
          .tp-cluster-controls { display: none; }
        }
      `}</style>
    </>
  );
}

function Field({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="tp-field">
      <span className="tp-field-label">{label}</span>
      <span className={`tp-field-value ${mono ? 'tp-field-value--mono' : ''}`}>{value}</span>
    </div>
  );
}