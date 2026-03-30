/**
 * VEMIO™ — SSO Settings API
 * Phase 7.1: Per-tenant SSO configuration management.
 * 
 * GET  /api/settings/sso — Fetch current SSO config
 * PATCH /api/settings/sso — Update SSO config (admin only)
 * POST /api/settings/sso/test — Test SSO connection
 * 
 * SSO config lives in tenants.settings->'sso' JSONB.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant, queryRaw } from '@/lib/db';

// Fields that are safe to return to the frontend (no secrets)
const SAFE_SSO_FIELDS = [
  'enabled', 'provider', 'azure_tenant_id', 'azure_client_id',
  'enforce_sso', 'auto_provision', 'default_role',
  'allowed_domains', 'configured_at', 'configured_by',
];

function sanitizeSSOConfig(sso) {
  if (!sso) return { enabled: false };
  const safe = {};
  for (const key of SAFE_SSO_FIELDS) {
    if (sso[key] !== undefined) safe[key] = sso[key];
  }
  // Mask client secret — just indicate if it's set
  safe.has_client_secret = !!sso.azure_client_secret;
  return safe;
}

// ── GET: Fetch SSO config ──
export const GET = withAuth(async (req, session) => {
  const { rows } = await queryWithTenant(
    session.user.tenantId,
    `SELECT settings->'sso' AS sso_config FROM tenants WHERE id = $1`,
    [session.user.tenantId]
  );

  const sso = rows[0]?.sso_config || {};

  // Non-admins get minimal info (just whether SSO is enabled)
  if (session.user.role !== 'admin') {
    return Response.json({
      enabled: !!sso.enabled,
      provider: sso.provider || null,
      enforce_sso: !!sso.enforce_sso,
    });
  }

  return Response.json(sanitizeSSOConfig(sso));
});

// ── PATCH: Update SSO config ──
export const PATCH = withAuth(async (req, session) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();

  // Validate provider
  const validProviders = ['azure-ad', 'google', 'okta', 'saml', 'oidc'];
  if (body.provider && !validProviders.includes(body.provider)) {
    return Response.json(
      { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate default_role
  const validRoles = ['admin', 'viewer'];
  if (body.default_role && !validRoles.includes(body.default_role)) {
    return Response.json(
      { error: `Invalid default_role. Must be one of: ${validRoles.join(', ')}` },
      { status: 400 }
    );
  }

  // Fetch current config
  const { rows } = await queryRaw(
    `SELECT settings->'sso' AS sso_config FROM tenants WHERE id = $1`,
    [session.user.tenantId]
  );

  const currentSSO = rows[0]?.sso_config || {};

  // Build updated config — merge with existing
  const updatedSSO = { ...currentSSO };

  // Whitelist of updatable fields
  const allowedFields = [
    'enabled', 'provider', 'azure_tenant_id', 'azure_client_id',
    'azure_client_secret', 'enforce_sso', 'auto_provision',
    'default_role', 'allowed_domains',
  ];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updatedSSO[field] = body[field];
    }
  }

  // If disabling SSO, also disable enforce_sso
  if (body.enabled === false) {
    updatedSSO.enforce_sso = false;
  }

  // Don't allow enforce_sso without a configured provider
  if (updatedSSO.enforce_sso && !updatedSSO.provider) {
    return Response.json(
      { error: 'Cannot enforce SSO without a configured provider' },
      { status: 400 }
    );
  }

  // Azure AD validation
  if (updatedSSO.provider === 'azure-ad' && updatedSSO.enabled) {
    if (!updatedSSO.azure_tenant_id || !updatedSSO.azure_client_id) {
      return Response.json(
        { error: 'Azure AD requires Tenant ID and Client ID' },
        { status: 400 }
      );
    }
    // Client secret required on first setup, optional on update (keep existing)
    if (!updatedSSO.azure_client_secret && !currentSSO.azure_client_secret) {
      return Response.json(
        { error: 'Azure AD requires a Client Secret' },
        { status: 400 }
      );
    }
    // If client secret not provided in update, keep existing
    if (!body.azure_client_secret && currentSSO.azure_client_secret) {
      updatedSSO.azure_client_secret = currentSSO.azure_client_secret;
    }
  }

  // Metadata
  updatedSSO.configured_at = new Date().toISOString();
  updatedSSO.configured_by = session.user.email;

  // Save — use jsonb_set to preserve other settings
  await queryRaw(
    `UPDATE tenants 
     SET settings = jsonb_set(COALESCE(settings, '{}'), '{sso}', $1::jsonb)
     WHERE id = $2`,
    [JSON.stringify(updatedSSO), session.user.tenantId]
  );

  // Audit log
  try {
    await queryRaw(
      `INSERT INTO audit_log (tenant_id, user_id, action, resource_type, details)
       VALUES ($1, $2, 'sso_config_updated', 'tenant', $3::jsonb)`,
      [
        session.user.tenantId,
        session.user.id,
        JSON.stringify({
          provider: updatedSSO.provider,
          enabled: updatedSSO.enabled,
          enforce_sso: updatedSSO.enforce_sso,
          auto_provision: updatedSSO.auto_provision,
        }),
      ]
    );
  } catch (err) {
    // Don't fail the request if audit log fails
    console.error('[VEMIO SSO] Audit log error:', err.message);
  }

  return Response.json({
    success: true,
    sso: sanitizeSSOConfig(updatedSSO),
  });
});