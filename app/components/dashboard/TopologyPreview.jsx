'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Network, ArrowRight, RefreshCw } from 'lucide-react';
import * as d3 from 'd3';
import { useDeviceCategory } from '@/contexts/DeviceCategoryContext';

/* ── Status colors ── */
const STATUS_COLOR = {
  up:       '#22c55e',
  down:     '#ef4444',
  degraded: '#f59e0b',
  unknown:  '#6b7280',
};

/* ── Tier order ── */
const TIER_ORDER = {
  firewall: 0, router: 0,
  core_switch: 1, p2p_link: 1,
  access_switch: 2,
  access_point: 3, server: 3,
  nas: 3, ups: 4, printer: 4,
  cctv: 4, access_control: 4, other: 4,
};

const TYPE_ABBR = {
  firewall: 'FW', core_switch: 'CS', access_switch: 'AS',
  access_point: 'AP', router: 'RT', server: 'SV',
  nas: 'NA', ups: 'UP', cctv: 'CC', printer: 'PR',
  access_control: 'AC', p2p_link: 'P2', other: '?',
};

const TIER_RADIUS = { 0: 18, 1: 15, 2: 8, 3: 6, 4: 5 };

/**
 * TopologyPreview — compact tiered network map for the Overview dashboard.
 * Shows devices in a hierarchical layout matching the main topology page.
 * Click to navigate to the full topology page.
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

  /* ── D3 Render — tiered layout ── */
  useEffect(() => {
    if (!data?.nodes?.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = dimensions;
    const PAD_X = 30;
    const PAD_TOP = 20;

    // Assign tiers and limit to ~80 nodes for preview
    const allNodes = data.nodes.map(n => ({
      ...n,
      tier: TIER_ORDER[n.type] ?? 4,
      radius: TIER_RADIUS[TIER_ORDER[n.type] ?? 4] || 5,
    }));

    // Sort by tier, take top nodes per tier for preview
    const tiers = {};
    for (const n of allNodes) {
      if (!tiers[n.tier]) tiers[n.tier] = [];
      tiers[n.tier].push(n);
    }

    // Limit: show all tier 0-1, up to 40 tier 2, up to 20 tier 3+
    const LIMITS = { 0: 999, 1: 999, 2: 40, 3: 20, 4: 10 };
    const visibleNodes = [];
    for (const [tier, nodes] of Object.entries(tiers)) {
      const limit = LIMITS[tier] ?? 10;
      visibleNodes.push(...nodes.slice(0, limit));
    }

    const visibleIds = new Set(visibleNodes.map(n => n.id));
    const edges = data.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

    // Group by tier for layout
    const activeTiers = [...new Set(visibleNodes.map(n => n.tier))].sort((a, b) => a - b);
    const tierCount = activeTiers.length;
    const tierGap = (h - PAD_TOP * 2) / Math.max(tierCount, 1);

    // Position nodes in tiered rows
    const nodeMap = new Map();
    for (let ti = 0; ti < activeTiers.length; ti++) {
      const tierIdx = activeTiers[ti];
      const tierNodes = visibleNodes.filter(n => n.tier === tierIdx);
      const y = PAD_TOP + ti * tierGap + tierGap / 2;
      const availW = w - PAD_X * 2;
      const spacing = Math.min(availW / Math.max(tierNodes.length, 1), tierIdx <= 1 ? 70 : 30);
      const startX = (w - (tierNodes.length - 1) * spacing) / 2;

      for (let ni = 0; ni < tierNodes.length; ni++) {
        const n = tierNodes[ni];
        n.x = startX + ni * spacing;
        n.y = y;
        nodeMap.set(n.id, n);
      }
    }

    // Resolve edges
    const resolvedEdges = edges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({ source: nodeMap.get(e.source), target: nodeMap.get(e.target) }));

    const g = svg.append('g');

    // Edges
    g.append('g')
      .selectAll('path')
      .data(resolvedEdges)
      .join('path')
      .attr('d', e => {
        const sx = e.source.x, sy = e.source.y;
        const tx = e.target.x, ty = e.target.y;
        if (Math.abs(sy - ty) < 5) {
          const mx = (sx + tx) / 2, my = sy - 15;
          return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
        }
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'rgba(148,163,184,0.10)')
      .attr('stroke-width', 0.7);

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(visibleNodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // Circle
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const c = STATUS_COLOR[d.status] || STATUS_COLOR.unknown;
        return d.tier <= 1 ? c + '28' : c + '18';
      })
      .attr('stroke', d => STATUS_COLOR[d.status] || STATUS_COLOR.unknown)
      .attr('stroke-width', d => d.tier <= 1 ? 1.5 : 0.7);

    // Label on tier 0-1 only
    node.filter(d => d.tier <= 1)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(7, d.radius * 0.5))
      .attr('font-weight', 700)
      .attr('fill', d => STATUS_COLOR[d.status] || STATUS_COLOR.unknown)
      .attr('pointer-events', 'none')
      .text(d => TYPE_ABBR[d.type] || '?');

    // Tooltip
    node.append('title')
      .text(d => `${d.name}\n${d.type?.replace('_', ' ')} · ${d.status}`);

  }, [data, dimensions]);

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

      {/* Mini legend */}
      {data?.nodes?.length > 0 && (
        <div className="tp-preview-legend">
          {[
            { label: 'Online', color: STATUS_COLOR.up },
            { label: 'Offline', color: STATUS_COLOR.down },
            { label: 'Degraded', color: STATUS_COLOR.degraded },
          ].map(s => (
            <span key={s.label} className="tp-preview-legend-item">
              <span className="tp-preview-legend-dot" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <span className="tp-preview-legend-hint">Click to explore →</span>
        </div>
      )}

      <style>{`
        .tp-preview {
          border-radius: 16px;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          overflow: hidden;
        }
        .tp-preview-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 16px 20px 12px;
          gap: 12px;
        }
        .tp-preview-header-left { min-width: 0; }
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
          gap: 12px;
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
        }
        .tp-preview-legend-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
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
        }
      `}</style>
    </div>
  );
}