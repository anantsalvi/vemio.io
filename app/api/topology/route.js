/**
 * VEMIO™ — Network Topology API
 * GET /api/topology
 *
 * Returns { nodes, edges } for the tenant's device neighbor graph.
 * Nodes come from the devices table; edges from device_neighbors,
 * deduplicated so A→B and B→A collapse into one edge.
 *
 * Query params:
 *   site     — filter by site_id
 *   category — 'network' (default) or 'all'
 *              network = firewall, core_switch, access_switch, access_point, router, server, p2p_link
 *              all     = includes printer, cctv, ups, access_control, nas, other
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);
  const siteId = url.searchParams.get('site');
  const category = url.searchParams.get('category') || 'network';

  try {
    // ── Nodes ──
    const nodeConditions = ['d.is_monitored = true'];
    const nodeParams = [];
    let pi = 1;

    if (siteId) {
      nodeConditions.push(`d.site_id = $${pi++}`);
      nodeParams.push(siteId);
    }

    // Default to network-only; 'all' shows everything
    if (category !== 'all') {
      nodeConditions.push(`d.device_type = ANY($${pi++})`);
      nodeParams.push(NETWORK_TYPES);
    }

    const nodeWhere = 'WHERE ' + nodeConditions.join(' AND ');

    const nodesResult = await queryWithTenant(tenantId,
      `SELECT
         d.id,
         d.auvik_device_id,
         d.name,
         d.device_type,
         d.current_status,
         d.ip_address,
         d.make,
         d.model,
         s.name AS site_name
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       ${nodeWhere}`,
      nodeParams
    );

    // Build a Set of auvik_device_ids for fast lookup (to filter edges)
    const auvikIdSet = new Set(
      nodesResult.rows.map(r => r.auvik_device_id).filter(Boolean)
    );

    // Also build a map: auvik_device_id → node row (for edge resolution)
    const auvikToNode = new Map();
    for (const row of nodesResult.rows) {
      if (row.auvik_device_id) {
        auvikToNode.set(row.auvik_device_id, row);
      }
    }

    // ── Edges: from device_neighbors, deduplicated ──
    const edgesResult = await queryWithTenant(tenantId,
      `SELECT DISTINCT ON (LEAST(dn.device_id, dn.neighbor_device_id),
                           GREATEST(dn.device_id, dn.neighbor_device_id))
         dn.device_id          AS source_auvik_id,
         dn.neighbor_device_id AS target_auvik_id
       FROM device_neighbors dn
       ORDER BY LEAST(dn.device_id, dn.neighbor_device_id),
                GREATEST(dn.device_id, dn.neighbor_device_id)`
    );

    // Filter edges to only include devices we have as nodes
    const edges = edgesResult.rows
      .filter(e => auvikIdSet.has(e.source_auvik_id) && auvikIdSet.has(e.target_auvik_id))
      .map(e => ({
        source: auvikToNode.get(e.source_auvik_id).id,
        target: auvikToNode.get(e.target_auvik_id).id,
      }));

    // ── Format nodes ──
    const nodes = nodesResult.rows.map(row => ({
      id: row.id,
      auvikDeviceId: row.auvik_device_id,
      name: row.name,
      type: row.device_type,
      status: row.current_status,
      ipAddress: row.ip_address,
      make: row.make,
      model: row.model,
      siteName: row.site_name,
    }));

    return Response.json({ nodes, edges, category });
  } catch (err) {
    console.error('[VEMIO API] Topology query error:', err.message);
    return Response.json({ error: 'Failed to fetch topology data' }, { status: 500 });
  }
});