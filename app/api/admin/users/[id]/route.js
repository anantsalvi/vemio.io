/**
 * VEMIO™ — MSP Admin: Single User API
 * 
 * PATCH  /api/admin/users/[id] — Update user (role, name, active, password)
 * DELETE /api/admin/users/[id] — Deactivate user (soft delete)
 */

import { withMSPAuth } from '@/lib/admin-auth';
import { queryRaw } from '@/lib/db';

export const PATCH = withMSPAuth(async (req, session, { params }) => {
  const { id } = await params;
  const body = await req.json();

  // Verify user exists
  const { rows: existing } = await queryRaw(
    'SELECT id, email, tenant_id FROM users WHERE id = $1',
    [id]
  );

  if (existing.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  const updates = [];
  const values = [];
  let idx = 1;

  if (body.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(body.name);
  }

  if (body.role !== undefined) {
    const validRoles = ['admin', 'viewer', 'site_manager', 'security_officer', 'executive'];
    if (!validRoles.includes(body.role)) {
      return Response.json({ error: 'Invalid role' }, { status: 400 });
    }
    updates.push(`role = $${idx++}::user_role`);
    values.push(body.role);
  }

  if (body.is_active !== undefined) {
    updates.push(`is_active = $${idx++}`);
    values.push(body.is_active);
  }

  if (body.password) {
    const { rows: hashRows } = await queryRaw(
      "SELECT crypt($1, gen_salt('bf', 12)) AS hash",
      [body.password]
    );
    updates.push(`password_hash = $${idx++}`);
    values.push(hashRows[0].hash);
  }

  if (updates.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  values.push(id);
  const { rows } = await queryRaw(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}
     RETURNING id, email, name, role, is_active`,
    values
  );

  return Response.json({ user: rows[0] });
});

export const DELETE = withMSPAuth(async (req, session, { params }) => {
  const { id } = await params;

  const { rows } = await queryRaw(
    `UPDATE users SET is_active = false WHERE id = $1
     RETURNING id, email, name, is_active`,
    [id]
  );

  if (rows.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  return Response.json({ user: rows[0], message: 'User deactivated' });
});