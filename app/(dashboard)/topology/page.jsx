'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, X, RefreshCw, Globe,
  Shield, MonitorSpeaker, Wifi, HardDrive, Radio, Cpu, Server,
  Printer, Camera, Lock, Zap, CircleDot,
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

/* ── Tier definitions: device_type → tier index ──
   Lower tier = higher in the diagram (closer to Internet) */
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
const TIER_RADIUS = { 0: 24, 1: 20, 2: 16, 3: 13, 4: 11 };

/* ── Type abbreviations ── */
const TYPE_ABBR = {
  firewall: 'FW', core_switch: 'CS', access_switch: 'AS',
  access_point: 'AP', router: 'RT', server: 'SV',
  nas: 'NA', ups: 'UP', cctv: 'CC', printer: 'PR',
  access_control: 'AC', p2p_link: 'P2', other: '?',
};

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ================================================================
   TOPOLOGY PAGE — Hierarchical Tiered Layout
   ================================================================ */
export default function TopologyPage() {
  const svgRef     = useRef(null);
  const wrapRef    = useRef(null);

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [sites, setSites]           = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [category, setCategory]     = useState('network');
  const [selected, setSelected]     = useState(null);
  const [dimensions, setDimensions] = useState({ w: 1200, h: 700 });

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

  /* ── Compute tiers ── */
  const tierData = useMemo(() => {
    if (!data?.nodes) return null;

    // Group nodes by tier
    const tiers = {};
    for (const node of data.nodes) {
      const tierIdx = TIER_ORDER[node.type] ?? 4;
      if (!tiers[tierIdx]) tiers[tierIdx] = [];
      tiers[tierIdx].push({ ...node, tier: tierIdx });
    }

    // Get sorted tier indices that actually have nodes
    const activeTiers = Object.keys(tiers).map(Number).sort((a, b) => a - b);

    return { tiers, activeTiers };
  }, [data]);

  /* ── D3 Hierarchical Render ── */
  useEffect(() => {
    if (!data || !tierData || !svgRef.current) return;
    const { nodes: rawNodes, edges: rawEdges } = data;
    if (!rawNodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = dimensions;
    const { tiers, activeTiers } = tierData;

    // Layout parameters
    const tierCount = activeTiers.length;
    const topPad = 60;
    const bottomPad = 40;
    const tierSpacing = (h - topPad - bottomPad) / Math.max(tierCount, 1);
    const sidePad = 60;

    // Assign x,y positions to each node
    const nodeMap = new Map();
    const allNodes = [];

    for (let ti = 0; ti < activeTiers.length; ti++) {
      const tierIdx = activeTiers[ti];
      const tierNodes = tiers[tierIdx];
      const y = topPad + ti * tierSpacing + tierSpacing / 2;
      const nodeCount = tierNodes.length;
      const availableWidth = w - sidePad * 2;
      const spacing = Math.min(availableWidth / Math.max(nodeCount, 1), 80);
      const startX = (w - (nodeCount - 1) * spacing) / 2;

      for (let ni = 0; ni < tierNodes.length; ni++) {
        const node = tierNodes[ni];
        node.x = startX + ni * spacing;
        node.y = y;
        node.radius = TIER_RADIUS[tierIdx] || 11;
        nodeMap.set(node.id, node);
        allNodes.push(node);
      }
    }

    // Resolve edges to positioned nodes
    const edges = rawEdges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source),
        target: nodeMap.get(e.target),
      }));

    // Container group for zoom/pan
    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Fit content with initial transform
    const initialScale = Math.min(1, w / (w + 100));
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(initialScale));

    // ── Internet icon at top ──
    const internetY = topPad - 10;
    const internetG = g.append('g').attr('transform', `translate(${w / 2}, ${internetY})`);
    internetG.append('circle')
      .attr('r', 18)
      .attr('fill', 'rgba(59,130,246,0.12)')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 1.5);
    internetG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', 9)
      .attr('font-weight', 700)
      .attr('fill', '#3b82f6')
      .text('WAN');
    internetG.append('text')
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', 'rgba(148,163,184,0.6)')
      .text('Internet');

    // Draw line from Internet to first tier center
    if (activeTiers.length > 0) {
      const firstTier = activeTiers[0];
      const firstNodes = tiers[firstTier];
      // Connect to each firewall/router
      for (const fn of firstNodes) {
        g.append('line')
          .attr('x1', w / 2).attr('y1', internetY + 18)
          .attr('x2', fn.x).attr('y2', fn.y - fn.radius - 4)
          .attr('stroke', 'rgba(59,130,246,0.2)')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,3');
      }
    }

    // ── Tier labels ──
    for (let ti = 0; ti < activeTiers.length; ti++) {
      const tierIdx = activeTiers[ti];
      const y = topPad + ti * tierSpacing + tierSpacing / 2;
      g.append('text')
        .attr('x', 12)
        .attr('y', y - tierSpacing / 2 + 14)
        .attr('font-size', 8)
        .attr('fill', 'rgba(148,163,184,0.4)')
        .attr('text-transform', 'uppercase')
        .attr('letter-spacing', '0.08em')
        .attr('font-weight', 600)
        .text(TIER_LABELS[tierIdx] || `Tier ${tierIdx}`);

      // Tier separator line
      if (ti > 0) {
        g.append('line')
          .attr('x1', 10).attr('x2', w - 10)
          .attr('y1', y - tierSpacing / 2)
          .attr('y2', y - tierSpacing / 2)
          .attr('stroke', 'rgba(148,163,184,0.08)')
          .attr('stroke-width', 1);
      }
    }

    // ── Edges ──
    const linkG = g.append('g');
    linkG.selectAll('path')
      .data(edges)
      .join('path')
      .attr('d', e => {
        const sx = e.source.x, sy = e.source.y;
        const tx = e.target.x, ty = e.target.y;
        // Curved edges for cross-tier, straight for same-tier
        if (Math.abs(sy - ty) < 5) {
          // Same tier — arc
          const mx = (sx + tx) / 2;
          const my = sy - 30;
          return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
        }
        // Different tier — gentle curve
        const my = (sy + ty) / 2;
        return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
      })
      .attr('fill', 'none')
      .attr('stroke', 'rgba(148,163,184,0.12)')
      .attr('stroke-width', 1);

    // ── Nodes ──
    const nodeG = g.append('g');
    const node = nodeG.selectAll('g')
      .data(allNodes)
      .join('g')
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .attr('cursor', 'pointer');

    // Outer glow
    node.append('circle')
      .attr('r', d => d.radius + 3)
      .attr('fill', 'none')
      .attr('stroke', d => (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.2);

    // Main circle
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const c = (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
        return d.tier <= 1 ? c + '25' : c + '15';
      })
      .attr('stroke', d => (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color)
      .attr('stroke-width', 1.5);

    // Type abbreviation
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(8, d.radius * 0.55))
      .attr('font-weight', 700)
      .attr('fill', d => (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color)
      .attr('pointer-events', 'none')
      .text(d => TYPE_ABBR[d.type] || '?');

    // Label below node
    node.append('text')
      .attr('y', d => d.radius + 12)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('fill', 'rgba(148,163,184,0.6)')
      .attr('pointer-events', 'none')
      .text(d => d.name?.length > 18 ? d.name.slice(0, 16) + '…' : d.name);

    // Click → inspector
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelected(prev => prev?.id === d.id ? null : d);
    });

    // Hover highlight
    node.on('mouseenter', (event, d) => {
      linkG.selectAll('path')
        .attr('stroke', e =>
          (e.source.id === d.id || e.target.id === d.id)
            ? (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color
            : 'rgba(148,163,184,0.06)'
        )
        .attr('stroke-width', e =>
          (e.source.id === d.id || e.target.id === d.id) ? 2 : 0.8
        );
    });

    node.on('mouseleave', () => {
      linkG.selectAll('path')
        .attr('stroke', 'rgba(148,163,184,0.12)')
        .attr('stroke-width', 1);
    });

    // Click background → deselect
    svg.on('click', () => setSelected(null));

  }, [data, tierData, dimensions]);

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
              {data ? `${data.nodes.length} devices · ${data.edges.length} connections` : 'Loading…'}
            </p>
          </div>
          <div className="tp-header-actions">
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