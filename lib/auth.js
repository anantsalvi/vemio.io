/**
 * VEMIO™ — Auth Helpers
 * 
 * Centralized session access for server components and API routes.
 * 
 * Usage:
 *   import { getSession, requireAuth, requireAdmin } from '@/lib/auth';
 *   
 *   // In API route:
 *   const session = await requireAuth();
 *   const devices = await queryWithTenant(session.user.tenantId, '...');
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

/**
 * Get the current session (may be null).
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Require authentication. Throws if not logged in.
 * Use in API routes.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.tenantId) {
    throw new AuthError('Unauthorized', 401);
  }
  return session;
}

/**
 * Require admin role. Throws if not admin.
 */
export async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== 'admin') {
    throw new AuthError('Forbidden — admin access required', 403);
  }
  return session;
}

/**
 * Custom error class for auth failures.
 */
export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

/**
 * Wrap an API handler with auth + error handling.
 * 
 * Usage:
 *   export const GET = withAuth(async (req, session) => {
 *     const data = await queryWithTenant(session.user.tenantId, '...');
 *     return Response.json(data.rows);
 *   });
 */
export function withAuth(handler) {
  return async function (req, context) {
    try {
      const session = await requireAuth();
      return await handler(req, session, context);
    } catch (err) {
      if (err instanceof AuthError) {
        return Response.json(
          { error: err.message },
          { status: err.status }
        );
      }
      console.error('[VEMIO API] Unhandled error:', err);
      return Response.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
