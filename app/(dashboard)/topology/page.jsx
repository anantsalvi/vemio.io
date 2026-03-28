// ════════════════════════════════════════════════════════
//  TopologyPage  →  app/(dashboard)/topology/page.jsx
//  Hierarchical tiered layout · device-type + vendor colors
//  Fiber/Copper/Tunnel edge types · Search/Locate
// ════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, X, RefreshCw, Search, Minus, Plus, Maximize2, Crosshair } from 'lucide-react';
import * as d3 from 'd3';

/* ═══════════ DEVICE COLOR SYSTEM ═══════════ */
const TYPE_COLORS = {
  firewall:'#EF4444', router:'#F97316', core_switch:'#3B82F6', access_switch:'#10B981',
  access_point:'#A855F7', server:'#6366F1', p2p_link:'#06B6D4', nas:'#8B5CF6',
  ups:'#F87171', printer:'#84CC16', cctv:'#14B8A6', access_control:'#C084FC', other:'#9CA3AF',
};
const VENDOR_COLORS = {
  'firewall:Fortinet':'#DC2626','firewall:Sophos':'#EA580C',
  'core_switch:Cisco':'#2563EB','core_switch:HP':'#0891B2',
  'access_point:Ruckus':'#EC4899','access_point:Fortinet':'#F59E0B','access_point:Aruba':'#06B6D4',
  'access_point:Cambium':'#8B5CF6','access_point:Cisco':'#3B82F6','access_point:Netgear':'#84CC16',
  'router:Cisco':'#FB923C',
};
function getDeviceColor(type, make) {
  if (make) { const k = `${type}:${make}`; if (VENDOR_COLORS[k]) return VENDOR_COLORS[k]; }
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

/* ═══════════ STATUS (ring style) ═══════════ */
const STATUS_CFG = {
  up:       { label:'Online',   color:'#22c55e', dash:'none', width:2   },
  down:     { label:'Offline',  color:'#ef4444', dash:'none', width:2.5 },
  degraded: { label:'Degraded', color:'#f59e0b', dash:'4,3',  width:2   },
  unknown:  { label:'Unknown',  color:'#6b7280', dash:'2,2',  width:1.5 },
};

/* ═══════════ EDGE / LINK STYLES ═══════════ */
const TUNNEL_TYPES = new Set(['router','firewall','p2p_link']);
const EDGE_STYLES = {
  fiber:   { color:'#F97316', width:2,   dash:'none', opacity:0.7 },
  copper:  { color:'rgba(148,163,184,0.30)', width:0.8, dash:'none', opacity:1 },
  tunnel:  { color:'#06B6D4', width:2,   dash:'8,4',  opacity:0.7 },
  unknown: { color:'rgba(148,163,184,0.12)', width:0.8, dash:'none', opacity:1 },
};
function getEdgeStyle(edge) {
  // Tunnel takes priority
  if (edge.isTunnel) return EDGE_STYLES.tunnel;
  // If we have real media data from device_interfaces
  if (edge.mediaType === 'fiber') return EDGE_STYLES.fiber;
  if (edge.mediaType === 'copper') return EDGE_STYLES.copper;
  return EDGE_STYLES.unknown;
}

/* ═══════════ TIER CONSTANTS ═══════════ */
const TIER_ORDER = {
  firewall:0, router:0, core_switch:1, p2p_link:1, access_switch:2,
  access_point:3, server:3, nas:3, ups:4, printer:4, cctv:4, access_control:4, other:4,
};
const TIER_LABELS = ['Firewalls & Routers','Core / Distribution','Access Switches','APs · Servers · Endpoints','Peripherals'];
const TYPE_ABBR = {
  firewall:'FW', core_switch:'CS', access_switch:'AS', access_point:'AP', router:'RT',
  server:'SV', nas:'NA', ups:'UP', cctv:'CC', printer:'PR', access_control:'AC', p2p_link:'P2', other:'··',
};
const TIER_RADIUS = [26,22,14,10,8];
const fadeUp = { hidden:{opacity:0,y:16}, visible:{opacity:1,y:0,transition:{duration:0.4,ease:[0.22,1,0.36,1]}} };

/* ═══════════ HIERARCHY BUILDER ═══════════ */
function buildHierarchy(nodes, edges) {
  const nm = new Map();
  for (const n of nodes) nm.set(n.id, {...n, tier:TIER_ORDER[n.type]??4, children:[]});
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) { if (adj.has(e.source)&&adj.has(e.target)) { adj.get(e.source).add(e.target); adj.get(e.target).add(e.source); } }
  const tiers=[[],[],[],[],[]];
  for (const n of nm.values()) tiers[Math.min(n.tier,4)].push(n);
  const assigned=new Set(), roots=[];
  for (const n of tiers[0]) { assigned.add(n.id); roots.push(n); }
  for (let t=1;t<=4;t++) for (const node of tiers[t]) {
    const nb=adj.get(node.id)||new Set(); let bp=null,bt=99;
    for (const id of nb) { const n=nm.get(id); if (n&&assigned.has(n.id)&&n.tier<t&&n.tier<bt) {bp=n;bt=n.tier;} }
    if (!bp) for (const id of nb) { const n=nm.get(id); if (n&&assigned.has(n.id)&&n.tier===t) {bp=n;break;} }
    if (bp) bp.children.push(node);
    assigned.add(node.id);
  }
  const att=new Set();
  function mark(n){att.add(n.id);for(const c of n.children)mark(c);}
  for (const r of roots) mark(r);
  const orphans=[]; for (const n of nm.values()) if (!att.has(n.id)) orphans.push(n);
  return {roots,orphans,nodeMap:nm,adj};
}

