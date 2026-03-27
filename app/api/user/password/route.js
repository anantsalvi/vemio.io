/**
 * VEMIO™ — User Password Change API
 * PATCH /api/user/password
 *
 * Requires current password + new password.
 * Uses pgcrypto for bcrypt hashing (same format as NextAuth).
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const PATCH = withAuth(async (req, session) => {
  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'Current password and new password are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return Response.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return Response.json({ error: 'New password must be different from current password' }, { status: 400 });
    }

    // Verify current password using pgcrypto crypt()
    const verifyResult = await queryWithTenant(tenantId,
      `SELECT id, name FROM users
       WHERE id = $1 AND password_hash = crypt($2, password_hash)`,
      [userId, currentPassword]
    );

    if (verifyResult.rows.length === 0) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 403 });
    }

    // Hash and update new password using pgcrypto
    const updateResult = await queryWithTenant(tenantId,
      `UPDATE users
       SET password_hash = crypt($1, gen_salt('bf', 10)),
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, name`,
      [newPassword, userId]
    );

    if (updateResult.rows.length === 0) {
      return Response.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    console.error('[VEMIO API] Password change error:', err.message);
    return Response.json({ error: 'Failed to change password' }, { status: 500 });
  }
});