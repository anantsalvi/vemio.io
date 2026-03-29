/**
 * VEMIO™ — Ticket Stats API
 * GET /api/tickets/stats?period=mtd
 * 
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryAggregateForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') || 'mtd';

  const periodMap = {
    '7d':  "NOW() - INTERVAL '7 days'",
    'mtd': "DATE_TRUNC('month', NOW())",
    '30d': "NOW() - INTERVAL '30 days'",
    '90d': "NOW() - INTERVAL '90 days'",
  };
  const periodStart = periodMap[period] || periodMap['mtd'];

  try {
    const allTime = await queryAggregateForTenant(target,
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open') AS open,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
         COUNT(*) FILTER (WHERE status = 'closed') AS closed
       FROM tickets`
    );

    const periodStats = await queryAggregateForTenant(target,
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved
       FROM tickets
       WHERE created_at >= ${periodStart}`
    );

    const slaStats = await queryAggregateForTenant(target,
      `SELECT
         COUNT(*) FILTER (WHERE sla_response_met = TRUE) AS response_met,
         COUNT(*) FILTER (WHERE sla_response_met = FALSE) AS response_breached,
         COUNT(*) FILTER (WHERE sla_resolution_met = TRUE) AS resolution_met,
         COUNT(*) FILTER (WHERE sla_resolution_met = FALSE) AS resolution_breached
       FROM tickets
       WHERE created_at >= ${periodStart}`
    );

    const avgTimes = await queryAggregateForTenant(target,
      `SELECT
         AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)::numeric AS avg_response,
         AVG(EXTRACT(EPOCH FROM (
           CASE WHEN resolved_at IS NOT NULL THEN resolved_at ELSE NOW() END - created_at
         )) / 60)::numeric AS avg_resolution
       FROM tickets
       WHERE created_at >= ${periodStart}
         AND status IN ('resolved', 'closed')`
    );

    const responseMet = parseInt(slaStats.response_met || 0);
    const responseBreached = parseInt(slaStats.response_breached || 0);
    const resolutionMet = parseInt(slaStats.resolution_met || 0);
    const resolutionBreached = parseInt(slaStats.resolution_breached || 0);

    const responseTotal = responseMet + responseBreached;
    const resolutionTotal = resolutionMet + resolutionBreached;

    return Response.json({
      allTime: {
        open: parseInt(allTime.open || 0),
        pending: parseInt(allTime.pending || 0),
        resolved: parseInt(allTime.resolved || 0),
        closed: parseInt(allTime.closed || 0),
      },
      period: {
        total: parseInt(periodStats.total || 0),
        resolved: parseInt(periodStats.resolved || 0),
      },
      sla: {
        responseCompliance: responseTotal > 0 ? Math.round((responseMet / responseTotal) * 100) : null,
        resolutionCompliance: resolutionTotal > 0 ? Math.round((resolutionMet / resolutionTotal) * 100) : null,
        responseBreaches: responseBreached,
        resolutionBreaches: resolutionBreached,
      },
      avgResponseMinutes: avgTimes.avg_response ? parseFloat(parseFloat(avgTimes.avg_response).toFixed(1)) : null,
      avgResolutionMinutes: avgTimes.avg_resolution ? parseFloat(parseFloat(avgTimes.avg_resolution).toFixed(1)) : null,
    });
  } catch (err) {
    console.error('[API /tickets/stats] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
