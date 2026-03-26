/**
 * VEMIO™ — Scheduled Reports API
 * GET    /api/settings/reports           — List scheduled reports
 * POST   /api/settings/reports           — Create scheduled report
 * PATCH  /api/settings/reports/[id]      — Update scheduled report
 * DELETE /api/settings/reports/[id]      — Delete scheduled report
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

// ── GET + POST ────────────────────────────────────────────────────────────────

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;
  try {
    const result = await queryWithTenant(tenantId, `
      SELECT id, report_type, frequency, day_of_week, day_of_month,
             recipients, is_active, last_sent_at, next_run_at, created_at
      FROM scheduled_reports
      ORDER BY created_at ASC
    `, []);
    return Response.json({ scheduled_reports: result.rows });
  } catch (err) {
    console.error('Scheduled reports GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAuth(async (req, session) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const { report_type, frequency, day_of_week, day_of_month, recipients } = body;

    if (!report_type || !frequency || !recipients?.length) {
      return Response.json({
        error: 'report_type, frequency, and at least one recipient are required',
      }, { status: 400 });
    }

    const next_run_at = computeNextRun(frequency, day_of_week, day_of_month);

    const result = await queryWithTenant(tenantId, `
      INSERT INTO scheduled_reports
        (tenant_id, report_type, frequency, day_of_week, day_of_month,
         recipients, is_active, next_run_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING *
    `, [
      tenantId, report_type, frequency,
      day_of_week  ?? null,
      day_of_month ?? null,
      recipients,
      next_run_at,
    ]);

    return Response.json({ success: true, scheduled_report: result.rows[0] }, { status: 201 });

  } catch (err) {
    console.error('Scheduled reports POST error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────

function computeNextRun(frequency, day_of_week, day_of_month) {
  const now = new Date();
  // Use IST (UTC+5:30) — schedule for 08:00 IST = 02:30 UTC
  const next = new Date(now);
  next.setUTCHours(2, 30, 0, 0);

  if (frequency === 'weekly') {
    const dow    = day_of_week ?? 1; // default Monday
    const daysUntil = (dow - now.getUTCDay() + 7) % 7 || 7;
    next.setUTCDate(now.getUTCDate() + daysUntil);
  } else {
    // monthly
    const dom = day_of_month ?? 1;
    next.setUTCDate(dom);
    if (next <= now) {
      next.setUTCMonth(next.getUTCMonth() + 1);
    }
  }
  return next.toISOString();
}