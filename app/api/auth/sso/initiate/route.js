/**
 * VEMIO™ — SSO Initiate
 * GET /api/auth/sso/initiate?email=user@company.com
 * 
 * Dynamically builds the Azure AD authorization URL using
 * tenant-specific credentials from the database.
 * Redirects the user to Microsoft's login page.
 */

import { queryRaw } from '@/lib/db';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(req) {
  const url = new URL(req.url);
  const email = url.searchParams.get('email')?.toLowerCase().trim();

  if (!email || !email.includes('@')) {
    return NextResponse.redirect(new URL('/login?error=invalid_email', req.url));
  }

  const domain = email.split('@')[1];

  try {
    // Find tenant with SSO enabled for this domain
    const { rows } = await queryRaw(
      `SELECT id, slug, settings->'sso' AS sso_config
       FROM tenants
       WHERE is_active = true
         AND (settings->'sso'->>'enabled')::boolean = true
         AND (
           settings->'sso'->'allowed_domains' ? $1
           OR EXISTS (
             SELECT 1 FROM users u 
             WHERE u.tenant_id = tenants.id 
               AND u.email LIKE '%@' || $1
               AND u.is_active = true
           )
         )
       LIMIT 1`,
      [domain]
    );

    if (rows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=sso_tenant_not_found', req.url));
    }

    const tenant = rows[0];
    const sso = tenant.sso_config || {};

    if (sso.provider !== 'azure-ad') {
      return NextResponse.redirect(new URL('/login?error=unsupported_provider', req.url));
    }

    if (!sso.azure_tenant_id || !sso.azure_client_id) {
      return NextResponse.redirect(new URL('/login?error=sso_not_configured', req.url));
    }

    // Generate state parameter (CSRF protection)
    const state = crypto.randomBytes(32).toString('hex');
    
    // Store state + tenant info in a short-lived cookie
    const stateData = JSON.stringify({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      email,
      ts: Date.now(),
    });
    const stateEncoded = Buffer.from(stateData).toString('base64url');

    // Build Azure AD authorization URL
    const baseUrl = req.headers.get('x-forwarded-proto') === 'https' 
      ? `https://${req.headers.get('host')}` 
      : url.origin;

    const redirectUri = `${baseUrl}/api/auth/sso/callback`;

    const authUrl = new URL(`https://login.microsoftonline.com/${sso.azure_tenant_id}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set('client_id', sso.azure_client_id);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid email profile User.Read');
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('state', `${state}.${stateEncoded}`);
    authUrl.searchParams.set('login_hint', email);

    // Set state cookie for CSRF validation
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set('vemio_sso_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[VEMIO SSO] Initiate error:', err.message);
    return NextResponse.redirect(new URL('/login?error=sso_error', req.url));
  }
}