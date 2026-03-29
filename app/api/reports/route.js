/**
 * VEMIO™ — Reports API
 * GET /api/reports?type=sla|bcs|device_health&month=2026-03
 *
 * PHASE 6.1: Cross-tenant MSP support via resolveTargetTenant().
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { resolveTargetTenant, queryForTenant, queryAggregateForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const { searchParams } = new URL(req.url);
  const type  = searchParams.get('type') || 'sla';
  const month = searchParams.get('month');

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  const now = new Date();
  const reportMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = reportMonth.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString();

  try {
    // Tenant info for report header
    // In all-tenants mode, use the first managed tenant's info or aggregate
    let tenant;
    if (target.mode === 'single') {
      const tenantResult = await queryWithTenant(target.tenantId, `
        SELECT name, slug, vemio_plan, primary_contact_name, primary_contact_email, sla_uptime_target
        FROM tenants
      `);
      tenant = tenantResult.rows[0];
    } else {
      tenant = { name: 'All Managed Tenants', vemio_plan: 'command', sla_uptime_target: 99.9 };
    }

    if (type === 'sla') {
      return await generateSLAReport(target, tenant, reportMonth, startDate, endDate);
    }
    if (type === 'bcs') {
      return await generateBCSReport(target, tenant, reportMonth, startDate, endDate);
    }
    if (type === 'device_health') {
      return await generateDeviceHealthReport(target, tenant, reportMonth, startDate, endDate);
    }

    return Response.json({ error: 'Invalid report type. Use: sla, bcs, device_health' }, { status: 400 });
  } catch (err) {
    console.error(`[API /reports] Error (${type}):`, err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

async function generateSLAReport(target, tenant, reportMonth, startDate, endDate) {
  const ticketSummary = await queryAggregateForTenant(target, `
    SELECT
      COUNT(*) AS total_tickets,
      COUNT(*) FILTER (WHERE status IN ('resolved', 'closed')) AS resolved,
      COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'closed')) AS open,
      COUNT(*) FILTER (WHERE sla_response_met = TRUE) AS response_met,
      COUNT(*) FILTER (WHERE sla_response_met = FALSE) AS response_breached,
      COUNT(*) FILTER (WHERE sla_resolution_met = TRUE) AS resolution_met,
      COUNT(*) FILTER (WHERE sla_resolution_met = FALSE) AS resolution_breached,
      COUNT(*) FILTER (WHERE priority = 'critical') AS critical,
      COUNT(*) FILTER (WHERE priority = 'high') AS high,
      COUNT(*) FILTER (WHERE priority = 'medium') AS medium,
      COUNT(*) FILTER (WHERE priority = 'low') AS low
    FROM tickets
    WHERE created_at BETWEEN $1 AND $2
  `, [startDate, endDate]);

  const slaCompliance = await queryAggregateForTenant(target, `
    SELECT
      CASE WHEN COUNT(*) FILTER (WHERE sla_response_met IS NOT NULL) > 0
        THEN ROUND(
          COUNT(*) FILTER (WHERE sla_response_met = TRUE)::numeric /
          COUNT(*) FILTER (WHERE sla_response_met IS NOT NULL) * 100, 1)
        ELSE NULL END AS response_compliance,
      CASE WHEN COUNT(*) FILTER (WHERE sla_resolution_met IS NOT NULL) > 0
        THEN ROUND(
          COUNT(*) FILTER (WHERE sla_resolution_met = TRUE)::numeric /
          COUNT(*) FILTER (WHERE sla_resolution_met IS NOT NULL) * 100, 1)
        ELSE NULL END AS resolution_compliance
    FROM tickets
    WHERE created_at BETWEEN $1 AND $2
  `, [startDate, endDate]);

  const slaByPriority = await queryForTenant(target, `
    SELECT
      priority, COUNT(*) AS total,
      COUNT(*) FILTER (WHERE sla_resolution_met = TRUE) AS met,
      COUNT(*) FILTER (WHERE sla_resolution_met = FALSE) AS breached,
      ROUND(AVG(
        EXTRACT(EPOCH FROM (
          CASE WHEN resolved_at IS NOT NULL THEN resolved_at ELSE NOW() END
        ) - created_at) / 3600
      )::numeric, 1) AS avg_resolution_hours
    FROM tickets
    WHERE created_at BETWEEN $1 AND $2
    GROUP BY priority
    ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
  `, [startDate, endDate]);

  // Merge slaByPriority across tenants
  const priorityMap = {};
  for (const r of slaByPriority.rows) {
    if (!priorityMap[r.priority]) {
      priorityMap[r.priority] = { priority: r.priority, total: 0, met: 0, breached: 0, avgHoursSum: 0, avgCount: 0 };
    }
    const p = priorityMap[r.priority];
    p.total += parseInt(r.total);
    p.met += parseInt(r.met);
    p.breached += parseInt(r.breached);
    p.avgHoursSum += parseFloat(r.avg_resolution_hours || 0) * parseInt(r.total);
    p.avgCount += parseInt(r.total);
  }

  const breachedTickets = await queryForTenant(target, `
    SELECT t.glpi_ticket_id, t.title, t.priority, t.status, t.created_at, t.resolved_at,
      s.name AS site_name
    FROM tickets t
    LEFT JOIN sites s ON s.id = t.site_id
    WHERE t.created_at BETWEEN $1 AND $2
      AND t.sla_resolution_met = FALSE
    ORDER BY t.priority, t.created_at DESC
    LIMIT 10
  `, [startDate, endDate]);

  const summary = ticketSummary;
  const compliance = slaCompliance;

  return Response.json({
    report_type: 'sla',
    report_month: reportMonth,
    generated_at: new Date().toISOString(),
    tenant: { name: tenant.name, plan: tenant.vemio_plan, uptime_target: parseFloat(tenant.sla_uptime_target || 99.9) },
    isAllTenants: target.mode === 'all',
    summary: {
      total_tickets: parseInt(summary.total_tickets || 0),
      resolved: parseInt(summary.resolved || 0),
      open: parseInt(summary.open || 0),
      by_priority: {
        critical: parseInt(summary.critical || 0),
        high: parseInt(summary.high || 0),
        medium: parseInt(summary.medium || 0),
        low: parseInt(summary.low || 0),
      },
    },
    sla_compliance: {
      response: compliance.response_compliance ? parseFloat(compliance.response_compliance) : null,
      resolution: compliance.resolution_compliance ? parseFloat(compliance.resolution_compliance) : null,
      response_met: parseInt(summary.response_met || 0),
      response_breached: parseInt(summary.response_breached || 0),
      resolution_met: parseInt(summary.resolution_met || 0),
      resolution_breached: parseInt(summary.resolution_breached || 0),
    },
    sla_by_priority: Object.values(priorityMap).map(p => ({
      priority: p.priority,
      total: p.total,
      met: p.met,
      breached: p.breached,
      avg_resolution_hours: p.avgCount > 0 ? parseFloat((p.avgHoursSum / p.avgCount).toFixed(1)) : 0,
    })),
    breached_tickets: breachedTickets.rows,
  });
}

async function generateBCSReport(target, tenant, reportMonth, startDate, endDate) {
  const scores = await queryForTenant(target, `
    SELECT score, visibility_coverage, redundancy_readiness,
      firmware_currency, config_integrity,
      alerting_maturity, response_discipline,
      details, computed_at
    FROM bcs_scores
    WHERE computed_at BETWEEN $1 AND $2
    ORDER BY computed_at ASC
  `, [startDate, endDate]);

  const latest = await queryForTenant(target, `
    SELECT score, visibility_coverage, redundancy_readiness,
      firmware_currency, config_integrity,
      alerting_maturity, response_discipline,
      details, computed_at
    FROM bcs_scores
    ORDER BY computed_at DESC LIMIT 1
  `);

  const criticalDevices = await queryForTenant(target, `
    SELECT name, device_type, current_status, has_redundancy, firmware_is_current
    FROM devices
    WHERE is_critical = TRUE AND is_monitored = TRUE
    ORDER BY device_type, name
  `);

  // Average if all-tenants
  let current_score = null;
  if (latest.rows.length > 0) {
    if (target.mode === 'all') {
      const dims = ['visibility_coverage', 'redundancy_readiness', 'firmware_currency', 'config_integrity', 'alerting_maturity', 'response_discipline'];
      const avg = {};
      for (const d of dims) avg[d] = latest.rows.reduce((s, r) => s + parseFloat(r[d] || 0), 0) / latest.rows.length;
      current_score = {
        score: Math.round(latest.rows.reduce((s, r) => s + parseInt(r.score), 0) / latest.rows.length),
        dimensions: Object.fromEntries(dims.map(d => [d, parseFloat(avg[d].toFixed(1))])),
        computed_at: latest.rows[0].computed_at,
      };
    } else {
      const c = latest.rows[0];
      current_score = {
        score: parseInt(c.score),
        dimensions: {
          visibility_coverage: parseFloat(c.visibility_coverage),
          redundancy_readiness: parseFloat(c.redundancy_readiness),
          firmware_currency: parseFloat(c.firmware_currency),
          config_integrity: parseFloat(c.config_integrity),
          alerting_maturity: parseFloat(c.alerting_maturity),
          response_discipline: parseFloat(c.response_discipline),
        },
        computed_at: c.computed_at,
      };
    }
  }

  const trend = scores.rows.map(s => ({ score: parseInt(s.score), computed_at: s.computed_at }));

  return Response.json({
    report_type: 'bcs',
    report_month: reportMonth,
    generated_at: new Date().toISOString(),
    tenant: { name: tenant.name, plan: tenant.vemio_plan },
    isAllTenants: target.mode === 'all',
    current_score,
    trend,
    critical_devices: criticalDevices.rows,
  });
}

async function generateDeviceHealthReport(target, tenant, reportMonth, startDate, endDate) {
  const byType = await queryForTenant(target, `
    SELECT device_type, COUNT(*) AS total,
      COUNT(*) FILTER (WHERE current_status = 'up') AS up,
      COUNT(*) FILTER (WHERE current_status = 'down') AS down,
      COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded,
      COUNT(*) FILTER (WHERE current_status = 'unknown') AS unknown
    FROM devices WHERE is_monitored = TRUE
    GROUP BY device_type ORDER BY COUNT(*) DESC
  `);

  // Merge type counts
  const typeMap = {};
  for (const r of byType.rows) {
    if (!typeMap[r.device_type]) typeMap[r.device_type] = { device_type: r.device_type, total: 0, up: 0, down: 0, degraded: 0, unknown: 0 };
    const t = typeMap[r.device_type];
    t.total += parseInt(r.total); t.up += parseInt(r.up);
    t.down += parseInt(r.down); t.degraded += parseInt(r.degraded); t.unknown += parseInt(r.unknown);
  }

  const bySite = await queryForTenant(target, `
    SELECT s.name AS site_name, COUNT(d.id) AS total,
      COUNT(d.id) FILTER (WHERE d.current_status = 'up') AS up,
      COUNT(d.id) FILTER (WHERE d.current_status = 'down') AS down
    FROM devices d LEFT JOIN sites s ON s.id = d.site_id
    WHERE d.is_monitored = TRUE
    GROUP BY s.name ORDER BY s.name
  `, [], { addTenantInfo: target.mode === 'all' });

  const downDevices = await queryForTenant(target, `
    SELECT d.name, d.device_type, d.last_seen_at, d.is_critical, s.name AS site_name
    FROM devices d LEFT JOIN sites s ON s.id = d.site_id
    WHERE d.current_status = 'down' AND d.is_monitored = TRUE
    ORDER BY d.is_critical DESC, d.last_seen_at DESC NULLS LAST LIMIT 20
  `);

  const overall = await queryAggregateForTenant(target, `
    SELECT COUNT(*) AS total,
      COUNT(*) FILTER (WHERE current_status = 'up') AS up,
      ROUND(COUNT(*) FILTER (WHERE current_status = 'up')::numeric / NULLIF(COUNT(*), 0) * 100, 1) AS health_percent
    FROM devices WHERE is_monitored = TRUE
  `);

  // Merge bySite
  const siteMap = {};
  for (const r of bySite.rows) {
    const key = r.site_name || 'Unassigned';
    if (!siteMap[key]) siteMap[key] = { site_name: key, total: 0, up: 0, down: 0 };
    siteMap[key].total += parseInt(r.total); siteMap[key].up += parseInt(r.up); siteMap[key].down += parseInt(r.down);
  }

  return Response.json({
    report_type: 'device_health',
    report_month: reportMonth,
    generated_at: new Date().toISOString(),
    tenant: { name: tenant.name, plan: tenant.vemio_plan },
    isAllTenants: target.mode === 'all',
    overall: {
      total: parseInt(overall.total || 0),
      up: parseInt(overall.up || 0),
      health_percent: parseFloat(overall.health_percent || 0),
    },
    by_type: Object.values(typeMap).sort((a, b) => b.total - a.total),
    by_site: Object.values(siteMap),
    down_devices: downDevices.rows,
  });
}
