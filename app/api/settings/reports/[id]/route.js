/**
 * VEMIO™ — Scheduled Report [id] API
 * PATCH  /api/settings/reports/[id]  — Toggle active, update recipients/schedule
 * DELETE /api/settings/reports/[id]  — Remove schedule
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const PATCH = withAuth(async (req, session, { params }) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const { id }   = await params;

  try {
    const body = await req.json();
    const { is_active, recipients, frequency, day_of_week, day_of_month } = body;

    const updates  = [];
    const values   = [];
    let paramIdx   = 2;

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIdx}`);
      values.push(is_active);
      paramIdx++;
    }
    if (recipients !== undefined) {
      updates.push(`recipients = $${paramIdx}`);
      values.push(recipients);
      paramIdx++;
    }
    if (frequency !== undefined) {
      updates.push(`frequency = $${paramIdx}`);
      values.push(frequency);
      paramIdx++;
    }
    if (day_of_week !== undefined) {
      updates.push(`day_of_week = $${paramIdx}`);
      values.push(day_of_week);
      paramIdx++;
    }
    if (day_of_month !== undefined) {
      updates.push(`day_of_month = $${paramIdx}`);
      values.push(day_of_month);
      paramIdx++;
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }
    updates.push('updated_at = NOW()');

    const result = await queryWithTenant(tenantId, `
      UPDATE scheduled_reports
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `, [id, ...values]);

    if (result.rowCount === 0) {
      return Response.json({ error: 'Scheduled report not found' }, { status: 404 });
    }

    return Response.json({ success: true, scheduled_report: result.rows[0] });

  } catch (err) {
    console.error('Scheduled report PATCH error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const DELETE = withAuth(async (req, session, { params }) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  const { id }   = await params;

  try {
    const result = await queryWithTenant(tenantId, `
      DELETE FROM scheduled_reports WHERE id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return Response.json({ error: 'Scheduled report not found' }, { status: 404 });
    }

    return Response.json({ success: true });

  } catch (err) {
    console.error('Scheduled report DELETE error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});