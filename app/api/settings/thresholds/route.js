/**
 * VEMIO™ — Alert Thresholds API
 * app/api/settings/thresholds/route.js
 *
 * GET  /api/settings/thresholds — returns effective thresholds for current tenant
 * PUT  /api/settings/thresholds — upsert tenant-specific overrides
 *
 * Admin and MSP admin only for PUT.
 * Uses MSP-aware resolveTargetTenant/queryForTenant pattern.
 */

import { withAuth } from '@/lib/auth';
import { resolveTargetTenant, queryForTenant } from '@/lib/tenant';

export const GET = withAuth(async (req, session) => {
  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  try {
    // Get effective thresholds: tenant-specific if exists, else system defaults
    // DISTINCT ON (metric) with ORDER BY tenant_id NULLS LAST ensures
    // tenant override wins over system default
    const result = await queryForTenant(target,
      `SELECT DISTINCT ON (metric)
         id, tenant_id, metric, warning_value, critical_value,
         sustained_minutes, enabled, updated_at
       FROM alert_thresholds
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY metric, tenant_id NULLS LAST`,
      [target.tenantId]
    );

    const thresholds = result.rows.map(row => ({
      id: row.id,
      metric: row.metric,
      warningValue: parseFloat(row.warning_value),
      criticalValue: parseFloat(row.critical_value),
      sustainedMinutes: row.sustained_minutes,
      enabled: row.enabled,
      isCustom: row.tenant_id !== null,
      updatedAt: row.updated_at,
    }));

    return Response.json({ thresholds });
  } catch (err) {
    console.error('[VEMIO API] Thresholds GET error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PUT = withAuth(async (req, session) => {
  if (!['admin', 'msp_admin'].includes(session.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const target = await resolveTargetTenant(session, req);
  if (target.error) {
    return Response.json({ error: target.error }, { status: 403 });
  }

  const body = await req.json();
  const { thresholds } = body;

  if (!Array.isArray(thresholds)) {
    return Response.json({ error: 'thresholds array required' }, { status: 400 });
  }

  const validMetrics = ['cpu', 'memory', 'storage', 'bandwidth_util', 'latency', 'jitter', 'packet_loss'];

  try {
    const results = [];

    for (const t of thresholds) {
      if (!validMetrics.includes(t.metric)) continue;

      const result = await queryForTenant(target,
        `INSERT INTO alert_thresholds
           (tenant_id, metric, warning_value, critical_value, sustained_minutes, enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (tenant_id, metric) DO UPDATE SET
           warning_value = $3,
           critical_value = $4,
           sustained_minutes = $5,
           enabled = $6,
           updated_at = NOW()
         RETURNING *`,
        [
          target.tenantId,
          t.metric,
          t.warningValue,
          t.criticalValue,
          t.sustainedMinutes || 5,
          t.enabled !== false,
        ]
      );
      results.push(result.rows[0]);
    }

    return Response.json({
      success: true,
      updated: results.length,
    });
  } catch (err) {
    console.error('[VEMIO API] Thresholds PUT error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});