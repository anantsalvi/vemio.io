'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Network, ArrowRight, RefreshCw } from 'lucide-react';
import * as d3 from 'd3';
import { useDeviceCategory } from '@/contexts/DeviceCategoryContext';

/* ── Device-type color system (matches main topology) ── */
const TYPE_COLORS = {
  firewall:'#EF4444', router:'#F97316', core_switch:'#3B82F6', access_switch:'#10B981',
  access_point:'#A855F7', server:'#6366F1', p2p_link:'#06B6D4', nas:'#8B5CF6',
  ups:'#F87171', printer:'#84CC16', cctv:'#14B8A6', access_control:'#C084FC', other:'#9CA3AF',
};
const VENDOR_COLORS = {
  'firewall:Fortinet':'#DC2626','firewall:Sophos':'#EA580C',
  'core_switch:Cisco':'#2563EB','core_switch:HP':'#0891B2',
  'access_point:Ruckus':'#EC4899','access_point:Fortinet':'#F59E0B','access_point:Aruba':'#06B6D4',
  'access_point:Cambium':'#8B5CF6','router:Cisco':'#FB923C',
};
function getDeviceColor(type, make) {
  if (make) { const k = `${type}:${make}`; if (VENDOR_COLORS[k]) return VENDOR_COLORS[k]; }
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

/* ── Status ── */
const STATUS_CFG = {
  up:      { color:'#22c55e', dash:'none' },
  down:    { color:'#ef4444', dash:'none' },
  degraded:{ color:'#f59e0b', dash:'4,3' },
  unknown: { color:'#6b7280', dash:'2,2' },
};

/* ── Edge styles ── */
const TUNNEL_TYPES = new Set(['router','firewall','p2p_link']);
const EDGE_STYLES = {
  fiber:   { color:'#F97316', width:1.5, dash:'none', opacity:0.6 },
  copper:  { color:'rgba(148,163,184,0.20)', width:0.6, dash:'none', opacity:1 },
  tunnel:  { color:'#06B6D4', width:1.5, dash:'6,3', opacity:0.6 },
  unknown: { color:'rgba(148,163,184,0.08)', width:0.5, dash:'none', opacity:1 },
};
function classifyEdge(e, nm) {
  const s = nm.get(e.source), t = nm.get(e.target);
  if (s && t && TUNNEL_TYPES.has(s.type) && TUNNEL_TYPES.has(t.type)) return 'tunnel';
  if (e.mediaType === 'fiber') return 'fiber';
  if (e.mediaType === 'copper') return 'copper';
  return 'unknown';
}

/* ── Tier order ── */
const TIER_ORDER = {
  firewall:0, router:0, core_switch:1, p2p_link:1, access_switch:2,
  access_point:3, server:3, nas:3, ups:4, printer:4, cctv:4, access_control:4, other:4,
};

const TYPE_ABBR = {
  firewall:'FW', core_switch:'CS', access_switch:'AS', access_point:'AP', router:'RT',
  server:'SV', nas:'NA', ups:'UP', cctv:'CC', printer:'PR', access_control:'AC', p2p_link:'P2', other:'?',
};

/* ── Preview tier layout: Y positions and radii (compact for 300px height) ── */
const PREVIEW_TIER_Y =      { 0:35, 1:85, 1.5:118, 2:158, 2.5:192, 3:228, 4:262 };
const PREVIEW_TIER_RADIUS = { 0:16, 1:13, 1.5:11,  2:7,   2.5:6,   3:5,   4:4   };
const PREVIEW_LIMITS =      { 0:999, 1:999, 1.5:20, 2:50,  2.5:30,  3:20,  4:10  };

/**
 * TopologyPreview — compact tiered network map for the Overview dashboard.
 * Matches the main topology page: device-type colors, fiber/copper/tunnel edges,
 * sub-tier layout, affinity-based root ordering.
 */
export default function TopologyPreview() {
  const router = useRouter();
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const { category } = useDeviceCategory();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState({ w: 600, h: 300 });

  /* ── Fetch topology ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', 'network');
      const res = await fetch(`/api/topology?${params}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Resize ── */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      if (width > 0) setDimensions({ w: width, h: 300 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Build mini hierarchy ── */
  function buildPreviewHierarchy(nodes, edges) {
    const nm = new Map();
    for (const n of nodes) nm.set(n.id, { ...n, tier: TIER_ORDER[n.type] ?? 4, children: [] });

    const adj = new Map();
    for (const n of nodes) adj.set(n.id, new Set());
    for (const e of edges) {
      if (adj.has(e.source) && adj.has(e.target)) {
        adj.get(e.source).add(e.target);
        adj.get(e.target).add(e.source);
      }
    }

    const tiers = [[], [], [], [], []];
    for (const n of nm.values()) tiers[Math.min(n.tier, 4)].push(n);

    const attached = new Set();
    const roots = [];

    // Tier 0: roots
    for (const n of tiers[0]) { attached.add(n.id); roots.push(n); }

    // Tier 1: attach or become root
    for (const node of tiers[1]) {
      const nb = adj.get(node.id) || new Set();
      let bp = null;
      for (const id of nb) { const n = nm.get(id); if (n && attached.has(n.id) && n.tier < node.tier) { bp = n; break; } }
      if (bp) { bp.children.push(node); } else { roots.push(node); }
      attached.add(node.id);
    }

    // Tier 2+: BFS
    for (let t = 2; t <= 4; t++) {
      const tierNodes = tiers[t];
      const remaining = new Set(tierNodes.map(n => n.id));

      for (const node of tierNodes) {
        const nb = adj.get(node.id) || new Set();
        let bp = null, bt = 99;
        for (const id of nb) { const n = nm.get(id); if (n && attached.has(n.id) && n.tier < t && n.tier < bt) { bp = n; bt = n.tier; } }
        if (bp) { bp.children.push(node); attached.add(node.id); remaining.delete(node.id); }
      }

      let changed = true;
      while (changed && remaining.size > 0) {
        changed = false;
        for (const nodeId of remaining) {
          const node = nm.get(nodeId);
          const nb = adj.get(nodeId) || new Set();
          for (const id of nb) {
            const n = nm.get(id);
            if (n && attached.has(n.id) && n.tier === t) {
              n.children.push(node); attached.add(nodeId); remaining.delete(nodeId); changed = true; break;
            }
          }
        }
      }
      for (const nodeId of remaining) attached.add(nodeId);
    }

    // Sub-tier assignment
    function assignSubTiers(node) {
      for (const child of node.children) {
        if (child.tier === Math.floor(node.tier) && child.tier === node.tier) {
          child.tier = child.tier + 0.5;
        }
        assignSubTiers(child);
      }
    }
    for (const r of roots) assignSubTiers(r);

    // Collect tree
    const att = new Set();
    function mark(n) { att.add(n.id); for (const c of n.children) mark(c); }
    for (const r of roots) mark(r);

    const orphans = [];
    for (const n of nm.values()) if (!att.has(n.id)) orphans.push(n);

    return { roots, orphans, nodeMap: nm };
  }

  /* ── D3 Render ── */
  useEffect(() => {
    if (!data?.nodes?.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = dimensions;
    const PAD = 20;
    const nm = new Map();
    for (const n of data.nodes) nm.set(n.id, n);

    const { roots, orphans } = buildPreviewHierarchy(data.nodes, data.edges);

    // ── Flatten tree to get positioned nodes ──
    const positioned = [];
    const tierBuckets = new Map(); // tier → [nodes]

    function collectNodes(node) {
      if (!tierBuckets.has(node.tier)) tierBuckets.set(node.tier, []);
      tierBuckets.get(node.tier).push(node);
      for (const c of node.children) collectNodes(c);
    }
    for (const r of roots) collectNodes(r);
    for (const o of orphans) {
      if (!tierBuckets.has(o.tier)) tierBuckets.set(o.tier, []);
      tierBuckets.get(o.tier).push(o);
    }

    // Apply preview limits per tier
    const visibleIds = new Set();
    const visibleNodes = [];
    const sortedTiers = [...tierBuckets.keys()].sort((a, b) => a - b);

    for (const tier of sortedTiers) {
      const nodes = tierBuckets.get(tier);
      const limit = PREVIEW_LIMITS[tier] ?? 10;
      for (let i = 0; i < Math.min(nodes.length, limit); i++) {
        visibleIds.add(nodes[i].id);
        visibleNodes.push(nodes[i]);
      }
    }

    // Position nodes in tiered rows
    const activeTiers = [...new Set(visibleNodes.map(n => n.tier))].sort((a, b) => a - b);
    const posMap = new Map();

    for (const tier of activeTiers) {
      const tierNodes = visibleNodes.filter(n => n.tier === tier);
      const y = PREVIEW_TIER_Y[tier] ?? (35 + tier * 50);
      const r = PREVIEW_TIER_RADIUS[tier] ?? 5;
      const availW = w - PAD * 2;
      const maxSpacing = tier <= 1.5 ? 70 : tier <= 2.5 ? 26 : 20;
      const spacing = Math.min(availW / Math.max(tierNodes.length, 1), maxSpacing);
      const startX = (w - (tierNodes.length - 1) * spacing) / 2;

      for (let i = 0; i < tierNodes.length; i++) {
        const n = tierNodes[i];
        posMap.set(n.id, { ...n, x: startX + i * spacing, y, radius: r });
      }
    }

    // Visible edges
    const visibleEdges = data.edges
      .filter(e => posMap.has(e.source) && posMap.has(e.target))
      .map(e => ({
        source: posMap.get(e.source),
        target: posMap.get(e.target),
        mediaClass: classifyEdge(e, nm),
      }));

    const g = svg.append('g');

    // ── Edges with media type styling ──
    g.append('g').selectAll('path').data(visibleEdges).join('path')
      .attr('d', e => {
        const sx = e.source.x, sy = e.source.y, tx = e.target.x, ty = e.target.y;
        if (Math.abs(sy - ty) < 5) {
          const mx = (sx + tx) / 2, my = sy - 12;
          return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
        }
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('fill', 'none')
      .attr('stroke', e => EDGE_STYLES[e.mediaClass].color)
      .attr('stroke-width', e => EDGE_STYLES[e.mediaClass].width)
      .attr('stroke-dasharray', e => EDGE_STYLES[e.mediaClass].dash)
      .attr('stroke-opacity', e => EDGE_STYLES[e.mediaClass].opacity);

    // ── Nodes with device-type + vendor colors ──
    const allPos = Array.from(posMap.values());
    const node = g.append('g').selectAll('g').data(allPos).join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Status ring
    node.append('circle')
      .attr('r', d => d.radius + 2)
      .attr('fill', 'none')
      .attr('stroke', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).color)
      .attr('stroke-width', d => d.tier <= 1.5 ? 1.2 : 0.6)
      .attr('stroke-dasharray', d => (STATUS_CFG[d.status] || STATUS_CFG.unknown).dash)
      .attr('stroke-opacity', 0.4);

    // Body circle — device-type color
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const c = getDeviceColor(d.type, d.make);
        return d.tier <= 1.5 ? c + '30' : c + '1A';
      })
      .attr('stroke', d => getDeviceColor(d.type, d.make))
      .attr('stroke-width', d => d.tier <= 1.5 ? 1.5 : 0.8);

    // Type abbreviation on tier 0-1.5
    node.filter(d => d.tier <= 1.5 && d.radius >= 10)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(6, d.radius * 0.5))
      .attr('font-weight', 700)
      .attr('fill', d => getDeviceColor(d.type, d.make))
      .attr('pointer-events', 'none')
      .text(d => TYPE_ABBR[d.type] || '?');

    // Tooltip
    node.append('title')
      .text(d => `${d.name}\n${(d.type || '').replace(/_/g, ' ')} · ${d.status}${d.make ? '\n' + d.make : ''}`);

  }, [data, dimensions]);

  /* ── Edge media counts ── */
  const mediaCounts = data?.edges ? (() => {
    const nm = new Map();
    for (const n of data.nodes) nm.set(n.id, n);
    const c = { fiber: 0, copper: 0, tunnel: 0 };
    for (const e of data.edges) {
      const mc = classifyEdge(e, nm);
      if (c[mc] !== undefined) c[mc]++;
    }
    return c;
  })() : null;

  /* ── Status summary ── */
  const statusSummary = data?.nodes ? {
    total: data.nodes.length,
    up: data.nodes.filter(n => n.status === 'up').length,
    down: data.nodes.filter(n => n.status === 'down').length,
    edges: data.edges.length,
  } : null;

  return (
    <div className="tp-preview">
      <div className="tp-preview-header">
        <div className="tp-preview-header-left">
          <h3 className="tp-preview-title">Network Topology</h3>
<button
  onClick={(e) => { e.stopPropagation(); const el = e.currentTarget.nextElementSibling; if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }}
  title="What is this?"
  style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:18, height:18, borderRadius:'50%', border:'1px solid var(--color-vemio-border)', background:'transparent', color:'var(--color-vemio-text-dim)', cursor:'pointer', padding:0, flexShrink:0, boxSizing:'border-box', lineHeight:0, verticalAlign:'middle' }}
>
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
</button>
<div style={{ display:'none', fontSize:11, lineHeight:1.5, color:'var(--color-vemio-text-muted)', background:'var(--color-vemio-surface-raised)', border:'1px solid var(--color-vemio-border)', borderRadius:8, padding:'10px 12px', position:'absolute', top:44, left:16, right:16, zIndex:10 }}>
  Live network topology showing device hierarchy, connection types (fiber/copper/tunnel), and current status. Click to open the full interactive map.
</div>
          {statusSummary && (
            <p className="tp-preview-sub">
              {statusSummary.total} devices · {statusSummary.edges} connections
              {statusSummary.down > 0 && (
                <span className="tp-preview-down"> · {statusSummary.down} offline</span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={() => router.push('/topology')}
          className="tp-preview-link"
        >
          <span>Full Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div ref={wrapRef} className="tp-preview-graph">
        {loading && !data && (
          <div className="tp-preview-loading">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--color-vemio-text-dim)' }} />
          </div>
        )}

        {!loading && (!data || data.nodes?.length === 0) && (
          <div className="tp-preview-empty">
            <Network className="w-8 h-8" style={{ color: 'var(--color-vemio-text-dim)', opacity: 0.4 }} />
            <p>No topology data yet</p>
          </div>
        )}

        <svg
          ref={svgRef}
          width={dimensions.w}
          height={dimensions.h}
          style={{ display: data?.nodes?.length ? 'block' : 'none', cursor: 'pointer' }}
          onClick={() => router.push('/topology')}
        />
      </div>

      {/* Mini legend — status + media types */}
      {data?.nodes?.length > 0 && (
        <div className="tp-preview-legend">
          {[
            { label: 'Online', color: STATUS_CFG.up.color },
            { label: 'Offline', color: STATUS_CFG.down.color },
            { label: 'Degraded', color: STATUS_CFG.degraded.color },
          ].map(s => (
            <span key={s.label} className="tp-preview-legend-item">
              <span className="tp-preview-legend-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <span className="tp-preview-legend-sep" />
          {mediaCounts?.fiber > 0 && (
            <span className="tp-preview-legend-item">
              <span className="tp-preview-legend-line" style={{ background: EDGE_STYLES.fiber.color }} />
              Fiber ({mediaCounts.fiber})
            </span>
          )}
          {mediaCounts?.copper > 0 && (
            <span className="tp-preview-legend-item">
              <span className="tp-preview-legend-line" style={{ background: 'rgba(148,163,184,0.5)' }} />
              Copper ({mediaCounts.copper})
            </span>
          )}
          {mediaCounts?.tunnel > 0 && (
            <span className="tp-preview-legend-item">
              <span className="tp-preview-legend-line tp-preview-legend-line--tunnel" />
              Tunnel ({mediaCounts.tunnel})
            </span>
          )}
          <span className="tp-preview-legend-hint">Click to explore →</span>
        </div>
      )}

      <style>{`
        .tp-preview {
          border-radius: 16px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          overflow: visible;
        }
        .tp-preview-header {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px 12px;
          gap: 12px;
        }
        .tp-preview-header-left { min-width: 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .tp-preview-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
        }
        .tp-preview-sub {
  font-size: 11px;
  color: var(--color-vemio-text-dim);
  margin: 2px 0 0;
  width: 100%;
        }
        .tp-preview-down {
          color: var(--color-status-down);
          font-weight: 600;
        }
        .tp-preview-link {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--color-vemio-border);
          background: transparent;
          color: var(--color-vemio-text-muted);
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .tp-preview-link:hover {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-amber);
        }
        .tp-preview-graph {
          width: 100%;
          height: 300px;
          position: relative;
          overflow: hidden;
        }
        .tp-preview-graph svg { display: block; }
        .tp-preview-loading,
        .tp-preview-empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          color: var(--color-vemio-text-dim);
        }
        .tp-preview-legend {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          border-top: 1px solid var(--color-vemio-border);
          flex-wrap: wrap;
        }
        .tp-preview-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          white-space: nowrap;
        }
        .tp-preview-legend-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tp-preview-legend-line {
          width: 12px;
          height: 2px;
          border-radius: 1px;
          flex-shrink: 0;
        }
        .tp-preview-legend-line--tunnel {
          width: 12px;
          height: 0;
          border-top: 1.5px dashed #06B6D4;
          background: none;
        }
        .tp-preview-legend-sep {
          width: 1px;
          height: 10px;
          background: var(--color-vemio-border);
          flex-shrink: 0;
        }
        .tp-preview-legend-hint {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          opacity: 0.5;
          margin-left: auto;
        }
        @media (max-width: 479px) {
          .tp-preview-header { padding: 12px 14px 10px; }
          .tp-preview-legend { padding: 6px 14px; gap: 8px; }
          .tp-preview-graph { height: 240px; }
          .tp-preview-legend-hint { display: none; }
          .tp-preview-legend-sep { display: none; }
        }
      `}</style>
    </div>
  );
}