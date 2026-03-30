/**
 * VEMIO™ — SSO Callback
 * GET /api/auth/sso/callback?code=...&state=...
 * 
 * Handles the OAuth callback from Azure AD.
 * Exchanges auth code for tokens using tenant-specific credentials.
 * Creates/links the VEMIO user and establishes a session.
 */

import { queryRaw } from '@/lib/db';
import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const errorDesc = url.searchParams.get('error_description');

  // Handle Azure AD errors
  if (errorParam) {
    console.error('[VEMIO SSO] Azure AD error:', errorParam, errorDesc);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDesc || errorParam)}`, req.url));
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  try {
    // Parse state
    const [state, stateEncoded] = stateParam.split('.');
    if (!state || !stateEncoded) {
      return NextResponse.redirect(new URL('/login?error=invalid_state', req.url));
    }

    // Validate CSRF state cookie
    const stateCookie = req.cookies.get('vemio_sso_state')?.value;
    if (!stateCookie || stateCookie !== state) {
      return NextResponse.redirect(new URL('/login?error=state_mismatch', req.url));
    }

    // Decode tenant info from state
    const stateData = JSON.parse(Buffer.from(stateEncoded, 'base64url').toString());
    const { tenantId, email } = stateData;

    // Check timestamp (10 min max)
    if (Date.now() - stateData.ts > 10 * 60 * 1000) {
      return NextResponse.redirect(new URL('/login?error=sso_expired', req.url));
    }

    // Fetch tenant SSO config
    const { rows: tenantRows } = await queryRaw(
      `SELECT id, name, slug, vemio_plan, 
              COALESCE(is_msp, false) AS is_msp,
              settings->'sso' AS sso_config
       FROM tenants WHERE id = $1 AND is_active = true`,
      [tenantId]
    );

    if (tenantRows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=tenant_not_found', req.url));
    }

    const tenant = tenantRows[0];
    const sso = tenant.sso_config || {};

    // Build redirect URI (must match what was sent in initiate)
    const baseUrl = req.headers.get('x-forwarded-proto') === 'https'
      ? `https://${req.headers.get('host')}`
      : url.origin;
    const redirectUri = `${baseUrl}/api/auth/sso/callback`;

    // Exchange code for token
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${sso.azure_tenant_id}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: sso.azure_client_id,
          client_secret: sso.azure_client_secret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'openid email profile User.Read',
        }),
      }
    );

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      console.error('[VEMIO SSO] Token exchange failed:', tokenErr);
      return NextResponse.redirect(new URL('/login?error=token_exchange_failed', req.url));
    }

    const tokenData = await tokenRes.json();

    // Get user profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileRes.ok) {
      console.error('[VEMIO SSO] Profile fetch failed');
      return NextResponse.redirect(new URL('/login?error=profile_fetch_failed', req.url));
    }

    const profile = await profileRes.json();
    const userEmail = (profile.mail || profile.userPrincipalName || email).toLowerCase().trim();
    const userName = profile.displayName || profile.givenName || userEmail.split('@')[0];

    // Find or create user
    const { rows: existingUsers } = await queryRaw(
      `SELECT id, email, name, role, is_active, auth_provider, sso_subject_id
       FROM users WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
      [userEmail, tenantId]
    );

    let user;

    if (existingUsers.length > 0) {
      user = existingUsers[0];

      if (!user.is_active) {
        return NextResponse.redirect(new URL('/login?error=account_deactivated', req.url));
      }

      // Link SSO identity if not already linked
      if (!user.sso_subject_id) {
        await queryRaw(
          `UPDATE users SET auth_provider = 'azure-ad', sso_subject_id = $1, last_login_at = NOW() WHERE id = $2`,
          [profile.id, user.id]
        );
      } else {
        await queryRaw('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
      }
    } else {
      // Auto-provision if enabled
      if (!sso.auto_provision) {
        return NextResponse.redirect(new URL('/login?error=account_not_found', req.url));
      }

      const defaultRole = sso.default_role || 'viewer';
      const { rows: newUsers } = await queryRaw(
        `INSERT INTO users (tenant_id, email, name, role, auth_provider, sso_subject_id, is_active)
         VALUES ($1, $2, $3, $4::user_role, 'azure-ad', $5, true)
         RETURNING id, email, name, role`,
        [tenantId, userEmail, userName, defaultRole, profile.id]
      );
      user = newUsers[0];
    }

    // Create NextAuth JWT directly
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[VEMIO SSO] NEXTAUTH_SECRET not set');
      return NextResponse.redirect(new URL('/login?error=server_config_error', req.url));
    }

    const token = await encode({
      token: {
        userId: user.id,
        email: user.email,
        name: user.name || userName,
        role: user.role,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        vemioPlan: tenant.vemio_plan,
        isMSP: tenant.is_msp === true,
        authProvider: 'azure-ad',
      },
      secret,
      maxAge: 60 * 60, // 1 hour, matches your session config
    });

    // Set the session cookie and redirect to dashboard
    const response = NextResponse.redirect(new URL('/auth/sso-complete', req.url));

    // Set NextAuth session cookie
    const cookieName = process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });

    // Clear the state cookie
    response.cookies.delete('vemio_sso_state');

    // Audit log
    try {
      await queryRaw(
        `INSERT INTO audit_log (tenant_id, user_id, action, details)
         VALUES ($1, $2, 'login_sso', $3::jsonb)`,
        [tenantId, user.id, JSON.stringify({ provider: 'azure-ad', email: userEmail })]
      );
    } catch {}

    return response;
  } catch (err) {
    console.error('[VEMIO SSO] Callback error:', err);
    return NextResponse.redirect(new URL('/login?error=sso_callback_error', req.url));
  }
}