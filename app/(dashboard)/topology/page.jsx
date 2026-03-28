// ════════════════════════════════════════════════════════
//  TopologyPage  →  app/(dashboard)/topology/page.jsx
//  Hierarchical tiered campus layout with search/locate
// ════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, X, RefreshCw, Search,
  Minus, Plus, Maximize2, Crosshair,
} from 'lucide-react';
import * as d3 from 'd3';

/* ═══════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════ */

const STATUS_CFG = {
  up:       { label: 'Online',   color: '#22c55e' },
  down:     { label: 'Offline',  color: '#ef4444' },
  degraded: { label: 'Degraded', color: '#f59e0b' },
  unknown:  { label: 'Unknown',  color: '#6b7280' },
};

const TIER_ORDER = {
  firewall: 0, router: 0,
  core_switch: 1, p2p_link: 1,
  access_switch: 2,
  access_point: 3, server: 3, nas: 3,
  ups: 4, printer: 4, cctv: 4, access_control: 4, other: 4,
};

const TIER_LABELS = [
  'Firewalls & Routers',
  'Core / Distribution',
  'Access Switches',
  'APs · Servers · Endpoints',
  'Peripherals',
];

const TYPE_ABBR = {
  firewall: 'FW', core_switch: 'CS', access_switch: 'AS',
  access_point: 'AP', router: 'RT', server: 'SV',
  nas: 'NA', ups: 'UP', cctv: 'CC', printer: 'PR',
  access_control: 'AC', p2p_link: 'P2', other: '··',
};

const TIER_RADIUS = [26, 22, 14, 10, 8];

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ═══════════════════════════════════════════════════════
   HIERARCHICAL TREE BUILDER
   ═══════════════════════════════════════════════════════
   Builds strict parent→child from edges + tier ordering.
   Each node assigned to exactly one parent (highest-tier neighbor).
   ═══════════════════════════════════════════════════════ */
function buildHierarchy(nodes, edges) {
  const nodeMap = new Map();
  for (const n of nodes) nodeMap.set(n.id, { ...n, tier: TIER_ORDER[n.type] ?? 4, children: [] });

  // Adjacency list
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    if (adj.has(e.source) && adj.has(e.target)) {
      adj.get(e.source).add(e.target);
      adj.get(e.target).add(e.source);
    }
  }

  // Group by tier
  const tiers = [[], [], [], [], []];
  for (const n of nodeMap.values()) tiers[Math.min(n.tier, 4)].push(n);

  // Assign parent: walk tiers top-down, each node attaches to
  // the highest-tier neighbor it has an edge to
  const assigned = new Set();
  const roots = []; // tier-0 nodes are roots

  for (const n of tiers[0]) {
    assigned.add(n.id);
    roots.push(n);
  }

  // For each subsequent tier, find parent from prior tiers
  for (let t = 1; t <= 4; t++) {
    for (const node of tiers[t]) {
      const neighbors = adj.get(node.id) || new Set();
      let bestParent = null;
      let bestTier = 99;

      for (const nbId of neighbors) {
        const nb = nodeMap.get(nbId);
        if (nb && assigned.has(nb.id) && nb.tier < t && nb.tier < bestTier) {
          bestParent = nb;
          bestTier = nb.tier;
        }
      }

      // If no parent in a higher tier, try same tier (for mesh connections)
      if (!bestParent) {
        for (const nbId of neighbors) {
          const nb = nodeMap.get(nbId);
          if (nb && assigned.has(nb.id) && nb.tier === t) {
            bestParent = nb;
            break;
          }
        }
      }

      if (bestParent) {
        bestParent.children.push(node);
      }
      assigned.add(node.id);
    }
  }

  // Orphans: nodes not reachable from any root
  const orphans = [];
  for (const n of nodeMap.values()) {
    if (!assigned.has(n.id)) orphans.push(n);
  }

  // Also collect nodes assigned but not attached to any parent (non-root, no parent)
  const attachedIds = new Set();
  function markAttached(node) {
    attachedIds.add(node.id);
    for (const c of node.children) markAttached(c);
  }
  for (const r of roots) markAttached(r);

  for (const n of nodeMap.values()) {
    if (!attachedIds.has(n.id)) orphans.push(n);
  }

  return { roots, orphans, nodeMap, adj, tiers };
}

