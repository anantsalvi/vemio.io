/**
 * VEMIO™ — Reports API
 * GET /api/reports?type=sla|bcs|device_health&month=2026-03
 *
 * Returns structured report data for PDF generation on the client.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  const { searchParams } = new URL(req.url);
  const type  = searchParams.get('type') || 'sla';
  const month = searchParams.get('month'); // YYYY-MM format

  // Default to current month
  const now = new Date();
  const reportMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = reportMonth.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1).toISOString();
  const endDate = new Date(year, mon, 0, 23, 59, 59).toISOString();

  try {
    // Tenant info for report header
    const tenantResult = await queryWithTenant(tenantId, `
      SELECT name, slug, vemio_plan, primary_contact_name, primary_contact_email,
        sla_uptime_target
      FROM tenants
    `);
    const tenant = tenantResult.rows[0];

    if (type === 'sla') {
      return await generateSLAReport(tenantId, tenant, reportMonth, startDate, endDate);
    }
    if (type === 'bcs') {
      return await generateBCSReport(tenantId, tenant, reportMonth, startDate, endDate);
    }
    if (type === 'device_health') {
      return await generateDeviceHealthReport(tenantId, tenant, reportMonth, startDate, endDate);
    }

    return Response.json({ error: 'Invalid report type. Use: sla, bcs, device_health' }, { status: 400 });
  } catch (err) {
    console.error(`[API /reports] Error (${type}):`, err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

async function generateSLAReport(tenantId, tenant, reportMonth, startDate, endDate) {
  // Ticket summary
  const ticketSummary = await queryWithTenant(tenantId, `
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

  // SLA compliance percentages
  const slaCompliance = await queryWithTenant(tenantId, `
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

  // SLA by priority
  const slaByPriority = await queryWithTenant(tenantId, `
    SELECT
      priority,
      COUNT(*) AS total,
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

  // Top 5 breached tickets
  const breachedTickets = await queryWithTenant(tenantId, `
    SELECT t.glpi_ticket_id, t.title, t.priority, t.status, t.created_at, t.resolved_at,
      s.name AS site_name
    FROM tickets t
    LEFT JOIN sites s ON s.id = t.site_id
    WHERE t.created_at BETWEEN $1 AND $2
      AND t.sla_resolution_met = FALSE
    ORDER BY t.priority, t.created_at DESC
    LIMIT 10
  `, [startDate, endDate]);

  const summary = ticketSummary.rows[0];
  const compliance = slaCompliance.rows[0];

  return Response.json({
    report_type: 'sla',
    report_month: reportMonth,
    generated_at: new Date().toISOString(),
    tenant: { name: tenant.name, plan: tenant.vemio_plan, uptime_target: parseFloat(tenant.sla_uptime_target) },
    summary: {
      total_tickets: parseInt(summary.total_tickets),
      resolved: parseInt(summary.resolved),
      open: parseInt(summary.open),
      by_priority: {
        critical: parseInt(summary.critical),
        high: parseInt(summary.high),
        medium: parseInt(summary.medium),
        low: parseInt(summary.low),
      },
    },
    sla_compliance: {
      response: compliance.response_compliance ? parseFloat(compliance.response_compliance) : null,
      resolution: compliance.resolution_compliance ? parseFloat(compliance.resolution_compliance) : null,
      response_met: parseInt(summary.response_met),
      response_breached: parseInt(summary.response_breached),
      resolution_met: parseInt(summary.resolution_met),
      resolution_breached: parseInt(summary.resolution_breached),
    },
    sla_by_priority: slaByPriority.rows.map(r => ({
      priority: r.priority,
      total: parseInt(r.total),
      met: parseInt(r.met),
      breached: parseInt(r.breached),
      avg_resolution_hours: parseFloat(r.avg_resolution_hours),
    })),
    breached_tickets: breachedTickets.rows,
  });
}

async function generateBCSReport(tenantId, tenant, reportMonth, startDate, endDate) {
  // BCS scores within the month
  const scores = await queryWithTenant(tenantId, `
    SELECT score, visibility_coverage, redundancy_readiness,
      firmware_currency, config_integrity,
      alerting_maturity, response_discipline,
      details, computed_at
    FROM bcs_scores
    WHERE computed_at BETWEEN $1 AND $2
    ORDER BY computed_at ASC
  `, [startDate, endDate]);

  // Latest score
  const latest = await queryWithTenant(tenantId, `
    SELECT score, visibility_coverage, redundancy_readiness,
      firmware_currency, config_integrity,
      alerting_maturity, response_discipline,
      details, computed_at
    FROM bcs_scores
    ORDER BY computed_at DESC LIMIT 1
  `);

  // Critical device summary
  const criticalDevices = await queryWithTenant(tenantId, `
    SELECT name, device_type, current_status, has_redundancy,
      firmware_is_current
    FROM devices
    WHERE is_critical = TRUE AND is_monitored = TRUE
    ORDER BY device_type, name
  `);

  const trend = scores.rows.map(s => ({
    score: parseInt(s.score),
    computed_at: s.computed_at,
  }));

  const current = latest.rows[0];

  return Response.json({
    report_type: 'bcs',
    report_month: reportMonth,
    generated_at: new Date().toISOString(),
    tenant: { name: tenant.name, plan: tenant.vemio_plan },
    current_score: current ? {
      score: parseInt(current.score),
      dimensions: {
        visibility_coverage: parseFloat(current.visibility_coverage),
        redundancy_readiness: parseFloat(current.redundancy_readiness),
        firmware_currency: parseFloat(current.firmware_currency),
        config_integrity: parseFloat(current.config_integrity),
        alerting_maturity: parseFloat(current.alerting_maturity),
        response_discipline: parseFloat(current.response_discipline),
      },
      computed_at: current.computed_at,
    } : null,
    trend,
    critical_devices: criticalDevices.rows,
  });
}

async function generateDeviceHealthReport(tenantId, tenant, reportMonth, startDate, endDate) {
  // Device summary by type
  const byType = await queryWithTenant(tenantId, `
    SELECT device_type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE current_status = 'up') AS up,
      COUNT(*) FILTER (WHERE current_status = 'down') AS down,
      COUNT(*) FILTER (WHERE current_status = 'degraded') AS degraded,
      COUNT(*) FILTER (WHERE current_status = 'unknown') AS unknown
    FROM devices
    WHERE is_monitored = TRUE
    GROUP BY device_type
    ORDER BY COUNT(*) DESC
  `);

  // Device summary by site
  const bySite = await queryWithTenant(tenantId, `
    SELECT s.name AS site_name,
      COUNT(d.id) AS total,
      COUNT(d.id) FILTER (WHERE d.current_status = 'up') AS up,
      COUNT(d.id) FILTER (WHERE d.current_status = 'down') AS down
    FROM devices d
    LEFT JOIN sites s ON s.id = d.site_id
    WHERE d.is_monitored = TRUE
    GROUP BY s.name
    ORDER BY s.name
  `);

  // Top 20 down devices
  const downDevices = await queryWithTenant(tenantId, `
    SELECT d.name, d.device_type, d.last_seen_at, d.is_critical,
      s.name AS site_name
    FROM devices d
    LEFT JOIN sites s ON s.id = d.site_id
    WHERE d.current_status = 'down' AND d.is_monitored = TRUE
    ORDER BY d.is_critical DESC, d.last_seen_at DESC NULLS LAST
    LIMIT 20
  `);

  // Overall health
  const overall = await queryWithTenant(tenantId, `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE current_status = 'up') AS up,
      ROUND(
        COUNT(*) FILTER (WHERE current_status = 'up')::numeric / NULLIF(COUNT(*), 0) * 100, 1
      ) AS health_percent
    FROM devices WHERE is_monitored = TRUE
  `);

  return Response.json({
    report_type: 'device_health',
    report_month: reportMonth,
    generated_at: new Date().toISOString(),
    tenant: { name: tenant.name, plan: tenant.vemio_plan },
    overall: {
      total: parseInt(overall.rows[0].total),
      up: parseInt(overall.rows[0].up),
      health_percent: parseFloat(overall.rows[0].health_percent),
    },
    by_type: byType.rows.map(r => ({
      device_type: r.device_type,
      total: parseInt(r.total),
      up: parseInt(r.up),
      down: parseInt(r.down),
      degraded: parseInt(r.degraded),
      unknown: parseInt(r.unknown),
    })),
    by_site: bySite.rows.map(r => ({
      site_name: r.site_name || 'Unassigned',
      total: parseInt(r.total),
      up: parseInt(r.up),
      down: parseInt(r.down),
    })),
    down_devices: downDevices.rows,
  });
}