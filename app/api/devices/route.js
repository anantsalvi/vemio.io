/**
 * VEMIO™ — Devices API
 * GET /api/devices
 * 
 * Returns tenant-scoped device list with filters.
 * Query params: type, status, site, search, sort, page, limit, include_retired, category, tenantId
 * 
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 * In "all tenants" mode, returns devices from all managed tenants with tenant_name column.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant, queryAggregateForTenant } from '@/lib/tenant';

const NETWORK_TYPES = [
  'firewall', 'core_switch', 'access_switch', 'access_point',
  'router', 'server', 'p2p_link',
];

export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);

  // ── Phase 6.1: Resolve target tenant(s) ──
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  // Parse filters
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const siteId = url.searchParams.get('site');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'name';
  const order = url.searchParams.get('order') || 'asc';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(250, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;
  const includeRetired = url.searchParams.get('include_retired') === 'true';
  const category = url.searchParams.get('category') || 'network';

  // Build query conditions
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (!includeRetired) {
    conditions.push(`d.is_retired = false`);
  }

  if (category !== 'all' && !type) {
    conditions.push(`d.device_type = ANY($${paramIndex++})`);
    params.push(NETWORK_TYPES);
  }

  if (type) {
    conditions.push(`d.device_type = $${paramIndex++}`);
    params.push(type);
  }

  if (status) {
    conditions.push(`d.current_status = $${paramIndex++}`);
    params.push(status);
  }

  if (siteId) {
    conditions.push(`d.site_id = $${paramIndex++}`);
    params.push(siteId);
  }

  if (search) {
    conditions.push(`(d.name ILIKE $${paramIndex} OR d.ip_address::text ILIKE $${paramIndex} OR d.make ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const validSorts = ['name', 'device_type', 'current_status', 'last_seen_at', 'ip_address', 'make'];
  const sortCol = validSorts.includes(sort) ? sort : 'name';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  try {
    // For all-tenants mode, we need to handle pagination differently
    // since we're merging results from multiple tenants
    const isAllMode = target.mode === 'all';

    // Get devices (with tenant info in all mode)
    const devicesResult = await queryForTenant(target,
      `SELECT 
         d.id, d.auvik_device_id, d.name, d.device_type, d.make, d.model,
         d.ip_address, d.current_status, d.last_seen_at, d.uptime_percent_30d, d.uptime_seconds,
         d.created_at, d.is_retired,
         s.name AS site_name, s.id AS site_id
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       ${whereClause}
       ORDER BY d.${sortCol} ${sortOrder}`,
      params,
      { addTenantInfo: isAllMode }
    );

    // Apply sorting and pagination on merged results (all-tenants mode)
    let allDevices = devicesResult.rows;
    if (isAllMode) {
      // Re-sort merged results
      allDevices.sort((a, b) => {
        const aVal = a[sortCol] || '';
        const bVal = b[sortCol] || '';
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
        return sortOrder === 'DESC' ? -cmp : cmp;
      });
    }

    const total = allDevices.length;
    const paginatedDevices = allDevices.slice(offset, offset + limit);

    // Get summary counts
    const summaryTypeFilter = category !== 'all' && !type
      ? 'AND device_type = ANY($1)' : '';
    const summaryParams = category !== 'all' && !type ? [NETWORK_TYPES] : [];

    const summaryAgg = await queryAggregateForTenant(target,
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE current_status = 'up') AS up,
         COUNT(*) FILTER (WHERE current_status = 'down') AS down,
         COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded,
         COUNT(*) FILTER (WHERE current_status = 'unknown') AS unknown
       FROM devices
       WHERE is_retired = false ${summaryTypeFilter}`,
      summaryParams
    );

    // Device type breakdown
    const typeResult = await queryForTenant(target,
      `SELECT device_type, COUNT(*) AS count
       FROM devices
       WHERE is_retired = false ${summaryTypeFilter}
       GROUP BY device_type
       ORDER BY count DESC`,
      summaryParams
    );

    // Merge type counts across tenants
    const typeCounts = {};
    for (const r of typeResult.rows) {
      typeCounts[r.device_type] = (typeCounts[r.device_type] || 0) + parseInt(r.count);
    }

    return Response.json({
      devices: paginatedDevices.map(row => ({
        id: row.id,
        auvikDeviceId: row.auvik_device_id,
        name: row.name,
        type: row.device_type,
        make: row.make,
        model: row.model,
        ipAddress: row.ip_address,
        status: row.current_status,
        lastSeenAt: row.last_seen_at,
        uptime30d: row.uptime_percent_30d ? parseFloat(row.uptime_percent_30d) : null,
        uptimeSeconds: row.uptime_seconds ? parseInt(row.uptime_seconds) : null,
        siteName: row.site_name,
        siteId: row.site_id,
        isRetired: row.is_retired,
        // Phase 6.1: tenant info in all-tenants mode
        ...(row._tenant_name && {
          tenantName: row._tenant_name,
          tenantSlug: row._tenant_slug,
        }),
      })),
      isAllTenants: isAllMode,
      summary: {
        total: parseInt(summaryAgg.total || 0),
        up: parseInt(summaryAgg.up || 0),
        down: parseInt(summaryAgg.down || 0),
        degraded: parseInt(summaryAgg.degraded || 0),
        unknown: parseInt(summaryAgg.unknown || 0),
      },
      types: Object.entries(typeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[VEMIO API] Devices query error:', err.message);
    return Response.json({ error: 'Failed to fetch devices' }, { status: 500 });
  }
});