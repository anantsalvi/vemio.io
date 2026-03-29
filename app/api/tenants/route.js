/**
 * VEMIO™ — Tenants API
 * GET /api/tenants
 * 
 * Returns the list of tenants accessible to the current user.
 * - MSP users: get all managed tenants + "all" option
 * - Client users: get only their own tenant (no switcher needed)
 * 
 * Response shape:
 *   {
 *     isMSP: boolean,
 *     currentTenantId: string,
 *     tenants: [{ id, name, slug }],
 *   }
 */

import { withAuth } from '@/lib/auth';
import { getManagedTenants } from '@/lib/tenant';
import { queryRaw } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const isMSP = session.user.isMSP === true;
  const userTenantId = session.user.tenantId;

  if (!isMSP) {
    // Client user — return their own tenant only
    return Response.json({
      isMSP: false,
      currentTenantId: userTenantId,
      tenants: [{
        id: userTenantId,
        name: session.user.tenantName,
        slug: session.user.tenantSlug,
      }],
    });
  }

  // MSP user — return all managed tenants
  const managed = await getManagedTenants(userTenantId);

  return Response.json({
    isMSP: true,
    currentTenantId: userTenantId,
    tenants: managed,
  });
});
