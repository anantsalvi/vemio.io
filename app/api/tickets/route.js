/**
 * VEMIO™ — Tickets API
 * GET /api/tickets
 * 
 * Returns paginated, filterable ticket list for the authenticated tenant.
 * 
 * Query params:
 *   status    — open, pending, resolved, closed (comma-separated for multi)
 *   priority  — critical, high, medium, low
 *   site      — site UUID
 *   search    — text search on title, requester_name, glpi_ticket_id
 *   sort      — opened_at, updated_at, priority, status (default: opened_at)
 *   order     — asc, desc (default: desc)
 *   page      — 1-indexed (default: 1)
 *   limit     — 10-100 (default: 25)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const VALID_SORT_FIELDS = ['opened_at', 'updated_at', 'priority', 'status', 'title'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_STATUSES = ['open', 'pending', 'resolved', 'closed'];

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);

  // Parse query params
  const statusFilter = url.searchParams.get('status');
  const priorityFilter = url.searchParams.get('priority');
  const siteFilter = url.searchParams.get('site');
  const search = url.searchParams.get('search');
  const sortField = url.searchParams.get('sort') || 'opened_at';
  const sortOrder = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get('limit') || '25')));
  const offset = (page - 1) * limit;

  // Validate sort field
  const sort = VALID_SORT_FIELDS.includes(sortField) ? sortField : 'opened_at';

  // Build WHERE clauses and params
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Status filter (supports comma-separated multi-select)
  if (statusFilter) {
    const statuses = statusFilter.split(',').filter(s => VALID_STATUSES.includes(s));
    if (statuses.length > 0) {
      conditions.push(`t.status = ANY($${paramIndex}::text[])`);
      params.push(statuses);
      paramIndex++;
    }
  }

  // Priority filter
  if (priorityFilter && VALID_PRIORITIES.includes(priorityFilter)) {
    conditions.push(`t.priority = $${paramIndex}`);
    params.push(priorityFilter);
    paramIndex++;
  }

  // Site filter
  if (siteFilter) {
    conditions.push(`t.site_id = $${paramIndex}::uuid`);
    params.push(siteFilter);
    paramIndex++;
  }

  // Text search
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

  try {
    // Count total matching tickets
    const countResult = await queryWithTenant(tenantId,
      `SELECT COUNT(*) AS total
       FROM tickets t
       WHERE 1=1 ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total);

    // Fetch page of tickets
    const ticketsResult = await queryWithTenant(tenantId,
      `SELECT 
         t.id, t.glpi_ticket_id, t.frappe_ticket_id, t.data_source,
         t.title, t.status, t.priority, t.category,
         t.requester_name, t.assigned_to,
         t.opened_at, t.first_response_at, t.resolved_at, t.closed_at,
         t.sla_response_target_minutes, t.sla_resolution_target_minutes,
         t.sla_response_met, t.sla_resolution_met,
         t.created_at, t.updated_at,
         s.name AS site_name
       FROM tickets t
       LEFT JOIN sites s ON s.id = t.site_id
       WHERE 1=1 ${whereClause}
       ORDER BY t.${sort} ${sortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    const tickets = ticketsResult.rows.map(t => ({
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
      openedAt: t.opened_at,
      firstResponseAt: t.first_response_at,
      resolvedAt: t.resolved_at,
      closedAt: t.closed_at,
      sla: {
        responseTargetMin: t.sla_response_target_minutes,
        resolutionTargetMin: t.sla_resolution_target_minutes,
        responseMet: t.sla_response_met,
        resolutionMet: t.sla_resolution_met,
      },
      age: t.opened_at ? getAge(new Date(t.opened_at), t.closed_at ? new Date(t.closed_at) : new Date()) : null,
    }));

    return Response.json({
      tickets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
