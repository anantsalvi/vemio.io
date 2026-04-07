/**
 * VEMIO™ — Trigger Rediscover
 * POST /api/collectors/[id]/rediscover
 * Body: { hard?: boolean }
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const POST = withAuth(async (req, session, { params }) => {
  const tenantId = session.tenantId || session.user?.tenantId;
  if (!tenantId) {
    return Response.json({ error: 'No tenant in session' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return Response.json({ error: 'collector id required' }, { status: 400 });

  let body = {};
  try {
    body = await req.json();
  } catch { /* empty body is fine */ }

  const hard = body.hard === true;
  const commandType = hard ? 'hard_reset' : 'soft_rediscover';

  try {
    const check = await queryWithTenant(tenantId,
      `SELECT id, status FROM collector_sites WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      return Response.json({ error: 'Collector not found' }, { status: 404 });
    }
    if (check.rows[0].status !== 'active') {
      return Response.json({ error: 'Collector is not active' }, { status: 409 });
    }

    const existing = await queryWithTenant(tenantId, `
      SELECT id, status FROM collector_commands
      WHERE collector_site_id = $1
        AND command_type = $2
        AND status IN ('pending','delivered','running')
      LIMIT 1
    `, [id, commandType]);
    if (existing.rows.length > 0) {
      return Response.json({
        error: 'A ' + commandType + ' command is already queued',
        existing: existing.rows[0],
      }, { status: 409 });
    }

    const inserted = await queryWithTenant(tenantId, `
      INSERT INTO collector_commands
        (tenant_id, collector_site_id, command_type, status, payload, created_by)
      VALUES
        ($1, $2, $3, 'pending', $4::jsonb, $5)
      RETURNING id, command_type, status, created_at
    `, [
      tenantId,
      id,
      commandType,
      JSON.stringify({ requested_by: session.user?.email || 'unknown' }),
      session.user?.id || null,
    ]);

    return Response.json({
      command: inserted.rows[0],
      message: hard
        ? 'Hard reset queued. Collector will pick it up within 30s.'
        : 'Rediscover queued. Collector will pick it up within 30s.',
    });
  } catch (err) {
    console.error('[VEMIO API] Rediscover error:', err.message);
    return Response.json({ error: 'Failed to queue command' }, { status: 500 });
  }
});
