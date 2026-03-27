'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network, X, RefreshCw, Filter,
  Shield, MonitorSpeaker, Wifi, HardDrive, Radio, Cpu, Server,
  Printer, Camera, Lock, Zap, Globe, CircleDot,
} from 'lucide-react';
import * as d3 from 'd3';

/* ── Status config (matches devices page) ── */
const STATUS_CONFIG = {
  up:       { label: 'Online',   color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  down:     { label: 'Offline',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  degraded: { label: 'Degraded', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  unknown:  { label: 'Unknown',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)'},
};

/* ── Device type → Lucide icon component ── */
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

/* ── Device type → node radius ── */
const TYPE_RADIUS = {
  firewall:     22,
  core_switch:  20,
  router:       18,
  server:       16,
  access_switch:14,
  access_point: 12,
};
const DEFAULT_RADIUS = 13;

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/* ================================================================
   TOPOLOGY PAGE
   ================================================================ */
export default function TopologyPage() {
  const svgRef     = useRef(null);
  const wrapRef    = useRef(null);
  const simRef     = useRef(null);

  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [sites, setSites]           = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [selected, setSelected]     = useState(null);   // clicked node
  const [hovered, setHovered]       = useState(null);    // hovered node id
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });

  /* ── Fetch sites for filter dropdown ── */
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
  }, [selectedSite]);

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

  /* ── D3 Force Simulation ── */
  useEffect(() => {
    if (!data || !svgRef.current) return;
    const { nodes: rawNodes, edges: rawEdges } = data;
    if (!rawNodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { w, h } = dimensions;

    // Deep copy for D3 mutation
    const nodes = rawNodes.map(n => ({ ...n, radius: TYPE_RADIUS[n.type] || DEFAULT_RADIUS }));
    const edges = rawEdges.map(e => ({ ...e }));

    // Container group for zoom/pan
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Initial centering
    svg.call(zoom.transform, d3.zoomIdentity.translate(w / 2, h / 2).scale(0.8));

    // Simulation
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(100).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-300).distanceMax(500))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(d => d.radius + 6));

    simRef.current = sim;

    // ── Edges ──
    const linkG = g.append('g').attr('class', 'topo-links');
    const link = linkG.selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', 'rgba(148,163,184,0.15)')
      .attr('stroke-width', 1.2);

    // ── Node groups ──
    const nodeG = g.append('g').attr('class', 'topo-nodes');
    const node = nodeG.selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    // Outer glow ring
    node.append('circle')
      .attr('r', d => d.radius + 4)
      .attr('fill', 'none')
      .attr('stroke', d => (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.2);

    // Main circle
    node.append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => {
        const c = (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color;
        // Muted fill for non-core devices
        return d.radius >= 18 ? c + '30' : c + '18';
      })
      .attr('stroke', d => (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color)
      .attr('stroke-width', 1.5);

    // Device type icon (as text glyph — first letter fallback)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', d => Math.max(9, d.radius * 0.6))
      .attr('font-weight', 600)
      .attr('fill', d => (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color)
      .attr('pointer-events', 'none')
      .text(d => {
        const abbr = {
          firewall: 'FW', core_switch: 'CS', access_switch: 'AS',
          access_point: 'AP', router: 'RT', server: 'SV',
          nas: 'NA', ups: 'UP', cctv: 'CC', printer: 'PR',
          access_control: 'AC', p2p_link: 'P2', other: '?',
        };
        return abbr[d.type] || '?';
      });

    // Label below node
    node.append('text')
      .attr('y', d => d.radius + 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', 'rgba(148,163,184,0.7)')
      .attr('pointer-events', 'none')
      .text(d => d.name?.length > 20 ? d.name.slice(0, 18) + '…' : d.name);

    // Click → inspector
    node.on('click', (event, d) => {
      event.stopPropagation();
      setSelected(prev => prev?.id === d.id ? null : d);
    });

    // Hover highlight
    node.on('mouseenter', (event, d) => {
      setHovered(d.id);
      // Highlight connected edges
      link
        .attr('stroke', e =>
          (e.source.id === d.id || e.target.id === d.id)
            ? (STATUS_CONFIG[d.status] || STATUS_CONFIG.unknown).color
            : 'rgba(148,163,184,0.08)'
        )
        .attr('stroke-width', e =>
          (e.source.id === d.id || e.target.id === d.id) ? 2 : 0.8
        );
    });

    node.on('mouseleave', () => {
      setHovered(null);
      link
        .attr('stroke', 'rgba(148,163,184,0.15)')
        .attr('stroke-width', 1.2);
    });

    // Click background → deselect
    svg.on('click', () => setSelected(null));

    // Tick
    sim.on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => { sim.stop(); };
  }, [data, dimensions]);

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
      if (e.source === selected.id || e.source?.id === selected.id) neighborIds.add(e.target?.id || e.target);
      if (e.target === selected.id || e.target?.id === selected.id) neighborIds.add(e.source?.id || e.source);
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
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => (
                    <span key={type} className="tp-legend-item">
                      <span className="tp-legend-abbr">
                        {{ firewall:'FW', core_switch:'CS', access_switch:'AS', access_point:'AP',
                           router:'RT', server:'SV', nas:'NA', ups:'UP', cctv:'CC', printer:'PR',
                           access_control:'AC', p2p_link:'P2', other:'?' }[type] || '?'}
                      </span>
                      {type.replace(/_/g, ' ')} ({count})
                    </span>
                  ))
                }
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Inspector Panel (slides in from right) ── */}
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
        /* ── Root ── */
        .tp-root {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 1400px;
          position: relative;
        }

        /* ── Header ── */
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

        /* ── Graph panel ── */
        .tp-graph-panel {
          border-radius: 16px;
          overflow: hidden;
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          position: relative;
        }
        .tp-graph-wrap {
          width: 100%;
          height: clamp(400px, 60vh, 720px);
          position: relative;
          overflow: hidden;
        }
        .tp-graph-wrap svg {
          display: block;
          background: transparent;
        }

        /* Loading */
        .tp-loading {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 13px;
          color: var(--color-vemio-text-dim);
        }
        .tp-loading-spinner {
          width: 28px;
          height: 28px;
          border: 2.5px solid rgba(148,163,184,0.15);
          border-top-color: rgba(245,158,11,0.6);
          border-radius: 50%;
          animation: tp-spin 0.8s linear infinite;
        }
        @keyframes tp-spin { to { transform: rotate(360deg); } }

        /* Empty / error */
        .tp-empty {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 13px;
          color: var(--color-vemio-text-muted);
        }
        .tp-retry-btn {
          margin-top: 8px;
          padding: 6px 16px;
          border-radius: 8px;
          font-size: 12px;
          background: var(--color-vemio-surface-raised);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          cursor: pointer;
        }
        .tp-retry-btn:hover { border-color: var(--color-vemio-text-dim); }

        /* ── Legend ── */
        .tp-legend {
          display: flex;
          gap: 24px;
          padding: 10px 16px;
          border-top: 1px solid var(--color-vemio-border);
          flex-wrap: wrap;
        }
        .tp-legend-section {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .tp-legend-title {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          color: var(--color-vemio-text-dim);
          margin-right: 2px;
        }
        .tp-legend-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: var(--color-vemio-text-muted);
          white-space: nowrap;
        }
        .tp-legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .tp-legend-abbr {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 14px;
          border-radius: 3px;
          font-size: 8px;
          font-weight: 700;
          background: rgba(148,163,184,0.1);
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
          text-transform: uppercase;
        }

        /* ── Inspector Panel ── */
        .tp-inspector {
          position: absolute;
          top: 52px;
          right: 0;
          width: 320px;
          max-height: calc(100% - 64px);
          overflow-y: auto;
          background: var(--color-vemio-bg);
          border: 1px solid var(--color-vemio-border);
          border-radius: 14px;
          padding: 16px;
          z-index: 20;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.35);
        }
        @media (max-width: 639px) {
          .tp-inspector {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            max-height: 55vh;
            border-radius: 16px 16px 0 0;
          }
        }
        .tp-insp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .tp-insp-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tp-insp-close {
          padding: 4px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--color-vemio-text-dim);
          cursor: pointer;
          display: flex;
          flex-shrink: 0;
        }
        .tp-insp-close:hover { background: rgba(255,255,255,0.05); }

        .tp-insp-status { display: flex; }
        .tp-insp-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .tp-insp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .tp-insp-fields {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .tp-field {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
        }
        .tp-field-label {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          flex-shrink: 0;
        }
        .tp-field-value {
          font-size: 12px;
          color: var(--color-vemio-text-muted);
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-transform: capitalize;
        }
        .tp-field-value--mono {
          font-family: monospace;
          font-size: 11px;
          text-transform: none;
        }

        /* Neighbors */
        .tp-insp-neighbors {
          display: flex;
          flex-direction: column;
          gap: 6px;
          border-top: 1px solid var(--color-vemio-border);
          padding-top: 12px;
        }
        .tp-insp-nbr-title {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          font-weight: 600;
          color: var(--color-vemio-text-dim);
        }
        .tp-insp-nbr-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 200px;
          overflow-y: auto;
        }
        .tp-insp-nbr-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 8px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          text-align: left;
          transition: background 0.12s;
          color: inherit;
        }
        .tp-insp-nbr-item:hover { background: rgba(255,255,255,0.04); }
        .tp-insp-nbr-name {
          font-size: 12px;
          color: var(--vemio-text);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }
        .tp-insp-nbr-type {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
          text-transform: capitalize;
          flex-shrink: 0;
        }

        /* ── Mobile adjustments ── */
        @media (max-width: 479px) {
          .tp-site-select { min-width: 100px; font-size: 12px; }
          .tp-legend { padding: 8px 10px; gap: 12px; }
        }
      `}</style>
    </>
  );
}

/* ── Tiny field component ── */
function Field({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="tp-field">
      <span className="tp-field-label">{label}</span>
      <span className={`tp-field-value ${mono ? 'tp-field-value--mono' : ''}`}>{value}</span>
    </div>
  );
}
