/**
 * VEMIO™ | Network Topology API
 * GET /api/topology
 *
 * Returns { nodes, edges } for the tenant's device neighbor graph.
 * Edges now include mediaType (fiber/copper/unknown) from device_ports.
 *
 * Query params:
 *   site     — filter by site_id
 *   category — 'network' (default) or 'all'
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
    const nodeConditions = ['d.is_monitored = true', 'd.is_retired = false'];
    const nodeParams = [];
    let pi = 1;

    if (siteId) {
      nodeConditions.push(`d.site_id = $${pi++}`);
      nodeParams.push(siteId);
    }

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
         d.serial_number,
         s.name AS site_name
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       ${nodeWhere}`,
      nodeParams
    );

    // Build lookup maps
    const auvikIdSet = new Set(
      nodesResult.rows.map(r => r.auvik_device_id).filter(Boolean)
    );
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
         dn.neighbor_device_id AS target_auvik_id,
         dn.interface_name     AS source_interface,
         dn.neighbor_interface AS target_interface
       FROM device_neighbors dn
       ORDER BY LEAST(dn.device_id, dn.neighbor_device_id),
                GREATEST(dn.device_id, dn.neighbor_device_id)`
    );

    // ── Build interface media lookup ──
    // Map: "deviceAuvikId:interfaceName" → mediaType
    const mediaLookup = new Map();
    try {
      const ifResult = await queryWithTenant(tenantId,
        `SELECT device_auvik_id, interface_name, media_type
         FROM device_ports
         WHERE media_type IS NOT NULL AND media_type NOT IN ('virtual', 'unknown')`
      );
      for (const row of ifResult.rows) {
        mediaLookup.set(`${row.device_auvik_id}:${row.interface_name}`, row.media_type);
      }
    } catch (err) {
      // device_ports table might not exist yet — graceful fallback
      console.warn('[VEMIO API] device_ports query failed (table may not exist yet):', err.message);
    }

    // ── Resolve edges with media type ──
    const edges = edgesResult.rows
      .filter(e => auvikIdSet.has(e.source_auvik_id) && auvikIdSet.has(e.target_auvik_id))
      .map(e => {
        const srcNode = auvikToNode.get(e.source_auvik_id);
        const tgtNode = auvikToNode.get(e.target_auvik_id);

        // Determine media type from interface data
        let mediaType = null;
        if (e.source_interface) {
          const srcMedia = mediaLookup.get(`${e.source_auvik_id}:${e.source_interface}`);
          if (srcMedia) mediaType = srcMedia;
        }
        if (!mediaType && e.target_interface) {
          const tgtMedia = mediaLookup.get(`${e.target_auvik_id}:${e.target_interface}`);
          if (tgtMedia) mediaType = tgtMedia;
        }

        return {
          source: srcNode.id,
          target: tgtNode.id,
          sourceInterface: e.source_interface || null,
          targetInterface: e.target_interface || null,
          mediaType: mediaType, // 'fiber', 'copper', or null (unknown)
        };
      });

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
      serialNumber: row.serial_number,
      siteName: row.site_name,
    }));

    return Response.json({ nodes, edges, category });
  } catch (err) {
    console.error('[VEMIO API] Topology query error:', err.message);
    return Response.json({ error: 'Failed to fetch topology data' }, { status: 500 });
  }
});