/* ═══════════ LAYOUT ENGINE ═══════════ */
function layoutHierarchy(roots, orphans) {
  const pos=new Map(); const TY=[80,180,310,450,560]; const MS={0:100,1:90,2:60,3:36,4:30}; const P=30;
  const wc=new Map();
  function gw(n){if(wc.has(n.id))return wc.get(n.id);let w;if(!n.children.length)w=MS[Math.min(n.tier,4)];else{w=0;for(const c of n.children)w+=gw(c);w+=(n.children.length-1)*P;w=Math.max(w,MS[Math.min(n.tier,4)]);}wc.set(n.id,w);return w;}
  function ps(node,lx,aw){const t=Math.min(node.tier,4);const cx=lx+aw/2;pos.set(node.id,{...node,x:cx,y:TY[t],radius:TIER_RADIUS[t]});if(!node.children.length)return;const cws=node.children.map(c=>gw(c));const tw=cws.reduce((s,w)=>s+w,0)+(node.children.length-1)*P;let cur=cx-tw/2;for(let i=0;i<node.children.length;i++){ps(node.children[i],cur,cws[i]);cur+=cws[i]+P;}}
  const sorted=[...roots].sort((a,b)=>gw(b)-gw(a));
  const reord=[];let l=0,r=sorted.length-1,il=true;for(let i=0;i<sorted.length;i++){reord.push(il?sorted[l++]:sorted[r--]);il=!il;}
  const rws=reord.map(r=>gw(r));let cur=P;for(let i=0;i<reord.length;i++){ps(reord[i],cur,rws[i]);cur+=rws[i]+P*2;}
  if(orphans.length>0){const oy=TY[4]+100;for(let i=0;i<orphans.length;i++){const o=orphans[i];pos.set(o.id,{...o,x:P+i*32,y:oy,radius:TIER_RADIUS[Math.min(o.tier,4)],isOrphan:true});}}
  let minX=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of pos.values()){minX=Math.min(minX,p.x-p.radius);maxX=Math.max(maxX,p.x+p.radius);maxY=Math.max(maxY,p.y+p.radius+30);}
  const cw=Math.max(maxX-minX+P*4,800),ch=Math.max(maxY+60,650);const sx=P*2-minX;if(sx)for(const p of pos.values())p.x+=sx;
  return {positions:pos,canvasWidth:cw,canvasHeight:ch};
}

