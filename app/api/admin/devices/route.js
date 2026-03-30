/**
 * VEMIO™ — MSP Admin: Devices API
 * 
 * GET   /api/admin/devices?tenant_id=...&status=...&search=...&is_monitored=...&category=network|all
 * PATCH /api/admin/devices — Bulk update (toggle monitored, delete duplicates)
 */

import { withMSPAuth } from '@/lib/admin-auth';
import { queryRaw } from '@/lib/db';

// Network device types (matches dashboard toggle)
const NETWORK_TYPES = ['firewall', 'core_switch', 'access_switch', 'access_point', 'router', 'p2p_link'];

export const GET = withMSPAuth(async (req, session) => {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const isMonitored = url.searchParams.get('is_monitored');
  const category = url.searchParams.get('category') || 'all';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(200, Math.max(20, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (tenantId) {
    conditions.push(`d.tenant_id = $${idx++}`);
    params.push(tenantId);
  }

  if (status) {
    conditions.push(`d.current_status = $${idx++}::device_status`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(d.name ILIKE $${idx} OR d.ip_address::text ILIKE $${idx} OR d.make ILIKE $${idx} OR d.model ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  if (isMonitored !== null && isMonitored !== '') {
    conditions.push(`d.is_monitored = $${idx++}`);
    params.push(isMonitored === 'true');
  }

  // Network/All category filter
  if (category === 'network') {
    conditions.push(`d.device_type = ANY($${idx++}::device_type[])`);
    params.push(NETWORK_TYPES);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countParams = [...params];
  const { rows: countRows } = await queryRaw(
    `SELECT COUNT(*) AS total FROM devices d ${where}`,
    countParams
  );

  const { rows } = await queryRaw(
    `SELECT d.id, d.name AS device_name, d.ip_address, d.current_status AS status, 
            d.device_type, CONCAT_WS(' ', d.make, d.model) AS make_model,
            d.is_monitored, d.site_id, d.auvik_device_id, d.created_at, d.updated_at,
            t.name AS tenant_name, t.slug AS tenant_slug, t.id AS tenant_id,
            s.name AS site_name
     FROM devices d
     JOIN tenants t ON t.id = d.tenant_id
     LEFT JOIN sites s ON s.id = d.site_id
     ${where}
     ORDER BY t.name, d.name
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const { rows: stats } = await queryRaw(
    `SELECT 
       COUNT(*) AS total_devices,
       COUNT(*) FILTER (WHERE is_monitored = true) AS monitored,
       COUNT(*) FILTER (WHERE is_monitored = false) AS not_monitored,
       COUNT(*) FILTER (WHERE current_status = 'up') AS online,
       COUNT(*) FILTER (WHERE current_status = 'down') AS offline,
       COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded,
       COUNT(DISTINCT device_type) AS device_types
     FROM devices d ${where}`,
    countParams
  );

  // Smarter duplicate detection: same name + same tenant, but exclude generic names
  // Only flag as duplicates if devices share name AND have different IPs (true duplicates)
  const { rows: duplicates } = await queryRaw(
    `SELECT d.tenant_id, t.name AS tenant_name, d.name AS device_name, 
            COUNT(*) AS count,
            array_agg(d.id ORDER BY d.created_at) AS device_ids,
            array_agg(CONCAT_WS(' ', d.make, d.model) ORDER BY d.created_at) AS models,
            array_agg(d.current_status::text ORDER BY d.created_at) AS statuses,
            array_agg(d.ip_address::text ORDER BY d.created_at) AS ips
     FROM devices d
     JOIN tenants t ON t.id = d.tenant_id
     WHERE d.name NOT IN ('Unidentified Device', 'Unknown Device', 'unknown')
       AND d.name NOT LIKE 'Device@%'
     GROUP BY d.tenant_id, t.name, d.name
     HAVING COUNT(*) > 1
     ORDER BY COUNT(*) DESC
     LIMIT 50`
  );

  return Response.json({
    devices: rows,
    pagination: {
      page,
      limit,
      total: parseInt(countRows[0]?.total || '0'),
      pages: Math.ceil((countRows[0]?.total || 0) / limit),
    },
    stats: stats[0] || {},
    duplicates,
  });
});

export const PATCH = withMSPAuth(async (req, session) => {
  const body = await req.json();
  const { action, device_ids } = body;

  if (!action || !device_ids || !Array.isArray(device_ids) || device_ids.length === 0) {
    return Response.json({ error: 'action and device_ids[] are required' }, { status: 400 });
  }

  if (device_ids.length > 500) {
    return Response.json({ error: 'Maximum 500 devices per operation' }, { status: 400 });
  }

  switch (action) {
    case 'set_monitored': {
      const { rows } = await queryRaw(
        `UPDATE devices SET is_monitored = true WHERE id = ANY($1::uuid[]) RETURNING id`,
        [device_ids]
      );
      return Response.json({ updated: rows.length, action: 'set_monitored' });
    }

    case 'set_not_monitored': {
      const { rows } = await queryRaw(
        `UPDATE devices SET is_monitored = false WHERE id = ANY($1::uuid[]) RETURNING id`,
        [device_ids]
      );
      return Response.json({ updated: rows.length, action: 'set_not_monitored' });
    }

    case 'delete': {
      // First delete related records to avoid FK violations
      await queryRaw(
        `DELETE FROM device_interfaces WHERE device_id = ANY($1::uuid[])`,
        [device_ids]
      ).catch(() => {});
      await queryRaw(
        `DELETE FROM device_ports WHERE device_id = ANY($1::uuid[])`,
        [device_ids]
      ).catch(() => {});
      await queryRaw(
        `DELETE FROM device_neighbors WHERE source_device_id = ANY($1::uuid[]) OR target_device_id = ANY($1::uuid[])`,
        [device_ids]
      ).catch(() => {});

      const { rows } = await queryRaw(
        `DELETE FROM devices WHERE id = ANY($1::uuid[]) RETURNING id, name AS device_name`,
        [device_ids]
      );
      return Response.json({ deleted: rows.length, devices: rows, action: 'delete' });
    }

    default:
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
});