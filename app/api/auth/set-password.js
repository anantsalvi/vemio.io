/**
 * VEMIO™ — Set Password API
 * POST /api/auth/set-password
 *
 * Validates an invite token and sets the user's password.
 * Token is one-time use and expires after 48 hours.
 *
 * GET ?token=xxx  — check if token is valid
 * POST { token, password } — set password
 */

import { queryAsAdmin } from '@/lib/admin-db';

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.json({ error: 'Token required' }, { status: 400 });
  }

  try {
    const result = await queryAsAdmin(
      `SELECT u.id, u.name, u.email, t.name AS tenant_name
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.invite_token = $1
         AND u.invite_expires > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return Response.json({ valid: false, error: 'Invalid or expired invite link' });
    }

    const user = result.rows[0];
    return Response.json({
      valid: true,
      name: user.name,
      email: user.email,
      tenantName: user.tenant_name,
    });
  } catch (err) {
    console.error('[VEMIO SetPassword] Token check error:', err.message);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req) {
  const body = await req.json();
  const { token, password } = body;

  if (!token || !password) {
    return Response.json({ error: 'Token and password required' }, { status: 400 });
  }

  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  try {
    // Find user by valid token
    const result = await queryAsAdmin(
      `SELECT id, email, name FROM users
       WHERE invite_token = $1
         AND invite_expires > NOW()`,
      [token]
    );

    if (!result.rows.length) {
      return Response.json({
        error: 'Invalid or expired invite link. Please request a new invite from your administrator.',
      }, { status: 400 });
    }

    const user = result.rows[0];

    // Hash password with bcrypt
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user: set password, clear token, mark password_set_at
    await queryAsAdmin(
      `UPDATE users
       SET password = $1,
           invite_token = NULL,
           invite_expires = NULL,
           password_set_at = NOW(),
           is_active = true
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    console.log(`[VEMIO SetPassword] Password set for ${user.email}`);

    return Response.json({
      success: true,
      message: 'Password set successfully. You can now sign in.',
      email: user.email,
    });
  } catch (err) {
    console.error('[VEMIO SetPassword] Error:', err.message);
    return Response.json({ error: 'Failed to set password' }, { status: 500 });
  }
}