/* ═══════════════════════════════════════════════════════
   LAYOUT ENGINE — Positions nodes in tiered rows
   ═══════════════════════════════════════════════════════
   Returns Map<nodeId, {x, y, radius, ...nodeData}>
   Canvas can be very wide — caller handles pan/zoom.
   ═══════════════════════════════════════════════════════ */
function layoutHierarchy(roots, orphans, allNodes) {
  const positions = new Map();

  // Layout constants
  const TIER_Y = [80, 180, 310, 450, 560];
  const MIN_SPACING = { 0: 100, 1: 90, 2: 60, 3: 36, 4: 30 };
  const SUBTREE_PAD = 30;

  // Measure subtree width (recursive, bottom-up)
  function subtreeWidth(node) {
    if (node.children.length === 0) {
      return MIN_SPACING[Math.min(node.tier, 4)];
    }
    let total = 0;
    for (const c of node.children) {
      total += subtreeWidth(c);
    }
    // Add padding between children
    total += (node.children.length - 1) * SUBTREE_PAD;
    return Math.max(total, MIN_SPACING[Math.min(node.tier, 4)]);
  }

  // Cache subtree widths
  const widthCache = new Map();
  function getWidth(node) {
    if (widthCache.has(node.id)) return widthCache.get(node.id);
    const w = subtreeWidth(node);
    widthCache.set(node.id, w);
    return w;
  }

  // Position a subtree rooted at `node` within [leftX, leftX + allocatedWidth]
  function positionSubtree(node, leftX, allocatedWidth) {
    const tier = Math.min(node.tier, 4);
    const r = TIER_RADIUS[tier];
    const centerX = leftX + allocatedWidth / 2;
    const y = TIER_Y[tier];

    positions.set(node.id, { ...node, x: centerX, y, radius: r });

    if (node.children.length === 0) return;

    // Distribute children within our allocated width
    const childWidths = node.children.map(c => getWidth(c));
    const totalChildWidth = childWidths.reduce((s, w) => s + w, 0)
      + (node.children.length - 1) * SUBTREE_PAD;

    // Center the children block under this node
    let cursor = centerX - totalChildWidth / 2;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const cw = childWidths[i];
      positionSubtree(child, cursor, cw);
      cursor += cw + SUBTREE_PAD;
    }
  }

  // Sort roots by subtree size (largest in center for visual balance)
  const sortedRoots = [...roots].sort((a, b) => getWidth(b) - getWidth(a));

  // Interleave: largest center, next left, next right, etc.
  const reordered = [];
  let left = 0, right = sortedRoots.length - 1;
  let insertLeft = true;
  for (let i = 0; i < sortedRoots.length; i++) {
    if (insertLeft) {
      reordered.push(sortedRoots[left++]);
    } else {
      reordered.push(sortedRoots[right--]);
    }
    insertLeft = !insertLeft;
  }

  // Calculate total width needed
  const rootWidths = reordered.map(r => getWidth(r));
  const totalWidth = rootWidths.reduce((s, w) => s + w, 0) + (reordered.length - 1) * SUBTREE_PAD * 2;
  const startX = SUBTREE_PAD;

  let cursor = startX;
  for (let i = 0; i < reordered.length; i++) {
    const rw = rootWidths[i];
    positionSubtree(reordered[i], cursor, rw);
    cursor += rw + SUBTREE_PAD * 2;
  }

  // Position orphans in a row at the bottom
  if (orphans.length > 0) {
    const orphanY = TIER_Y[4] + 100;
    const orphanSpacing = 32;
    const orphanStartX = startX;
    for (let i = 0; i < orphans.length; i++) {
      const o = orphans[i];
      const tier = Math.min(o.tier, 4);
      positions.set(o.id, {
        ...o,
        x: orphanStartX + i * orphanSpacing,
        y: orphanY,
        radius: TIER_RADIUS[tier],
        isOrphan: true,
      });
    }
  }

  // Calculate canvas bounds
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x - pos.radius);
    maxX = Math.max(maxX, pos.x + pos.radius);
    maxY = Math.max(maxY, pos.y + pos.radius + 30);
  }

  const canvasWidth = Math.max(maxX - minX + SUBTREE_PAD * 4, 800);
  const canvasHeight = Math.max(maxY + 60, 650);

  // Shift everything so minX starts at padding
  const shiftX = SUBTREE_PAD * 2 - minX;
  if (shiftX !== 0) {
    for (const pos of positions.values()) pos.x += shiftX;
  }

  return { positions, canvasWidth, canvasHeight };
}

