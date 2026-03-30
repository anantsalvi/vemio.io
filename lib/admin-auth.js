/**
 * VEMIO™ — MSP Admin Auth Guard
 * Phase 7: Centralized auth check for all /api/admin/* routes.
 * 
 * Usage:
 *   import { withMSPAuth } from '@/lib/admin-auth';
 *   export const GET = withMSPAuth(async (req, session) => { ... });
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export function withMSPAuth(handler) {
  return async function (req, context) {
    try {
      const session = await getServerSession(authOptions);

      if (!session?.user?.tenantId) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!session.user.isMSP) {
        return Response.json({ error: 'MSP access required' }, { status: 403 });
      }

      return await handler(req, session, context);
    } catch (err) {
      console.error('[VEMIO Admin API] Error:', err);
      return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
  };
}