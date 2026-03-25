/**
 * VEMIO™ — Ticket Stats API
 * GET /api/tickets/stats
 * 
 * Returns aggregated ticket metrics for the dashboard summary cards.
 * 
 * Query params:
 *   period — 7d, 30d, 90d, mtd (month-to-date, default), ytd
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const PERIOD_MAP = {
  '7d': "NOW() - INTERVAL '7 days'",
  '30d': "NOW() - INTERVAL '30 days'",
  '90d': "NOW() - INTERVAL '90 days'",
  'mtd': "DATE_TRUNC('month', NOW())",
  'ytd': "DATE_TRUNC('year', NOW())",
};

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || 'mtd';
  const periodSql = PERIOD_MAP[period] || PERIOD_MAP['mtd'];

  try {
    // 1. Status breakdown (all time)
    const statusResult = await queryWithTenant(tenantId,
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'open') AS open,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
         COUNT(*) FILTER (WHERE status = 'closed') AS closed
       FROM tickets`
    );

    // 2. Period-scoped metrics
    const periodResult = await queryWithTenant(tenantId,
      `SELECT
         COUNT(*) AS period_total,
         COUNT(*) FILTER (WHERE status IN ('open', 'pending')) AS period_open,
         COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS period_closed,
         
         -- SLA compliance (response)
         COUNT(*) FILTER (WHERE sla_response_met IS NOT NULL) AS response_measured,
         COUNT(*) FILTER (WHERE sla_response_met = TRUE) AS response_met,
         COUNT(*) FILTER (WHERE sla_response_met = FALSE) AS response_breached,
         
         -- SLA compliance (resolution)
         COUNT(*) FILTER (WHERE sla_resolution_met IS NOT NULL) AS resolution_measured,
         COUNT(*) FILTER (WHERE sla_resolution_met = TRUE) AS resolution_met,
         COUNT(*) FILTER (WHERE sla_resolution_met = FALSE) AS resolution_breached,
         
         -- Average times (in minutes) for resolved/closed tickets
         ROUND(AVG(
           EXTRACT(EPOCH FROM (first_response_at - opened_at)) / 60
         ) FILTER (WHERE first_response_at IS NOT NULL), 1) AS avg_response_minutes,
         
         ROUND(AVG(
           EXTRACT(EPOCH FROM (resolved_at - opened_at)) / 60
         ) FILTER (WHERE resolved_at IS NOT NULL), 1) AS avg_resolution_minutes

       FROM tickets
       WHERE opened_at >= ${periodSql}`
    );

    // 3. MTTR by priority (period-scoped)
    const mttrResult = await queryWithTenant(tenantId,
      `SELECT
         priority,
         COUNT(*) AS count,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (resolved_at - opened_at)) / 60
         ), 0) AS avg_resolution_minutes,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (first_response_at - opened_at)) / 60
         ), 0) AS avg_response_minutes
       FROM tickets
       WHERE resolved_at IS NOT NULL
         AND opened_at >= ${periodSql}
       GROUP BY priority
       ORDER BY 
         CASE priority 
           WHEN 'critical' THEN 1 
           WHEN 'high' THEN 2 
           WHEN 'medium' THEN 3 
           WHEN 'low' THEN 4 
         END`
    );

    // 4. Ticket volume trend (daily, last 30 days regardless of period)
    const trendResult = await queryWithTenant(tenantId,
      `SELECT
         DATE(opened_at) AS day,
         COUNT(*) AS opened,
         COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS closed
       FROM tickets
       WHERE opened_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(opened_at)
       ORDER BY day`
    );

    // 5. Top categories (period-scoped)
    const categoryResult = await queryWithTenant(tenantId,
      `SELECT
         COALESCE(category, 'Uncategorised') AS category,
         COUNT(*) AS count,
         COUNT(*) FILTER (WHERE sla_resolution_met = FALSE) AS breached
       FROM tickets
       WHERE opened_at >= ${periodSql}
       GROUP BY category
       ORDER BY count DESC
       LIMIT 8`
    );

    const s = statusResult.rows[0];
    const p = periodResult.rows[0];

    // Compute SLA compliance percentages
    const responseMeasured = parseInt(p.response_measured || 0);
    const resolutionMeasured = parseInt(p.resolution_measured || 0);

    const stats = {
      period,

      // All-time status counts
      allTime: {
        total: parseInt(s.total),
        open: parseInt(s.open),
        pending: parseInt(s.pending),
        resolved: parseInt(s.resolved),
        closed: parseInt(s.closed),
      },

      // Period-scoped counts
      period: {
        total: parseInt(p.period_total),
        open: parseInt(p.period_open),
        closed: parseInt(p.period_closed),
      },

      // SLA compliance
      sla: {
        responseCompliance: responseMeasured > 0
          ? parseFloat(((parseInt(p.response_met) / responseMeasured) * 100).toFixed(1))
          : null,
        resolutionCompliance: resolutionMeasured > 0
          ? parseFloat(((parseInt(p.resolution_met) / resolutionMeasured) * 100).toFixed(1))
          : null,
        responseBreaches: parseInt(p.response_breached || 0),
        resolutionBreaches: parseInt(p.resolution_breached || 0),
      },

      // Average times
      avgResponseMinutes: p.avg_response_minutes ? parseFloat(p.avg_response_minutes) : null,
      avgResolutionMinutes: p.avg_resolution_minutes ? parseFloat(p.avg_resolution_minutes) : null,

      // MTTR by priority
      mttrByPriority: mttrResult.rows.map(r => ({
        priority: r.priority,
        count: parseInt(r.count),
        avgResponseMin: r.avg_response_minutes ? parseInt(r.avg_response_minutes) : null,
        avgResolutionMin: r.avg_resolution_minutes ? parseInt(r.avg_resolution_minutes) : null,
      })),

      // Daily trend
      dailyTrend: trendResult.rows.map(r => ({
        date: r.day.toISOString().split('T')[0],
        opened: parseInt(r.opened),
        closed: parseInt(r.closed),
      })),

      // Top categories
      topCategories: categoryResult.rows.map(r => ({
        name: r.category,
        count: parseInt(r.count),
        breached: parseInt(r.breached),
      })),
    };

    return Response.json(stats);
  } catch (err) {
    console.error('[VEMIO API] Ticket stats query failed:', err.message);
    return Response.json({ error: 'Failed to fetch ticket stats' }, { status: 500 });
  }
});
