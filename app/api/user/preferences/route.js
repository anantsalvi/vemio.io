/**
 * VEMIO™ — User Preferences API
 * GET  /api/user/preferences — Read current user's preferences
 * PATCH /api/user/preferences — Update preferences (partial merge)
 *
 * Preferences are stored as JSONB on the users table.
 * Current keys:
 *   deviceCategory: 'network' | 'all' (default: 'network')
 *   theme: 'dark' | 'light' | 'system' (future)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  try {
    const result = await queryWithTenant(tenantId,
      `SELECT preferences FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return Response.json({ preferences: {} });
    }

    return Response.json({ preferences: result.rows[0].preferences || {} });
  } catch (err) {
    console.error('[VEMIO API] Preferences read error:', err.message);
    return Response.json({ error: 'Failed to read preferences' }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req, session) => {
  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();

    // Validate known preference keys
    const allowed = ['deviceCategory', 'theme'];
    const updates = {};
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid preferences to update' }, { status: 400 });
    }

    // Validate values
    if (updates.deviceCategory && !['network', 'all'].includes(updates.deviceCategory)) {
      return Response.json({ error: 'deviceCategory must be "network" or "all"' }, { status: 400 });
    }
    if (updates.theme && !['dark', 'light', 'system'].includes(updates.theme)) {
      return Response.json({ error: 'theme must be "dark", "light", or "system"' }, { status: 400 });
    }

    // Merge into existing preferences
    const result = await queryWithTenant(tenantId,
      `UPDATE users
       SET preferences = preferences || $1::jsonb,
           updated_at = NOW()
       WHERE id = $2
       RETURNING preferences`,
      [JSON.stringify(updates), userId]
    );

    if (result.rows.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({ preferences: result.rows[0].preferences });
  } catch (err) {
    console.error('[VEMIO API] Preferences update error:', err.message);
    return Response.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
});