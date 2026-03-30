/**
 * VEMIO™ — Audit Log API
 * Phase 7.2: View and export audit trail for tenant admins.
 * 
 * GET /api/audit-log?page=1&limit=50&action=login_success&user_id=...&from=...&to=...
 * GET /api/audit-log?export=csv — Download as CSV
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  // Admin only
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '50')));
  const offset = (page - 1) * limit;
  const action = url.searchParams.get('action');
  const userId = url.searchParams.get('user_id');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const exportFormat = url.searchParams.get('export');

  // Build query
  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (action) {
    conditions.push(`al.action = $${paramIdx++}`);
    params.push(action);
  }

  if (userId) {
    conditions.push(`al.user_id = $${paramIdx++}`);
    params.push(userId);
  }

  if (from) {
    conditions.push(`al.created_at >= $${paramIdx++}`);
    params.push(from);
  }

  if (to) {
    conditions.push(`al.created_at <= $${paramIdx++}`);
    params.push(to);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  // CSV export
  if (exportFormat === 'csv') {
    const { rows } = await queryWithTenant(
      session.user.tenantId,
      `SELECT 
         al.created_at, u.email AS user_email, u.name AS user_name,
         al.action, al.resource_type, al.resource_id,
         al.ip_address, al.user_agent, al.details
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT 10000`,
      params
    );

    // Build CSV
    const headers = ['Timestamp', 'User Email', 'User Name', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'User Agent', 'Details'];
    const csvRows = [headers.join(',')];

    for (const row of rows) {
      csvRows.push([
        row.created_at?.toISOString() || '',
        `"${(row.user_email || '').replace(/"/g, '""')}"`,
        `"${(row.user_name || '').replace(/"/g, '""')}"`,
        row.action || '',
        row.resource_type || '',
        row.resource_id || '',
        row.ip_address || '',
        `"${(row.user_agent || '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.details || {}).replace(/"/g, '""')}"`,
      ].join(','));
    }

    return new Response(csvRows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="vemio-audit-log-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  // Paginated JSON response
  const countQuery = await queryWithTenant(
    session.user.tenantId,
    `SELECT COUNT(*) AS total FROM audit_log al ${whereClause}`,
    params
  );

  const { rows } = await queryWithTenant(
    session.user.tenantId,
    `SELECT 
       al.id, al.created_at, al.action, al.resource_type, al.resource_id,
       al.ip_address, al.details,
       u.email AS user_email, u.name AS user_name
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return Response.json({
    entries: rows,
    pagination: {
      page,
      limit,
      total: parseInt(countQuery.rows[0]?.total || '0'),
      pages: Math.ceil((countQuery.rows[0]?.total || 0) / limit),
    },
  });
});