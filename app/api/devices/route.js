/**
 * VEMIO™ — Devices API
 * GET /api/devices
 * 
 * Returns tenant-scoped device list with filters.
 * Query params: type, status, site, search, sort, page, limit
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);

  // Parse filters
  const type = url.searchParams.get('type');
  const status = url.searchParams.get('status');
  const siteId = url.searchParams.get('site');
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') || 'name';
  const order = url.searchParams.get('order') || 'asc';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  // Build query
  const conditions = [];
  const params = [];
  let paramIndex = 1;

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

  // Validate sort column
  const validSorts = ['name', 'device_type', 'current_status', 'last_seen_at', 'ip_address', 'make'];
  const sortCol = validSorts.includes(sort) ? sort : 'name';
  const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

  try {
    // Get total count
    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total FROM devices d ${whereClause}`,
      params
    );

    // Get paginated devices with site name
    const devicesResult = await queryWithTenant(tenantId,
      `SELECT 
         d.id, d.auvik_device_id, d.name, d.device_type, d.make, d.model,
         d.ip_address, d.current_status, d.last_seen_at, d.uptime_percent_30d,
         d.created_at,
         s.name AS site_name, s.id AS site_id
       FROM devices d
       LEFT JOIN sites s ON s.id = d.site_id
       ${whereClause}
       ORDER BY d.${sortCol} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Get summary counts
    const summaryResult = await queryWithTenant(tenantId,
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE current_status = 'up') AS up,
         COUNT(*) FILTER (WHERE current_status = 'down') AS down,
         COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded,
         COUNT(*) FILTER (WHERE current_status = 'unknown') AS unknown
       FROM devices`
    );

    // Get device type breakdown
    const typeResult = await queryWithTenant(tenantId,
      `SELECT device_type, COUNT(*) AS count
       FROM devices
       GROUP BY device_type
       ORDER BY count DESC`
    );

    const total = parseInt(countResult.rows[0].total);

    return Response.json({
      devices: devicesResult.rows.map(row => ({
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
        siteName: row.site_name,
        siteId: row.site_id,
      })),
      summary: {
        total: parseInt(summaryResult.rows[0].total),
        up: parseInt(summaryResult.rows[0].up),
        down: parseInt(summaryResult.rows[0].down),
        degraded: parseInt(summaryResult.rows[0].degraded),
        unknown: parseInt(summaryResult.rows[0].unknown),
      },
      types: typeResult.rows.map(r => ({ type: r.device_type, count: parseInt(r.count) })),
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
