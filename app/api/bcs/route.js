/**
 * VEMIO™ — BCS Intelligence API
 * GET /api/bcs
 *
 * Returns current BCS score, dimension breakdown, historical trend,
 * and per-tenant dimension weights.
 *
 * Query params:
 *   ?range=30d|90d|365d (default: 90d)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '90d';

  try {
    // Current BCS
    const current = await queryWithTenant(tenantId, `
      SELECT score, visibility_coverage, redundancy_readiness,
        firmware_currency, config_integrity,
        alerting_maturity, response_discipline,
        details, computed_at
      FROM bcs_scores
      ORDER BY computed_at DESC LIMIT 1
    `);

    // Previous score for delta
    const previous = await queryWithTenant(tenantId, `
      SELECT score, computed_at FROM bcs_scores
      ORDER BY computed_at DESC OFFSET 1 LIMIT 1
    `);

    // Historical trend
    const intervalMap = { '30d': '30 days', '90d': '90 days', '365d': '365 days' };
    const interval = intervalMap[range] || '90 days';

    const history = await queryWithTenant(tenantId, `
      SELECT score, visibility_coverage, redundancy_readiness,
        firmware_currency, config_integrity,
        alerting_maturity, response_discipline, computed_at
      FROM bcs_scores
      WHERE computed_at > NOW() - INTERVAL '${interval}'
      ORDER BY computed_at ASC
    `);

    // Dimension weights
    const weights = await queryWithTenant(tenantId, `
      SELECT visibility_coverage, redundancy_readiness,
        firmware_currency, config_integrity,
        alerting_maturity, response_discipline
      FROM bcs_dimension_weights
    `);

    const currentScore = current.rows[0] || null;
    const prevScore = previous.rows[0] || null;

    return Response.json({
      current: currentScore ? {
        score: parseInt(currentScore.score),
        delta: prevScore ? parseInt(currentScore.score) - parseInt(prevScore.score) : 0,
        dimensions: {
          visibility_coverage:  parseFloat(currentScore.visibility_coverage),
          redundancy_readiness: parseFloat(currentScore.redundancy_readiness),
          firmware_currency:    parseFloat(currentScore.firmware_currency),
          config_integrity:     parseFloat(currentScore.config_integrity),
          alerting_maturity:    parseFloat(currentScore.alerting_maturity),
          response_discipline:  parseFloat(currentScore.response_discipline),
        },
        details: currentScore.details,
        computed_at: currentScore.computed_at,
      } : null,
      history: history.rows.map(h => ({
        score: parseInt(h.score),
        visibility_coverage:  parseFloat(h.visibility_coverage),
        redundancy_readiness: parseFloat(h.redundancy_readiness),
        firmware_currency:    parseFloat(h.firmware_currency),
        config_integrity:     parseFloat(h.config_integrity),
        alerting_maturity:    parseFloat(h.alerting_maturity),
        response_discipline:  parseFloat(h.response_discipline),
        computed_at: h.computed_at,
      })),
      weights: weights.rows[0] || null,
      range,
    });
  } catch (err) {
    console.error('[API /bcs] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
