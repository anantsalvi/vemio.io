/**
 * VEMIO™ | Network Topology API
 * GET /api/topology
 *
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 * In all-tenants mode, merges topology from all managed tenants.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

function ipToInt(ip) {
  if (!ip) return null;
  const bare = ip.split('/')[0].trim();
  const parts = bare.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num >>> 0) * 256 + octet;
  }
  return num >>> 0;
}

function subnet24(ipInt) {
  return (ipInt & 0xFFFFFF00) >>> 0;
}

export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);
  const siteId = url.searchParams.get('site');
  const category = url.searchParams.get('category') || 'network';

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

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

    const nodesResult = await queryForTenant(target,
      `SELECT
         d.id, d.auvik_device_id, d.name, d.device_type,
         d.current_status, d.ip_address, d.make, d.model,
         d.serial_number, s.name AS site_name
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       ${nodeWhere}`,
      nodeParams,
      { addTenantInfo: target.mode === 'all' }
    );

    const auvikIdSet = new Set(
      nodesResult.rows.map(r => r.auvik_device_id).filter(Boolean)
    );
    const auvikToNode = new Map();
    for (const row of nodesResult.rows) {
      if (row.auvik_device_id) {
        auvikToNode.set(row.auvik_device_id, row);
      }
    }

    // ── Edges ──
    const edgesResult = await queryForTenant(target,
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

    // ── Media lookup ──
    const mediaLookup = new Map();
    try {
      const ifResult = await queryForTenant(target,
        `SELECT device_auvik_id, interface_name, media_type
         FROM device_ports
         WHERE media_type IS NOT NULL AND media_type NOT IN ('virtual', 'unknown')`
      );
      for (const row of ifResult.rows) {
        mediaLookup.set(`${row.device_auvik_id}:${row.interface_name}`, row.media_type);
      }
    } catch (err) {
      console.warn('[VEMIO API] device_ports query failed:', err.message);
    }

    // ── Resolve edges ──
    const connectedAuvikIds = new Set();
    const edges = edgesResult.rows
      .filter(e => auvikIdSet.has(e.source_auvik_id) && auvikIdSet.has(e.target_auvik_id))
      .map(e => {
        const srcNode = auvikToNode.get(e.source_auvik_id);
        const tgtNode = auvikToNode.get(e.target_auvik_id);

        connectedAuvikIds.add(e.source_auvik_id);
        connectedAuvikIds.add(e.target_auvik_id);

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
          mediaType,
        };
      });

    // ── Subnet clustering ──
    const subnetMap = new Map();
    try {
      const gwResult = await queryForTenant(target,
        `SELECT di.device_id, di.ip_address, d.name, d.device_type, d.auvik_device_id
         FROM device_interfaces di
         JOIN devices d ON d.id = di.device_id
         WHERE d.device_type IN ('firewall', 'core_switch')
           AND d.is_monitored = true AND d.is_retired = false
           AND di.ip_address IS NOT NULL`
      );
      for (const row of gwResult.rows) {
        const ipStr = String(row.ip_address).split('/')[0];
        const ipInt = ipToInt(ipStr);
        if (ipInt === null) continue;
        const sn = subnet24(ipInt);
        const existing = subnetMap.get(sn);
        if (!existing || (row.device_type === 'core_switch' && existing.deviceType !== 'core_switch')) {
          subnetMap.set(sn, {
            deviceId: row.device_id, deviceName: row.name,
            deviceType: row.device_type, auvikDeviceId: row.auvik_device_id,
            gatewayIp: ipStr,
          });
        }
      }
    } catch (err) {
      console.warn('[VEMIO API] device_interfaces subnet query failed:', err.message);
    }

    // ── Format nodes ──
    const nodeIdSet = new Set(nodesResult.rows.map(r => r.id));
    const edgeConnectedIds = new Set();
    for (const e of edges) {
      edgeConnectedIds.add(e.source);
      edgeConnectedIds.add(e.target);
    }

    const nodes = nodesResult.rows.map(row => {
      const node = {
        id: row.id, auvikDeviceId: row.auvik_device_id,
        name: row.name, type: row.device_type, status: row.current_status,
        ipAddress: row.ip_address, make: row.make, model: row.model,
        serialNumber: row.serial_number, siteName: row.site_name,
        ...(row._tenant_name && { tenantName: row._tenant_name }),
      };

      if (!edgeConnectedIds.has(row.id) && row.ip_address) {
        const ipInt = ipToInt(String(row.ip_address));
        if (ipInt !== null) {
          const sn = subnet24(ipInt);
          const gw = subnetMap.get(sn);
          if (gw && gw.deviceId !== row.id && nodeIdSet.has(gw.deviceId)) {
            node.subnetParentId = gw.deviceId;
            node.subnetGatewayIp = gw.gatewayIp;
          }
        }
      }

      return node;
    });

    // ── Subnet cluster summary ──
    const subnetClusters = {};
    for (const n of nodes) {
      if (n.subnetParentId) {
        if (!subnetClusters[n.subnetParentId]) {
          const gw = nodesResult.rows.find(r => r.id === n.subnetParentId);
          subnetClusters[n.subnetParentId] = {
            parentId: n.subnetParentId,
            parentName: gw?.name || 'Unknown Gateway',
            count: 0,
          };
        }
        subnetClusters[n.subnetParentId].count++;
      }
    }

    return Response.json({
      nodes, edges, category,
      subnetClusters: Object.values(subnetClusters),
      isAllTenants: target.mode === 'all',
    });
  } catch (err) {
    console.error('[VEMIO API] Topology query error:', err.message);
    return Response.json({ error: 'Failed to fetch topology data' }, { status: 500 });
  }
});
