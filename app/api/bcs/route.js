/**
 * VEMIO™ — BCS Intelligence API
 * GET /api/bcs
 *
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 * In all-tenants mode, returns averaged BCS across managed tenants.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || '90d';

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Current BCS (latest per tenant, then average in all mode)
    const current = await queryForTenant(target, `
      SELECT score, visibility_coverage, redundancy_readiness,
        firmware_currency, config_integrity,
        alerting_maturity, response_discipline,
        details, computed_at
      FROM bcs_scores
      ORDER BY computed_at DESC LIMIT 1
    `);

    // Previous score for delta
    const previous = await queryForTenant(target, `
      SELECT score, computed_at FROM bcs_scores
      ORDER BY computed_at DESC OFFSET 1 LIMIT 1
    `);

    // Historical trend
    const intervalMap = { '30d': '30 days', '90d': '90 days', '365d': '365 days' };
    const interval = intervalMap[range] || '90 days';

    const history = await queryForTenant(target, `
      SELECT score, visibility_coverage, redundancy_readiness,
        firmware_currency, config_integrity,
        alerting_maturity, response_discipline, computed_at
      FROM bcs_scores
      WHERE computed_at > NOW() - INTERVAL '${interval}'
      ORDER BY computed_at ASC
    `);

    // Dimension weights (same across tenants, take first)
    const weights = await queryForTenant(target, `
      SELECT visibility_coverage, redundancy_readiness,
        firmware_currency, config_integrity,
        alerting_maturity, response_discipline
      FROM bcs_dimension_weights
    `);

    // Process results
    let currentScore = null;
    let prevScore = null;

    if (target.mode === 'all' && current.rows.length > 0) {
      // Average across tenants
      const dims = ['visibility_coverage', 'redundancy_readiness', 'firmware_currency',
                     'config_integrity', 'alerting_maturity', 'response_discipline'];
      const avg = {};
      for (const d of dims) {
        avg[d] = current.rows.reduce((s, r) => s + parseFloat(r[d] || 0), 0) / current.rows.length;
      }
      const avgScore = current.rows.reduce((s, r) => s + parseInt(r.score || 0), 0) / current.rows.length;
      const prevAvg = previous.rows.length > 0
        ? previous.rows.reduce((s, r) => s + parseInt(r.score || 0), 0) / previous.rows.length
        : null;

      currentScore = {
        score: Math.round(avgScore),
        delta: prevAvg != null ? Math.round(avgScore) - Math.round(prevAvg) : 0,
        dimensions: Object.fromEntries(dims.map(d => [d, parseFloat(avg[d].toFixed(1))])),
        details: current.rows[0]?.details || null,
        computed_at: current.rows[0]?.computed_at,
      };
    } else if (current.rows[0]) {
      const c = current.rows[0];
      const p = previous.rows[0] || null;
      currentScore = {
        score: parseInt(c.score),
        delta: p ? parseInt(c.score) - parseInt(p.score) : 0,
        dimensions: {
          visibility_coverage:  parseFloat(c.visibility_coverage),
          redundancy_readiness: parseFloat(c.redundancy_readiness),
          firmware_currency:    parseFloat(c.firmware_currency),
          config_integrity:     parseFloat(c.config_integrity),
          alerting_maturity:    parseFloat(c.alerting_maturity),
          response_discipline:  parseFloat(c.response_discipline),
        },
        details: c.details,
        computed_at: c.computed_at,
      };
    }

    // History: in all mode, group by date and average
    let historyData;
    if (target.mode === 'all' && history.rows.length > 0) {
      const byDate = {};
      for (const h of history.rows) {
        const dateKey = new Date(h.computed_at).toISOString().split('T')[0];
        if (!byDate[dateKey]) byDate[dateKey] = [];
        byDate[dateKey].push(h);
      }
      historyData = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, rows]) => ({
        score: Math.round(rows.reduce((s, r) => s + parseInt(r.score), 0) / rows.length),
        computed_at: rows[0].computed_at,
      }));
    } else {
      historyData = history.rows.map(h => ({
        score: parseInt(h.score),
        visibility_coverage:  parseFloat(h.visibility_coverage),
        redundancy_readiness: parseFloat(h.redundancy_readiness),
        firmware_currency:    parseFloat(h.firmware_currency),
        config_integrity:     parseFloat(h.config_integrity),
        alerting_maturity:    parseFloat(h.alerting_maturity),
        response_discipline:  parseFloat(h.response_discipline),
        computed_at: h.computed_at,
      }));
    }

    return Response.json({
      current: currentScore,
      history: historyData,
      weights: weights.rows[0] || null,
      range,
      isAllTenants: target.mode === 'all',
    });
  } catch (err) {
    console.error('[API /bcs] Error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});
