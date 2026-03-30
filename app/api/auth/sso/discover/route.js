/**
 * VEMIO™ — SSO Discovery API
 * Phase 7.1: Login page calls this to check if SSO is available for an email domain.
 * 
 * POST /api/auth/sso/discover
 * Body: { "email": "user@company.com" }
 * Returns: { "sso_available": true, "provider": "azure-ad", "tenant_slug": "aia", "enforce_sso": false }
 * 
 * This is an unauthenticated endpoint — only returns minimal info.
 */

import { queryRaw } from '@/lib/db';

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return Response.json({ sso_available: false });
    }

    const domain = email.toLowerCase().trim().split('@')[1];

    // Find tenants that have SSO enabled and match this email domain
    // Check against allowed_domains in SSO config, or primary_contact_email domain
    const { rows } = await queryRaw(
      `SELECT 
         t.slug,
         t.settings->'sso'->>'provider' AS provider,
         COALESCE((t.settings->'sso'->>'enforce_sso')::boolean, false) AS enforce_sso,
         t.name AS tenant_name
       FROM tenants t
       WHERE t.is_active = true
         AND (t.settings->'sso'->>'enabled')::boolean = true
         AND (
           -- Check allowed_domains array
           t.settings->'sso'->'allowed_domains' ? $1
           -- Or check if any user in this tenant has this email domain
           OR EXISTS (
             SELECT 1 FROM users u 
             WHERE u.tenant_id = t.id 
               AND u.email LIKE '%@' || $1
               AND u.is_active = true
           )
         )
       LIMIT 1`,
      [domain]
    );

    if (rows.length === 0) {
      return Response.json({ sso_available: false });
    }

    const tenant = rows[0];
    return Response.json({
      sso_available: true,
      provider: tenant.provider,
      tenant_slug: tenant.slug,
      tenant_name: tenant.tenant_name,
      enforce_sso: tenant.enforce_sso,
    });
  } catch (err) {
    console.error('[VEMIO SSO] Discovery error:', err.message);
    return Response.json({ sso_available: false });
  }
}