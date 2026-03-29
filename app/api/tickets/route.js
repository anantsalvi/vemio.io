/**
 * VEMIO™ — Tickets API
 * GET /api/tickets
 * 
 * Returns paginated, filterable ticket list.
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

const VALID_SORT_FIELDS = ['created_at', 'updated_at', 'priority', 'status', 'title'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_STATUSES = ['open', 'pending', 'resolved', 'closed'];

export const GET = withAuth(async (req, session) => {
  const url = new URL(req.url);

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  const statusFilter = url.searchParams.get('status');
  const priorityFilter = url.searchParams.get('priority');
  const siteFilter = url.searchParams.get('site');
  const search = url.searchParams.get('search');
  const sortField = url.searchParams.get('sort') || 'created_at';
  const sortOrder = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '25')));
  const offset = (page - 1) * limit;

  const sort = VALID_SORT_FIELDS.includes(sortField) ? sortField : 'created_at';

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(s => VALID_STATUSES.includes(s));
    if (statuses.length > 0) {
      conditions.push(`t.status = ANY($${paramIndex}::text[])`);
      params.push(statuses);
      paramIndex++;
    }
  }

  if (priorityFilter && VALID_PRIORITIES.includes(priorityFilter)) {
    conditions.push(`t.priority = $${paramIndex}`);
    params.push(priorityFilter);
    paramIndex++;
  }

  if (siteFilter) {
    conditions.push(`t.site_id = $${paramIndex}::uuid`);
    params.push(siteFilter);
    paramIndex++;
  }

  if (search && search.trim().length > 0) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(`(
      t.title ILIKE $${paramIndex}
      OR t.requester_name ILIKE $${paramIndex}
      OR t.glpi_ticket_id::text = $${paramIndex + 1}
    )`);
    params.push(searchTerm, search.trim());
    paramIndex += 2;
  }

  const whereClause = conditions.length > 0
    ? 'AND ' + conditions.join(' AND ')
    : '';

  const isAllMode = target.mode === 'all';

  try {
    const ticketsResult = await queryForTenant(target,
      `SELECT 
         t.id, t.glpi_ticket_id, t.frappe_ticket_id, t.data_source,
         t.title, t.status, t.priority, t.category,
         t.requester_name, t.assigned_to,
         t.first_response_at, t.resolved_at, t.closed_at,
         t.sla_response_target_minutes, t.sla_resolution_target_minutes,
         t.sla_response_met, t.sla_resolution_met,
         t.created_at, t.updated_at,
         s.name AS site_name
       FROM tickets t
       LEFT JOIN sites s ON s.id = t.site_id
       WHERE 1=1 ${whereClause}
       ORDER BY t.${sort} ${sortOrder}`,
      params,
      { addTenantInfo: isAllMode }
    );

    // Sort merged results and paginate
    let allTickets = ticketsResult.rows;
    if (isAllMode) {
      allTickets.sort((a, b) => {
        const aVal = a[sort] || '';
        const bVal = b[sort] || '';
        if (sort === 'created_at' || sort === 'updated_at') {
          return sortOrder === 'DESC'
            ? new Date(bVal) - new Date(aVal)
            : new Date(aVal) - new Date(bVal);
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortOrder === 'DESC' ? -cmp : cmp;
      });
    }

    const total = allTickets.length;
    const paginatedTickets = allTickets.slice(offset, offset + limit);

    const tickets = paginatedTickets.map(t => ({
      id: t.id,
      sourceId: t.glpi_ticket_id || t.frappe_ticket_id || null,
      dataSource: t.data_source,
      title: t.title,
      status: t.status,
      priority: t.priority,
      category: t.category,
      requester: t.requester_name,
      assignedTo: t.assigned_to,
      site: t.site_name || 'Unknown',
      createdAt: t.created_at,
      firstResponseAt: t.first_response_at,
      resolvedAt: t.resolved_at,
      closedAt: t.closed_at,
      sla: {
        responseTargetMin: t.sla_response_target_minutes,
        resolutionTargetMin: t.sla_resolution_target_minutes,
        responseMet: t.sla_response_met,
        resolutionMet: t.sla_resolution_met,
      },
      age: t.created_at ? getAge(new Date(t.created_at), t.closed_at ? new Date(t.closed_at) : new Date()) : null,
      ...(t._tenant_name && { tenantName: t._tenant_name }),
    }));

    return Response.json({
      tickets,
      isAllTenants: isAllMode,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[VEMIO API] Tickets query failed:', err.message);
    return Response.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
});

function getAge(from, to) {
  const diffMs = to - from;
  const diffHours = diffMs / 3600000;
  if (diffHours < 1) return `${Math.round(diffMs / 60000)}m`;
  if (diffHours < 24) return `${Math.round(diffHours)}h`;
  return `${Math.round(diffHours / 24)}d`;
}