/* ═══════════════════════════════════════════════════════
   TOPOLOGY PAGE COMPONENT
   ═══════════════════════════════════════════════════════ */
export default function TopologyPage() {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const zoomRef = useRef(null);
  const gRef = useRef(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [category, setCategory] = useState('network');
  const [selected, setSelected] = useState(null);
  const [viewDims, setViewDims] = useState({ w: 1200, h: 700 });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedId, setHighlightedId] = useState(null);
  const searchInputRef = useRef(null);

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
      setHighlightedId(null);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
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
      if (width > 0 && height > 0) setViewDims({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Build hierarchy and layout ── */
  const layout = useMemo(() => {
    if (!data?.nodes?.length) return null;
    const { roots, orphans, nodeMap, adj } = buildHierarchy(data.nodes, data.edges);
    const { positions, canvasWidth, canvasHeight } = layoutHierarchy(roots, orphans, data.nodes);
    return { positions, canvasWidth, canvasHeight, nodeMap, adj, roots, orphans };
  }, [data]);

  /* ── Search logic ── */
  useEffect(() => {
    if (!searchQuery.trim() || !data?.nodes) {
      setSearchResults([]);
      if (!searchQuery.trim()) setHighlightedId(null);
      return;
    }
    const q = searchQuery.toLowerCase().trim();
    const matches = data.nodes.filter(n =>
      (n.name || '').toLowerCase().includes(q) ||
      (n.ipAddress || '').toLowerCase().includes(q) ||
      (n.serialNumber || '').toLowerCase().includes(q) ||
      (n.model || '').toLowerCase().includes(q)
    ).slice(0, 8);
    setSearchResults(matches);
  }, [searchQuery, data]);

  /* ── Locate device: highlight + pan ── */
  const locateDevice = useCallback((deviceId) => {
    if (!layout || !svgRef.current || !zoomRef.current) return;
    const pos = layout.positions.get(deviceId);
    if (!pos) return;

    setHighlightedId(deviceId);
    setSearchResults([]);
    setSearchQuery('');

    // Pan + zoom to center the device
    const svg = d3.select(svgRef.current);
    const { w, h } = viewDims;
    const targetScale = 1.5;
    const tx = w / 2 - pos.x * targetScale;
    const ty = h / 2 - pos.y * targetScale;

    svg.transition().duration(600).ease(d3.easeCubicInOut).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(targetScale)
    );

    // Open inspector
    const node = layout.nodeMap.get(deviceId);
    if (node) setSelected(node);

    // Clear highlight after 4 seconds
    setTimeout(() => setHighlightedId(null), 4000);
  }, [layout, viewDims]);

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
    if (!svgRef.current || !zoomRef.current || !layout) return;
    const svg = d3.select(svgRef.current);
    const { w, h } = viewDims;
    const pad = 40;
    const scale = Math.min(
      (w - pad * 2) / layout.canvasWidth,
      (h - pad * 2) / layout.canvasHeight,
      1.0
    );
    const tx = (w - layout.canvasWidth * scale) / 2;
    const ty = (h - layout.canvasHeight * scale) / 2 + pad / 2;
    svg.transition().duration(500).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }, [layout, viewDims]);

  /* ═══════════════════════════════════════════════════════
     D3 RENDER
     ═══════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!data || !layout || !svgRef.current) return;
    if (!data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = viewDims;
    const { positions, canvasWidth, canvasHeight, adj } = layout;

    const g = svg.append('g').attr('class', 'tp-main-group');
    gRef.current = g.node();

    // Zoom
    const zoom = d3.zoom()
      .scaleExtent([0.08, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    /* ── Tier separator lines and labels ── */
    const tierYs = [80, 180, 310, 450, 560];
    const usedTiers = new Set();
    for (const pos of positions.values()) {
      for (let t = 0; t < tierYs.length; t++) {
        if (Math.abs(pos.y - tierYs[t]) < 5) usedTiers.add(t);
      }
    }

    for (const t of usedTiers) {
      const y = tierYs[t] - 35;
      g.append('line')
        .attr('x1', 0).attr('x2', canvasWidth)
        .attr('y1', y).attr('y2', y)
        .attr('stroke', 'rgba(148,163,184,0.06)').attr('stroke-width', 1);
      g.append('text')
        .attr('x', 8).attr('y', y - 6)
        .attr('font-size', 9).attr('fill', 'rgba(148,163,184,0.3)')
        .attr('font-weight', 600).attr('letter-spacing', '0.06em')
        .text(TIER_LABELS[t]);
    }

    /* ── Edges ── */
    const linkG = g.append('g').attr('class', 'tp-links');
    const edgePairs = [];

    for (const e of data.edges) {
      const src = positions.get(e.source);
      const tgt = positions.get(e.target);
      if (src && tgt) edgePairs.push({ source: src, target: tgt });
    }

    linkG.selectAll('path')
      .data(edgePairs)
      .join('path')
      .attr('d', e => {
        const dx = e.target.x - e.source.x;
        const dy = e.target.y - e.source.y;
        if (Math.abs(dy) < 10) {
          // Horizontal: arc
          const mx = (e.source.x + e.target.x) / 2;
          const my = e.source.y - Math.min(30, Math.abs(dx) * 0.15);
          return `M${e.source.x},${e.source.y} Q${mx},${my} ${e.target.x},${e.target.y}`;
        }
        // Vertical: smooth S-curve
        const my = (e.source.y + e.target.y) / 2;
        return `M${e.source.x},${e.source.y} C${e.source.x},${my} ${e.target.x},${my} ${e.target.x},${e.target.y}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'rgba(148,163,184,0.10)')
      .attr('stroke-width', 0.8);

    /* ── Nodes ── */
    const nodeG = g.append('g').attr('class', 'tp-nodes');
    const nodeData = Array.from(positions.values());

    const node = nodeG.selectAll('g')
      .data(nodeData, d => d.id)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer');

    // Outer ring
    node.append('circle')
      .attr('class', 'node-ring')
      .attr('r', d => d.radius + 3)
      .attr('fill', 'none')
      .attr('stroke', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.15);

    // Main body
    node.append('circle')
      .attr('class', 'node-body')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const c = (STATUS_CFG[d.status] || STATUS_CFG.unknown).color;
        return d.tier <= 1 ? c + '22' : c + '12';
      })
      .attr('stroke', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).color)
      .attr('stroke-width', d => d.tier <= 1 ? 2 : 1.2);

    // Type label
    node.filter(d => d.radius >= 10)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(7, d.radius * 0.55))
      .attr('font-weight', 700)
      .attr('fill', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).color)
      .attr('pointer-events', 'none')
      .text(d => TYPE_ABBR[d.type] || '?');

    // Name label (only for tier 0-2 — too many tier 3-4 nodes)
    node.filter(d => d.tier <= 2)
      .append('text')
      .attr('y', d => d.radius + 11)
      .attr('text-anchor', 'middle')
      .attr('font-size', d => d.tier <= 1 ? 9 : 7)
      .attr('fill', 'rgba(148,163,184,0.55)')
      .attr('pointer-events', 'none')
      .text(d => {
        const name = d.name || '';
        const max = d.tier <= 1 ? 20 : 14;
        return name.length > max ? name.slice(0, max - 1) + '…' : name;
      });

    // Click handler
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelected(prev => prev?.id === d.id ? null : d);
    });

    // Hover: highlight connected edges
    node.on('mouseenter', (event, d) => {
      const nId = d.id;
      const connectedIds = new Set([nId]);
      const neighbors = adj.get(nId);
      if (neighbors) for (const nb of neighbors) connectedIds.add(nb);

      linkG.selectAll('path')
        .attr('stroke', e => {
          if (e.source.id === nId || e.target.id === nId) {
            return (STATUS_CFG[d.status] || STATUS_CFG.unknown).color;
          }
          return 'rgba(148,163,184,0.04)';
        })
        .attr('stroke-width', e =>
          (e.source.id === nId || e.target.id === nId) ? 2 : 0.5
        );

      // Dim non-connected nodes
      nodeG.selectAll('g').attr('opacity', n =>
        connectedIds.has(n.id) ? 1 : 0.2
      );
    });

    node.on('mouseleave', () => {
      linkG.selectAll('path')
        .attr('stroke', 'rgba(148,163,184,0.10)')
        .attr('stroke-width', 0.8);
      nodeG.selectAll('g').attr('opacity', 1);
    });

    // Click background → deselect
    svg.on('click', () => {
      setSelected(null);
      setHighlightedId(null);
    });

    // Auto-fit on first render
    requestAnimationFrame(() => {
      const pad = 40;
      const scale = Math.min(
        (w - pad * 2) / canvasWidth,
        (h - pad * 2) / canvasHeight,
        1.0
      );
      const tx = (w - canvasWidth * scale) / 2;
      const ty = (h - canvasHeight * scale) / 2 + pad / 2;
      svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

  }, [data, layout, viewDims]);

  /* ── Highlight effect (runs when highlightedId changes) ── */
  useEffect(() => {
    if (!gRef.current || !layout) return;
    const g = d3.select(gRef.current);
    const nodeGroups = g.select('.tp-nodes').selectAll('g');

    if (!highlightedId) {
      // Reset all
      nodeGroups.attr('opacity', 1);
      nodeGroups.selectAll('.node-highlight-ring').remove();
      return;
    }

    // Dim everything, highlight target
    nodeGroups.attr('opacity', d => d.id === highlightedId ? 1 : 0.15);

    // Add pulsing ring to highlighted node
    nodeGroups.each(function(d) {
      const el = d3.select(this);
      el.selectAll('.node-highlight-ring').remove();
      if (d.id === highlightedId) {
        el.append('circle')
          .attr('class', 'node-highlight-ring')
          .attr('r', d.radius + 8)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 1)
          .transition().duration(600).ease(d3.easeLinear)
          .attr('r', d.radius + 20)
          .attr('stroke-opacity', 0)
          .on('end', function() { d3.select(this).remove(); });

        // Persistent ring
        el.append('circle')
          .attr('class', 'node-highlight-ring')
          .attr('r', d.radius + 6)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2.5)
          .attr('stroke-dasharray', '4,3');
      }
    });
  }, [highlightedId, layout]);

  /* ── Stats for legend ── */
  const statusCounts = {};
  const typeCounts = {};
  if (data?.nodes) {
    for (const n of data.nodes) {
      statusCounts[n.status] = (statusCounts[n.status] || 0) + 1;
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
  }

  /* ── Neighbors for inspector ── */
  const neighbors = [];
  if (selected && data) {
    const nIds = new Set();
    for (const e of data.edges) {
      if (e.source === selected.id) nIds.add(e.target);
      if (e.target === selected.id) nIds.add(e.source);
    }
    for (const n of data.nodes) {
      if (nIds.has(n.id)) neighbors.push(n);
    }
  }

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
                ? `${data.nodes.length} devices · ${data.edges.length} connections`
                : 'Loading…'}
            </p>
          </div>
          <div className="tp-header-actions">
            <div className="tp-category-toggle">
              <button
                onClick={() => setCategory('network')}
                className={`tp-cat-btn ${category === 'network' ? 'tp-cat-btn--active' : ''}`}
              >Network</button>
              <button
                onClick={() => setCategory('all')}
                className={`tp-cat-btn ${category === 'all' ? 'tp-cat-btn--active' : ''}`}
              >All Devices</button>
            </div>
            {sites.length > 0 && (
              <select
                value={selectedSite}
                onChange={e => setSelectedSite(e.target.value)}
                className="tp-site-select"
              >
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <button onClick={fetchTopology} className="tp-refresh-btn" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                style={{ color: 'var(--color-vemio-text-muted)' }} />
            </button>
          </div>
        </motion.div>

        {/* ── Graph area ── */}
        <motion.div variants={fadeUp} className="tp-graph-panel">
          {/* Search bar */}
          {data && data.nodes.length > 0 && (
            <div className="tp-search-bar">
              <Search size={14} className="tp-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, IP, serial, model…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="tp-search-input"
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    locateDevice(searchResults[0].id);
                  }
                  if (e.key === 'Escape') {
                    setSearchQuery('');
                    setSearchResults([]);
                    setHighlightedId(null);
                  }
                }}
              />
              {searchQuery && (
                <button className="tp-search-clear" onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setHighlightedId(null);
                }}><X size={12} /></button>
              )}
              {/* Dropdown results */}
              {searchResults.length > 0 && (
                <div className="tp-search-dropdown">
                  {searchResults.map(r => (
                    <button
                      key={r.id}
                      className="tp-search-result"
                      onClick={() => locateDevice(r.id)}
                    >
                      <span className="tp-sr-dot"
                        style={{ background: (STATUS_CFG[r.status] || STATUS_CFG.unknown).color }} />
                      <span className="tp-sr-name">{r.name}</span>
                      <span className="tp-sr-meta">
                        {r.ipAddress || TYPE_ABBR[r.type] || r.type}
                      </span>
                      <Crosshair size={12} className="tp-sr-locate" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
              </div>
            )}

            <svg
              ref={svgRef}
              width={viewDims.w}
              height={viewDims.h}
              style={{ display: data && data.nodes.length ? 'block' : 'none' }}
            />

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

          {/* Legend */}
          {data && data.nodes.length > 0 && (
            <div className="tp-legend">
              <div className="tp-legend-section">
                <span className="tp-legend-title">Status</span>
                {Object.entries(STATUS_CFG).map(([key, cfg]) =>
                  statusCounts[key] ? (
                    <span key={key} className="tp-legend-item">
                      <span className="tp-legend-dot" style={{ background: cfg.color }} />
                      {cfg.label} ({statusCounts[key]})
                    </span>
                  ) : null
                )}
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
                  ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Inspector ── */}
        <AnimatePresence>
          {selected && (
            <motion.div
              key="inspector"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
              className="tp-inspector"
            >
              <div className="tp-insp-header">
                <h3 className="tp-insp-title">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="tp-insp-close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="tp-insp-status">
                <span className="tp-insp-badge" style={{
                  background: (STATUS_CFG[selected.status] || STATUS_CFG.unknown).color + '18',
                  color: (STATUS_CFG[selected.status] || STATUS_CFG.unknown).color,
                }}>
                  <span className="tp-insp-dot" style={{
                    background: (STATUS_CFG[selected.status] || STATUS_CFG.unknown).color
                  }} />
                  {(STATUS_CFG[selected.status] || STATUS_CFG.unknown).label}
                </span>
              </div>
              <div className="tp-insp-fields">
                <Field label="Type" value={selected.type?.replace(/_/g, ' ')} />
                <Field label="IP Address" value={selected.ipAddress} mono />
                <Field label="Make" value={selected.make} />
                <Field label="Model" value={selected.model} />
                <Field label="Site" value={selected.siteName} />
              </div>
              {neighbors.length > 0 && (
                <div className="tp-insp-neighbors">
                  <span className="tp-insp-nbr-title">Connected ({neighbors.length})</span>
                  <div className="tp-insp-nbr-list">
                    {neighbors.slice(0, 30).map(n => (
                      <button key={n.id} className="tp-insp-nbr-item"
                        onClick={() => {
                          setSelected(data.nodes.find(nd => nd.id === n.id) || n);
                          locateDevice(n.id);
                        }}>
                        <span className="tp-insp-dot" style={{
                          background: (STATUS_CFG[n.status] || STATUS_CFG.unknown).color,
                          width: 6, height: 6
                        }} />
                        <span className="tp-insp-nbr-name">{n.name}</span>
                        <span className="tp-insp-nbr-type">{TYPE_ABBR[n.type] || '?'}</span>
                      </button>
                    ))}
                    {neighbors.length > 30 && (
                      <span className="tp-insp-nbr-more">+{neighbors.length - 30} more</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`
        .tp-root {
          display: flex; flex-direction: column; gap: 16px;
          max-width: 1400px; position: relative;
        }
        .tp-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px; flex-wrap: wrap;
        }
        .tp-title { font-size: 18px; font-weight: 700; color: var(--vemio-text); margin: 0; }
        .tp-subtitle { font-size: 13px; color: var(--vemio-text-muted); margin: 3px 0 0; }
        .tp-header-actions {
          display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap;
        }
        .tp-category-toggle {
          display: flex; border-radius: 8px; overflow: hidden;
          border: 1px solid var(--color-vemio-border);
        }
        .tp-cat-btn {
          padding: 7px 12px; font-size: 11px; font-weight: 500; cursor: pointer;
          border: none; background: var(--color-vemio-surface);
          color: var(--color-vemio-text-dim); transition: background 0.15s; white-space: nowrap;
        }
        .tp-cat-btn:first-child { border-right: 1px solid var(--color-vemio-border); }
        .tp-cat-btn--active { background: rgba(245,158,11,0.12); color: var(--color-vemio-amber); }
        .tp-site-select {
          padding: 8px 12px; border-radius: 8px; font-size: 13px;
          background: var(--color-vemio-surface); border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text); outline: none; cursor: pointer; min-width: 140px;
        }
        .tp-refresh-btn {
          padding: 8px; border-radius: 8px; border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface); cursor: pointer;
          display: flex; align-items: center; transition: background 0.15s;
        }
        .tp-refresh-btn:hover { background: var(--color-vemio-surface-raised); }

        .tp-graph-panel {
          border-radius: 16px; overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border); position: relative;
        }

        /* Search bar */
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
          width: 18px; height: 18px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--vemio-text-muted);
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
        .tp-sr-name {
          font-size: 13px; color: var(--vemio-text); flex: 1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tp-sr-meta { font-size: 11px; color: var(--color-vemio-text-dim); font-family: monospace; }
        .tp-sr-locate { color: var(--color-vemio-text-dim); flex-shrink: 0; }

        .tp-graph-wrap {
          width: 100%; height: clamp(500px, 70vh, 900px);
          position: relative; overflow: hidden;
        }
        .tp-graph-wrap svg { display: block; }
        .tp-zoom-controls {
          position: absolute; bottom: 12px; right: 12px;
          display: flex; flex-direction: column; gap: 2px; z-index: 10;
        }
        .tp-zoom-btn {
          padding: 7px; border-radius: 8px; border: 1px solid var(--color-vemio-border);
          background: var(--color-vemio-surface); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-vemio-text-muted); transition: background 0.15s;
        }
        .tp-zoom-btn:hover { background: var(--color-vemio-surface-raised); }

        .tp-loading {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 12px; font-size: 13px; color: var(--color-vemio-text-dim);
        }
        .tp-loading-spinner {
          width: 28px; height: 28px;
          border: 2.5px solid rgba(148,163,184,0.15);
          border-top-color: rgba(245,158,11,0.6);
          border-radius: 50%; animation: tp-spin 0.8s linear infinite;
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
          font-weight: 600; color: var(--color-vemio-text-dim);
        }
        .tp-legend-item {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; color: var(--color-vemio-text-muted); white-space: nowrap;
        }
        .tp-legend-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .tp-legend-abbr {
          display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 14px; border-radius: 3px; font-size: 8px; font-weight: 700;
          background: rgba(148,163,184,0.1); color: var(--color-vemio-text-dim); flex-shrink: 0;
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
        .tp-insp-neighbors {
          display: flex; flex-direction: column; gap: 6px;
          border-top: 1px solid var(--color-vemio-border); padding-top: 12px;
        }
        .tp-insp-nbr-title {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em;
          font-weight: 600; color: var(--color-vemio-text-dim);
        }
        .tp-insp-nbr-list {
          display: flex; flex-direction: column; gap: 2px;
          max-height: 200px; overflow-y: auto;
        }
        .tp-insp-nbr-item {
          display: flex; align-items: center; gap: 6px; padding: 5px 8px;
          border-radius: 6px; border: none; background: transparent; cursor: pointer;
          text-align: left; transition: background 0.12s; color: inherit;
        }
        .tp-insp-nbr-item:hover { background: rgba(255,255,255,0.04); }
        .tp-insp-nbr-name {
          font-size: 12px; color: var(--vemio-text); flex: 1;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tp-insp-nbr-type { font-size: 9px; color: var(--color-vemio-text-dim); font-weight: 600; }
        .tp-insp-nbr-more { font-size: 11px; color: var(--color-vemio-text-dim); padding: 4px 8px; }
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