/* ═══════════ TOPOLOGY PAGE ═══════════ */
export default function TopologyPage() {
  const svgRef=useRef(null),wrapRef=useRef(null),zoomRef=useRef(null),gRef=useRef(null);
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  const [sites,setSites]=useState([]),[selectedSite,setSelectedSite]=useState('');
  const [category,setCategory]=useState('network'),[selected,setSelected]=useState(null);
  const [viewDims,setViewDims]=useState({w:1200,h:700});
  const [searchQuery,setSearchQuery]=useState(''),[searchResults,setSearchResults]=useState([]);
  const [highlightedId,setHighlightedId]=useState(null);

  useEffect(()=>{fetch('/api/sites').then(r=>r.ok?r.json():Promise.reject()).then(d=>setSites(d.sites||d||[])).catch(()=>{});},[]);

  const fetchTopology=useCallback(async()=>{
    setLoading(true);setError(null);
    try{const p=new URLSearchParams();if(selectedSite)p.set('site',selectedSite);if(category!=='network')p.set('category',category);
    const res=await fetch(`/api/topology?${p}`);if(!res.ok)throw new Error();setData(await res.json());
    setSelected(null);setHighlightedId(null);setSearchQuery('');setSearchResults([]);}
    catch{setError('Failed to load topology data');}finally{setLoading(false);}
  },[selectedSite,category]);

  useEffect(()=>{fetchTopology();},[fetchTopology]);
  useEffect(()=>{const el=wrapRef.current;if(!el)return;const ro=new ResizeObserver(([e])=>{const{width,height}=e.contentRect;if(width>0&&height>0)setViewDims({w:width,h:height});});ro.observe(el);return()=>ro.disconnect();},[]);

  const layout=useMemo(()=>{
    if(!data?.nodes?.length)return null;
    const{roots,orphans,nodeMap,adj}=buildHierarchy(data.nodes,data.edges);
    const{positions,canvasWidth,canvasHeight}=layoutHierarchy(roots,orphans);
    return{positions,canvasWidth,canvasHeight,nodeMap,adj};
  },[data]);

  useEffect(()=>{if(!searchQuery.trim()||!data?.nodes){setSearchResults([]);if(!searchQuery.trim())setHighlightedId(null);return;}
    const q=searchQuery.toLowerCase().trim();
    setSearchResults(data.nodes.filter(n=>(n.name||'').toLowerCase().includes(q)||(n.ipAddress||'').toLowerCase().includes(q)||(n.serialNumber||'').toLowerCase().includes(q)||(n.model||'').toLowerCase().includes(q)||(n.make||'').toLowerCase().includes(q)).slice(0,8));
  },[searchQuery,data]);

  const locateDevice=useCallback((id)=>{
    if(!layout||!svgRef.current||!zoomRef.current)return;const p=layout.positions.get(id);if(!p)return;
    setHighlightedId(id);setSearchResults([]);setSearchQuery('');
    const{w,h}=viewDims;const s=1.5;
    d3.select(svgRef.current).transition().duration(600).ease(d3.easeCubicInOut).call(zoomRef.current.transform,d3.zoomIdentity.translate(w/2-p.x*s,h/2-p.y*s).scale(s));
    const node=layout.nodeMap.get(id);if(node)setSelected(node);
    setTimeout(()=>setHighlightedId(null),4000);
  },[layout,viewDims]);

  const handleZoomIn=useCallback(()=>{if(svgRef.current&&zoomRef.current)d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy,1.4);},[]);
  const handleZoomOut=useCallback(()=>{if(svgRef.current&&zoomRef.current)d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy,0.7);},[]);
  const handleFitView=useCallback(()=>{if(!svgRef.current||!zoomRef.current||!layout)return;const{w,h}=viewDims;const pad=40;const s=Math.min((w-pad*2)/layout.canvasWidth,(h-pad*2)/layout.canvasHeight,1.0);d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform,d3.zoomIdentity.translate((w-layout.canvasWidth*s)/2,(h-layout.canvasHeight*s)/2+pad/2).scale(s));},[layout,viewDims]);

  /* ═══════════ D3 RENDER ═══════════ */
  useEffect(()=>{
    if(!data||!layout||!svgRef.current||!data.nodes.length)return;
    const svg=d3.select(svgRef.current);svg.selectAll('*').remove();
    const{w,h}=viewDims;const{positions,canvasWidth,canvasHeight,adj}=layout;
    const g=svg.append('g').attr('class','tp-main-group');gRef.current=g.node();
    const zoom=d3.zoom().scaleExtent([0.08,4]).on('zoom',(ev)=>g.attr('transform',ev.transform));
    svg.call(zoom);zoomRef.current=zoom;

    // Tier lines
    const tierYs=[80,180,310,450,560];const usedT=new Set();
    for(const p of positions.values())for(let t=0;t<tierYs.length;t++)if(Math.abs(p.y-tierYs[t])<5)usedT.add(t);
    for(const t of usedT){const y=tierYs[t]-35;g.append('line').attr('x1',0).attr('x2',canvasWidth).attr('y1',y).attr('y2',y).attr('stroke','rgba(148,163,184,0.06)').attr('stroke-width',1);g.append('text').attr('x',8).attr('y',y-6).attr('font-size',9).attr('fill','rgba(148,163,184,0.3)').attr('font-weight',600).attr('letter-spacing','0.06em').text(TIER_LABELS[t]);}

    // Edges — with fiber/copper/tunnel styling
    const linkG=g.append('g').attr('class','tp-links');
    const eps=[];
    for(const e of data.edges){
      const s=positions.get(e.source),t=positions.get(e.target);
      if(!s||!t)continue;
      const isTunnel=TUNNEL_TYPES.has(s.type)&&TUNNEL_TYPES.has(t.type);
      eps.push({source:s,target:t,isTunnel,mediaType:e.mediaType||null});
    }
    linkG.selectAll('path').data(eps).join('path')
      .attr('d',e=>{const dy=e.target.y-e.source.y,dx=e.target.x-e.source.x;if(Math.abs(dy)<10){const mx=(e.source.x+e.target.x)/2,my=e.source.y-Math.min(30,Math.abs(dx)*0.15);return`M${e.source.x},${e.source.y} Q${mx},${my} ${e.target.x},${e.target.y}`;}const my=(e.source.y+e.target.y)/2;return`M${e.source.x},${e.source.y} C${e.source.x},${my} ${e.target.x},${my} ${e.target.x},${e.target.y}`;})
      .attr('fill','none')
      .attr('stroke',e=>getEdgeStyle(e).color)
      .attr('stroke-width',e=>getEdgeStyle(e).width)
      .attr('stroke-dasharray',e=>getEdgeStyle(e).dash)
      .attr('stroke-opacity',e=>getEdgeStyle(e).opacity);

    // Nodes
    const nodeG=g.append('g').attr('class','tp-nodes');
    const nd=Array.from(positions.values());
    const node=nodeG.selectAll('g').data(nd,d=>d.id).join('g').attr('transform',d=>`translate(${d.x},${d.y})`).attr('cursor','pointer');

    // Status ring
    node.append('circle').attr('class','node-ring').attr('r',d=>d.radius+3).attr('fill','none')
      .attr('stroke',d=>(STATUS_CFG[d.status]||STATUS_CFG.unknown).color)
      .attr('stroke-width',d=>(STATUS_CFG[d.status]||STATUS_CFG.unknown).width)
      .attr('stroke-dasharray',d=>(STATUS_CFG[d.status]||STATUS_CFG.unknown).dash)
      .attr('stroke-opacity',0.5);

    // Body — device type + vendor color
    node.append('circle').attr('class','node-body').attr('r',d=>d.radius)
      .attr('fill',d=>{const c=getDeviceColor(d.type,d.make);return d.tier<=1?c+'30':c+'1A';})
      .attr('stroke',d=>getDeviceColor(d.type,d.make))
      .attr('stroke-width',d=>d.tier<=1?2.5:1.5);

    // Type abbr
    node.filter(d=>d.radius>=10).append('text').attr('text-anchor','middle').attr('dominant-baseline','central')
      .attr('font-size',d=>Math.max(7,d.radius*0.55)).attr('font-weight',700)
      .attr('fill',d=>getDeviceColor(d.type,d.make)).attr('pointer-events','none')
      .text(d=>TYPE_ABBR[d.type]||'?');

    // Name label (tier 0-2)
    node.filter(d=>d.tier<=2).append('text').attr('y',d=>d.radius+11).attr('text-anchor','middle')
      .attr('font-size',d=>d.tier<=1?9:7).attr('fill','rgba(148,163,184,0.55)').attr('pointer-events','none')
      .text(d=>{const n=d.name||'';const m=d.tier<=1?20:14;return n.length>m?n.slice(0,m-1)+'…':n;});

    // Vendor badge (tier 0-1)
    node.filter(d=>d.tier<=1&&d.make).append('text').attr('y',d=>d.radius+22).attr('text-anchor','middle')
      .attr('font-size',7).attr('fill',d=>getDeviceColor(d.type,d.make)+'80')
      .attr('font-weight',500).attr('pointer-events','none').text(d=>d.make);

    // Click
    node.on('click',(ev,d)=>{ev.stopPropagation();setSelected(prev=>prev?.id===d.id?null:d);});

    // Hover
    node.on('mouseenter',(ev,d)=>{
      const nId=d.id;const conn=new Set([nId]);const nb=adj.get(nId);if(nb)for(const x of nb)conn.add(x);
      linkG.selectAll('path')
        .attr('stroke',e=>(e.source.id===nId||e.target.id===nId)?getEdgeStyle(e).color:'rgba(148,163,184,0.03)')
        .attr('stroke-width',e=>(e.source.id===nId||e.target.id===nId)?getEdgeStyle(e).width+1:0.4)
        .attr('stroke-opacity',e=>(e.source.id===nId||e.target.id===nId)?1:0.3);
      nodeG.selectAll('g').attr('opacity',n=>conn.has(n.id)?1:0.15);
    });
    node.on('mouseleave',()=>{
      linkG.selectAll('path').attr('stroke',e=>getEdgeStyle(e).color).attr('stroke-width',e=>getEdgeStyle(e).width).attr('stroke-opacity',e=>getEdgeStyle(e).opacity);
      nodeG.selectAll('g').attr('opacity',1);
    });

    svg.on('click',()=>{setSelected(null);setHighlightedId(null);});

    // Auto-fit
    requestAnimationFrame(()=>{const pad=40;const s=Math.min((w-pad*2)/canvasWidth,(h-pad*2)/canvasHeight,1.0);svg.call(zoom.transform,d3.zoomIdentity.translate((w-canvasWidth*s)/2,(h-canvasHeight*s)/2+pad/2).scale(s));});
  },[data,layout,viewDims]);

  // Highlight effect
  useEffect(()=>{
    if(!gRef.current||!layout)return;const g=d3.select(gRef.current);const ng=g.select('.tp-nodes').selectAll('g');
    if(!highlightedId){ng.attr('opacity',1);ng.selectAll('.node-highlight-ring').remove();return;}
    ng.attr('opacity',d=>d.id===highlightedId?1:0.12);
    ng.each(function(d){const el=d3.select(this);el.selectAll('.node-highlight-ring').remove();
      if(d.id===highlightedId){
        el.append('circle').attr('class','node-highlight-ring').attr('r',d.radius+8).attr('fill','none').attr('stroke','#FBBF24').attr('stroke-width',3).attr('stroke-opacity',1).transition().duration(600).ease(d3.easeLinear).attr('r',d.radius+22).attr('stroke-opacity',0).on('end',function(){d3.select(this).remove();});
        el.append('circle').attr('class','node-highlight-ring').attr('r',d.radius+6).attr('fill','none').attr('stroke','#FBBF24').attr('stroke-width',2.5).attr('stroke-dasharray','4,3');
      }
    });
  },[highlightedId,layout]);

  // Legend data — devices grouped by type+vendor
  const legendGroups=useMemo(()=>{
    if(!data?.nodes)return[];const gm=new Map();
    for(const n of data.nodes){let key,label,so;
      if(n.type==='access_point'&&n.make){key=`ap:${n.make}`;label=`AP · ${n.make}`;so=30;}
      else if(n.type==='firewall'&&n.make){key=`fw:${n.make}`;label=`FW · ${n.make}`;so=1;}
      else if(n.type==='core_switch'&&n.make){key=`cs:${n.make}`;label=`Core · ${n.make}`;so=10;}
      else{key=`type:${n.type}`;const tn=(n.type||'other').replace(/_/g,' ');label=tn.charAt(0).toUpperCase()+tn.slice(1);so=(TIER_ORDER[n.type]??4)*10+5;}
      if(!gm.has(key))gm.set(key,{color:getDeviceColor(n.type,n.make),label,count:0,sortOrder:so});gm.get(key).count++;}
    return Array.from(gm.values()).sort((a,b)=>a.sortOrder-b.sortOrder);
  },[data]);

  // Edge media counts for legend
  const edgeMediaCounts=useMemo(()=>{
    if(!data?.edges)return{};const c={fiber:0,copper:0,tunnel:0,unknown:0};
    for(const e of data.edges){
      if(e.mediaType==='fiber')c.fiber++;
      else if(e.mediaType==='copper')c.copper++;
      else c.unknown++;
    }
    // Count tunnels from node types (since mediaType doesn't cover tunnel logic)
    if(data.nodes){const nm=new Map();for(const n of data.nodes)nm.set(n.id,n);
      for(const e of data.edges){const s=nm.get(e.source),t=nm.get(e.target);
        if(s&&t&&TUNNEL_TYPES.has(s.type)&&TUNNEL_TYPES.has(t.type)){c.tunnel++;c.unknown=Math.max(0,c.unknown-1);}}}
    return c;
  },[data]);

  // Neighbors for inspector
  const neighbors=[];
  if(selected&&data){const nIds=new Set();for(const e of data.edges){if(e.source===selected.id)nIds.add(e.target);if(e.target===selected.id)nIds.add(e.source);}for(const n of data.nodes)if(nIds.has(n.id))neighbors.push(n);}

  return (
    <>
      <motion.div initial="hidden" animate="visible" variants={{visible:{transition:{staggerChildren:0.06}}}} className="tp-root">
        <motion.div variants={fadeUp} className="tp-header">
          <div><h1 className="tp-title">Network Topology</h1><p className="tp-subtitle">{data?`${data.nodes.length} devices · ${data.edges.length} connections`:'Loading…'}</p></div>
          <div className="tp-header-actions">
            <div className="tp-category-toggle"><button onClick={()=>setCategory('network')} className={`tp-cat-btn ${category==='network'?'tp-cat-btn--active':''}`}>Network</button><button onClick={()=>setCategory('all')} className={`tp-cat-btn ${category==='all'?'tp-cat-btn--active':''}`}>All Devices</button></div>
            {sites.length>0&&<select value={selectedSite} onChange={e=>setSelectedSite(e.target.value)} className="tp-site-select"><option value="">All Sites</option>{sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>}
            <button onClick={fetchTopology} className="tp-refresh-btn" aria-label="Refresh"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} style={{color:'var(--color-vemio-text-muted)'}}/></button>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="tp-graph-panel">
          {data&&data.nodes.length>0&&(
            <div className="tp-search-bar">
              <Search size={14} className="tp-search-icon"/>
              <input type="text" placeholder="Locate device by name, IP, serial, model…" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} className="tp-search-input"
                onKeyDown={e=>{if(e.key==='Enter'&&searchResults.length>0)locateDevice(searchResults[0].id);if(e.key==='Escape'){setSearchQuery('');setSearchResults([]);setHighlightedId(null);}}}/>
              {searchQuery&&<button className="tp-search-clear" onClick={()=>{setSearchQuery('');setSearchResults([]);setHighlightedId(null);}}><X size={12}/></button>}
              {searchResults.length>0&&(
                <div className="tp-search-dropdown">
                  {searchResults.map(r=>(
                    <button key={r.id} className="tp-search-result" onClick={()=>locateDevice(r.id)}>
                      <span className="tp-sr-dot" style={{background:getDeviceColor(r.type,r.make)}}/>
                      <span className="tp-sr-name">{r.name}</span>
                      <span className="tp-sr-meta">{r.ipAddress||`${TYPE_ABBR[r.type]}${r.make?' · '+r.make:''}`}</span>
                      <Crosshair size={12} className="tp-sr-locate"/>
                    </button>))}
                </div>)}
            </div>)}

          <div ref={wrapRef} className="tp-graph-wrap">
            {loading&&!data&&<div className="tp-loading"><div className="tp-loading-spinner"/><span>Building topology graph…</span></div>}
            {error&&<div className="tp-empty"><Network className="w-10 h-10" style={{color:'var(--color-vemio-text-dim)',marginBottom:8}}/><p>{error}</p><button onClick={fetchTopology} className="tp-retry-btn">Retry</button></div>}
            {!loading&&data&&!data.nodes.length&&<div className="tp-empty"><Network className="w-10 h-10" style={{color:'var(--color-vemio-text-dim)',marginBottom:8}}/><p>No topology data available yet</p></div>}
            <svg ref={svgRef} width={viewDims.w} height={viewDims.h} style={{display:data&&data.nodes.length?'block':'none'}}/>
            {data&&data.nodes.length>0&&(<div className="tp-zoom-controls"><button onClick={handleZoomIn} className="tp-zoom-btn" title="Zoom in"><Plus className="w-3.5 h-3.5"/></button><button onClick={handleZoomOut} className="tp-zoom-btn" title="Zoom out"><Minus className="w-3.5 h-3.5"/></button><button onClick={handleFitView} className="tp-zoom-btn" title="Fit to view"><Maximize2 className="w-3.5 h-3.5"/></button></div>)}
          </div>

          {/* ═══════════ LEGEND ═══════════ */}
          {data&&data.nodes.length>0&&(
            <div className="tp-legend">
              <div className="tp-legend-section">
                <span className="tp-legend-title">Devices</span>
                {legendGroups.map(g=><span key={g.label} className="tp-legend-item"><span className="tp-legend-dot" style={{background:g.color}}/>{g.label} ({g.count})</span>)}
              </div>
              <div className="tp-legend-section">
                <span className="tp-legend-title">Links</span>
                {edgeMediaCounts.fiber>0&&<span className="tp-legend-item"><span className="tp-legend-line" style={{background:EDGE_STYLES.fiber.color}}/>Fiber ({edgeMediaCounts.fiber})</span>}
                {edgeMediaCounts.copper>0&&<span className="tp-legend-item"><span className="tp-legend-line" style={{background:'rgba(148,163,184,0.5)'}}/>Copper ({edgeMediaCounts.copper})</span>}
                {edgeMediaCounts.tunnel>0&&<span className="tp-legend-item"><span className="tp-legend-line tp-legend-line--tunnel"/>Tunnel ({edgeMediaCounts.tunnel})</span>}
                {edgeMediaCounts.unknown>0&&<span className="tp-legend-item"><span className="tp-legend-line" style={{background:'rgba(148,163,184,0.2)'}}/>Unclassified ({edgeMediaCounts.unknown})</span>}
              </div>
              <div className="tp-legend-section">
                <span className="tp-legend-title">Status</span>
                {Object.entries(STATUS_CFG).map(([k,c])=><span key={k} className="tp-legend-item"><span className="tp-legend-ring" style={{borderColor:c.color,borderStyle:c.dash==='none'?'solid':c.dash==='4,3'?'dashed':'dotted'}}/>{c.label}</span>)}
              </div>
            </div>)}
        </motion.div>

        {/* ═══════════ INSPECTOR ═══════════ */}
        <AnimatePresence>
          {selected&&(
            <motion.div key="inspector" initial={{opacity:0,x:24}} animate={{opacity:1,x:0}} exit={{opacity:0,x:24}} transition={{duration:0.25}} className="tp-inspector">
              <div className="tp-insp-header"><h3 className="tp-insp-title">{selected.name}</h3><button onClick={()=>setSelected(null)} className="tp-insp-close"><X className="w-4 h-4"/></button></div>
              <div className="tp-insp-badges">
                <span className="tp-insp-badge" style={{background:(STATUS_CFG[selected.status]||STATUS_CFG.unknown).color+'18',color:(STATUS_CFG[selected.status]||STATUS_CFG.unknown).color}}><span className="tp-insp-dot" style={{background:(STATUS_CFG[selected.status]||STATUS_CFG.unknown).color}}/>{(STATUS_CFG[selected.status]||STATUS_CFG.unknown).label}</span>
                <span className="tp-insp-badge" style={{background:getDeviceColor(selected.type,selected.make)+'18',color:getDeviceColor(selected.type,selected.make)}}>{TYPE_ABBR[selected.type]||'?'} · {selected.make||(selected.type||'').replace(/_/g,' ')}</span>
              </div>
              <div className="tp-insp-fields">
                <Field label="Type" value={selected.type?.replace(/_/g,' ')}/><Field label="IP Address" value={selected.ipAddress} mono/>
                <Field label="Make" value={selected.make}/><Field label="Model" value={selected.model}/>
                <Field label="Serial" value={selected.serialNumber} mono/><Field label="Site" value={selected.siteName}/>
              </div>
              {neighbors.length>0&&(
                <div className="tp-insp-neighbors"><span className="tp-insp-nbr-title">Connected ({neighbors.length})</span>
                  <div className="tp-insp-nbr-list">
                    {neighbors.slice(0,30).map(n=>(<button key={n.id} className="tp-insp-nbr-item" onClick={()=>{setSelected(data.nodes.find(nd=>nd.id===n.id)||n);locateDevice(n.id);}}><span className="tp-insp-dot" style={{background:getDeviceColor(n.type,n.make),width:6,height:6}}/><span className="tp-insp-nbr-name">{n.name}</span><span className="tp-insp-nbr-type" style={{color:getDeviceColor(n.type,n.make)}}>{TYPE_ABBR[n.type]}{n.make?' · '+n.make:''}</span></button>))}
                    {neighbors.length>30&&<span className="tp-insp-nbr-more">+{neighbors.length-30} more</span>}
                  </div>
                </div>)}
            </motion.div>)}
        </AnimatePresence>
      </motion.div>

      <style>{`
        .tp-root{display:flex;flex-direction:column;gap:16px;max-width:1400px;position:relative}
        .tp-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .tp-title{font-size:18px;font-weight:700;color:var(--vemio-text);margin:0}.tp-subtitle{font-size:13px;color:var(--vemio-text-muted);margin:3px 0 0}
        .tp-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
        .tp-category-toggle{display:flex;border-radius:8px;overflow:hidden;border:1px solid var(--color-vemio-border)}
        .tp-cat-btn{padding:7px 12px;font-size:11px;font-weight:500;cursor:pointer;border:none;background:var(--color-vemio-surface);color:var(--color-vemio-text-dim);transition:background .15s;white-space:nowrap}
        .tp-cat-btn:first-child{border-right:1px solid var(--color-vemio-border)}.tp-cat-btn--active{background:rgba(245,158,11,.12);color:var(--color-vemio-amber)}
        .tp-site-select{padding:8px 12px;border-radius:8px;font-size:13px;background:var(--color-vemio-surface);border:1px solid var(--color-vemio-border);color:var(--color-vemio-text);outline:none;cursor:pointer;min-width:140px}
        .tp-refresh-btn{padding:8px;border-radius:8px;border:1px solid var(--color-vemio-border);background:var(--color-vemio-surface);cursor:pointer;display:flex;align-items:center;transition:background .15s}
        .tp-refresh-btn:hover{background:var(--color-vemio-surface-raised)}
        .tp-graph-panel{border-radius:16px;overflow:hidden;background:var(--color-vemio-surface);border:1px solid var(--color-vemio-border);position:relative}
        .tp-search-bar{position:relative;padding:10px 14px;display:flex;align-items:center;border-bottom:1px solid var(--color-vemio-border)}
        .tp-search-icon{position:absolute;left:24px;top:50%;transform:translateY(-50%);color:var(--vemio-text-muted);pointer-events:none}
        .tp-search-input{width:100%;padding:7px 28px 7px 32px;font-size:13px;border-radius:8px;background:var(--color-vemio-bg);border:1px solid rgba(255,255,255,.06);color:var(--vemio-text);outline:none;transition:border-color .15s}
        .tp-search-input::placeholder{color:rgba(148,163,184,.4)}.tp-search-input:focus{border-color:rgba(245,158,11,.3)}
        .tp-search-clear{position:absolute;right:22px;top:50%;transform:translateY(-50%);border:none;background:rgba(148,163,184,.15);border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--vemio-text-muted)}
        .tp-search-dropdown{position:absolute;top:calc(100% - 2px);left:14px;right:14px;background:var(--color-vemio-bg);border:1px solid var(--color-vemio-border);border-radius:10px;z-index:30;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.4);max-height:280px;overflow-y:auto}
        .tp-search-result{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;border:none;background:transparent;cursor:pointer;width:100%;text-align:left;transition:background .1s;color:inherit}
        .tp-search-result:hover{background:rgba(255,255,255,.04)}.tp-sr-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .tp-sr-name{font-size:13px;color:var(--vemio-text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tp-sr-meta{font-size:11px;color:var(--color-vemio-text-dim);font-family:monospace}.tp-sr-locate{color:var(--color-vemio-text-dim);flex-shrink:0}
        .tp-graph-wrap{width:100%;height:clamp(500px,70vh,900px);position:relative;overflow:hidden}.tp-graph-wrap svg{display:block}
        .tp-zoom-controls{position:absolute;bottom:12px;right:12px;display:flex;flex-direction:column;gap:2px;z-index:10}
        .tp-zoom-btn{padding:7px;border-radius:8px;border:1px solid var(--color-vemio-border);background:var(--color-vemio-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--color-vemio-text-muted);transition:background .15s}
        .tp-zoom-btn:hover{background:var(--color-vemio-surface-raised)}
        .tp-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-size:13px;color:var(--color-vemio-text-dim)}
        .tp-loading-spinner{width:28px;height:28px;border:2.5px solid rgba(148,163,184,.15);border-top-color:rgba(245,158,11,.6);border-radius:50%;animation:tp-spin .8s linear infinite}
        @keyframes tp-spin{to{transform:rotate(360deg)}}
        .tp-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:13px;color:var(--color-vemio-text-muted)}
        .tp-retry-btn{margin-top:8px;padding:6px 16px;border-radius:8px;font-size:12px;background:var(--color-vemio-surface-raised);border:1px solid var(--color-vemio-border);color:var(--color-vemio-text);cursor:pointer}
        .tp-legend{display:flex;gap:20px;padding:10px 16px;border-top:1px solid var(--color-vemio-border);flex-wrap:wrap}
        .tp-legend-section{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .tp-legend-title{font-size:9px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;color:var(--color-vemio-text-dim);margin-right:2px}
        .tp-legend-item{display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--color-vemio-text-muted);white-space:nowrap}
        .tp-legend-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .tp-legend-ring{width:8px;height:8px;border-radius:50%;flex-shrink:0;border:2px solid;background:transparent}
        .tp-legend-line{width:16px;height:2px;border-radius:1px;flex-shrink:0}
        .tp-legend-line--tunnel{width:16px;height:0;border-top:2px dashed #06B6D4;background:none}
        .tp-inspector{position:absolute;top:52px;right:0;width:320px;max-height:calc(100% - 64px);overflow-y:auto;background:var(--color-vemio-bg);border:1px solid var(--color-vemio-border);border-radius:14px;padding:16px;z-index:20;display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 32px rgba(0,0,0,.35)}
        @media(max-width:639px){.tp-inspector{position:fixed;top:auto;bottom:0;left:0;right:0;width:100%;max-height:55vh;border-radius:16px 16px 0 0}}
        .tp-insp-header{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .tp-insp-title{font-size:14px;font-weight:600;color:var(--vemio-text);margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tp-insp-close{padding:4px;border-radius:6px;border:none;background:transparent;color:var(--color-vemio-text-dim);cursor:pointer;display:flex;flex-shrink:0}
        .tp-insp-badges{display:flex;gap:6px;flex-wrap:wrap}
        .tp-insp-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}
        .tp-insp-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
        .tp-insp-fields{display:flex;flex-direction:column;gap:8px}
        .tp-field{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
        .tp-field-label{font-size:11px;color:var(--color-vemio-text-dim);flex-shrink:0}
        .tp-field-value{font-size:12px;color:var(--color-vemio-text-muted);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:capitalize}
        .tp-field-value--mono{font-family:monospace;font-size:11px;text-transform:none}
        .tp-insp-neighbors{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--color-vemio-border);padding-top:12px}
        .tp-insp-nbr-title{font-size:10px;text-transform:uppercase;letter-spacing:.07em;font-weight:600;color:var(--color-vemio-text-dim)}
        .tp-insp-nbr-list{display:flex;flex-direction:column;gap:2px;max-height:200px;overflow-y:auto}
        .tp-insp-nbr-item{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;border:none;background:transparent;cursor:pointer;text-align:left;transition:background .12s;color:inherit}
        .tp-insp-nbr-item:hover{background:rgba(255,255,255,.04)}
        .tp-insp-nbr-name{font-size:12px;color:var(--vemio-text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tp-insp-nbr-type{font-size:9px;font-weight:600;flex-shrink:0}
        .tp-insp-nbr-more{font-size:11px;color:var(--color-vemio-text-dim);padding:4px 8px}
      `}</style>
    </>
  );
}

function Field({label,value,mono}){if(!value)return null;return<div className="tp-field"><span className="tp-field-label">{label}</span><span className={`tp-field-value ${mono?'tp-field-value--mono':''}`}>{value}</span></div>;}