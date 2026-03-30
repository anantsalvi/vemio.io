/**
 * VEMIO™ — NextAuth.js Configuration
 * 
 * Phase 7.1: SSO/SAML/OIDC support added alongside existing credentials provider.
 * 
 * Architecture:
 * - Credentials provider: unchanged, for tenants without SSO
 * - Azure AD provider: dynamically configured per-tenant
 * - Generic OIDC provider: for Google Workspace, Okta, etc.
 * - SAML handled via custom callback route (see /api/auth/saml/*)
 * 
 * SSO config stored in tenants.settings->'sso' JSONB:
 * {
 *   "sso": {
 *     "enabled": true,
 *     "provider": "azure-ad" | "google" | "okta" | "saml",
 *     "azure_tenant_id": "...",
 *     "azure_client_id": "...",
 *     "azure_client_secret": "...",
 *     "enforce_sso": false,         // if true, disable password login for this tenant
 *     "auto_provision": true,        // auto-create users on first SSO login
 *     "default_role": "viewer"       // role for auto-provisioned users
 *   }
 * }
 * 
 * JWT contains: userId, tenantId, tenantSlug, role, name, email, isMSP, authProvider
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import bcrypt from 'bcryptjs';
import { queryRaw } from '@/lib/db';

/**
 * Fetch SSO config for a tenant by slug.
 * Used during dynamic provider resolution.
 */
async function getTenantSSOConfig(tenantSlug) {
  const { rows } = await queryRaw(
    `SELECT id, name, slug, settings->'sso' AS sso_config, is_active
     FROM tenants 
     WHERE slug = $1 AND is_active = true
     LIMIT 1`,
    [tenantSlug]
  );
  if (rows.length === 0) return null;
  return { ...rows[0], sso: rows[0].sso_config || {} };
}

/**
 * Find or create a user from SSO profile data.
 * Handles auto-provisioning and existing user linking.
 */
async function findOrCreateSSOUser(profile, tenant, provider) {
  const email = profile.email?.toLowerCase().trim();
  if (!email) throw new Error('SSO profile missing email');

  const ssoConfig = tenant.sso || {};

  // Check for existing user by email in this tenant
  const { rows: existingUsers } = await queryRaw(
    `SELECT id, email, name, role, is_active, auth_provider, sso_subject_id
     FROM users 
     WHERE email = $1 AND tenant_id = $2
     LIMIT 1`,
    [email, tenant.id]
  );

  if (existingUsers.length > 0) {
    const user = existingUsers[0];

    if (!user.is_active) {
      throw new Error('Account is deactivated. Contact your administrator.');
    }

    // Link SSO identity if user exists but hasn't used SSO before
    if (!user.sso_subject_id && profile.sub) {
      await queryRaw(
        `UPDATE users 
         SET auth_provider = $1, sso_subject_id = $2, last_login_at = NOW()
         WHERE id = $3`,
        [provider, profile.sub, user.id]
      );
    } else {
      // Just update last login
      await queryRaw(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );
    }

    return user;
  }

  // Auto-provision new user if enabled
  if (!ssoConfig.auto_provision) {
    throw new Error('Account not found. Contact your administrator to be added to VEMIO.');
  }

  const defaultRole = ssoConfig.default_role || 'viewer';
  const userName = profile.name || profile.preferred_username || email.split('@')[0];

  const { rows: newUsers } = await queryRaw(
    `INSERT INTO users (tenant_id, email, name, role, auth_provider, sso_subject_id, is_active)
     VALUES ($1, $2, $3, $4::user_role, $5, $6, true)
     RETURNING id, email, name, role`,
    [tenant.id, email, userName, defaultRole, provider, profile.sub || null]
  );

  return newUsers[0];
}

export const authOptions = {
  providers: [
    // ── Credentials Provider (existing) ──
    CredentialsProvider({
      id: 'credentials',
      name: 'VEMIO Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const email = credentials.email.toLowerCase().trim();

        const { rows } = await queryRaw(
          `SELECT 
             u.id, u.email, u.password_hash, u.name, u.role, u.is_active,
             u.auth_provider,
             t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
             t.vemio_plan, t.is_active AS tenant_active,
             COALESCE(t.is_msp, false) AS is_msp,
             t.settings->'sso' AS sso_config
           FROM users u
           JOIN tenants t ON t.id = u.tenant_id
           WHERE u.email = $1
           LIMIT 1`,
          [email]
        );

        if (rows.length === 0) {
          throw new Error('Invalid email or password');
        }

        const user = rows[0];
        const ssoConfig = user.sso_config || {};

        // If tenant enforces SSO, block password login
        if (ssoConfig.enabled && ssoConfig.enforce_sso) {
          throw new Error('Your organization requires SSO login. Use the "Sign in with SSO" button.');
        }

        if (!user.is_active) {
          throw new Error('Account is deactivated. Contact your administrator.');
        }

        if (!user.tenant_active) {
          throw new Error('Organization account is suspended. Contact Vinay Enterprises.');
        }

        // SSO-only users won't have a password_hash
        if (!user.password_hash) {
          throw new Error('This account uses SSO. Use the "Sign in with SSO" button.');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Update last login (fire-and-forget)
        queryRaw('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
          .catch(err => console.error('[VEMIO Auth] Failed to update last_login:', err.message));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_name,
          tenantSlug: user.tenant_slug,
          vemioPlan: user.vemio_plan,
          isMSP: user.is_msp === true,
          authProvider: 'credentials',
        };
      },
    }),

    // ── Azure AD Provider ──
    // Configured with dummy values; actual tenant-specific values
    // are resolved in the signIn callback via the SSO initiation flow.
    ...(process.env.AZURE_AD_CLIENT_ID ? [
      AzureADProvider({
        id: 'azure-ad',
        clientId: process.env.AZURE_AD_CLIENT_ID,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
        tenantId: process.env.AZURE_AD_TENANT_ID,
        authorization: {
          params: {
            scope: 'openid email profile User.Read',
          },
        },
        profile(profile) {
          return {
            id: profile.sub,
            name: profile.name || profile.preferred_username,
            email: profile.email || profile.preferred_username,
            sub: profile.sub,
          };
        },
      })
    ] : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 hour
  },

  jwt: {
    maxAge: 60 * 60,
  },

  callbacks: {
    /**
     * Sign-in callback: resolve tenant and user for SSO logins.
     */
    async signIn({ user, account, profile }) {
      // Credentials provider already resolved everything in authorize()
      if (account?.provider === 'credentials') {
        return true;
      }

      // Azure AD / OIDC flow
      if (account?.provider === 'azure-ad') {
        try {
          // Look up which tenant this Azure AD tenant maps to
          const { rows } = await queryRaw(
            `SELECT id, name, slug, vemio_plan, 
                    COALESCE(is_msp, false) AS is_msp,
                    settings->'sso' AS sso_config
             FROM tenants 
             WHERE settings->'sso'->>'azure_tenant_id' = $1
               AND settings->'sso'->>'enabled' = 'true'
               AND is_active = true
             LIMIT 1`,
            [account.providerAccountId?.split('.')[0] || profile?.tid || '']
          );

          // Fallback: match by Azure tenant ID from the token
          let tenant;
          if (rows.length > 0) {
            tenant = { ...rows[0], sso: rows[0].sso_config || {} };
          } else {
            // Try matching via tid claim
            const tid = profile?.tid;
            if (tid) {
              const { rows: tidRows } = await queryRaw(
                `SELECT id, name, slug, vemio_plan,
                        COALESCE(is_msp, false) AS is_msp,
                        settings->'sso' AS sso_config
                 FROM tenants
                 WHERE settings->'sso'->>'azure_tenant_id' = $1
                   AND settings->'sso'->>'enabled' = 'true'
                   AND is_active = true
                 LIMIT 1`,
                [tid]
              );
              if (tidRows.length > 0) {
                tenant = { ...tidRows[0], sso: tidRows[0].sso_config || {} };
              }
            }
          }

          if (!tenant) {
            return '/login?error=sso_tenant_not_found';
          }

          // Find or create user
          const ssoUser = await findOrCreateSSOUser(
            { ...profile, sub: profile?.sub || account?.providerAccountId },
            tenant,
            'azure-ad'
          );

          // Attach tenant info to user object for JWT callback
          user.tenantId = tenant.id;
          user.tenantName = tenant.name;
          user.tenantSlug = tenant.slug;
          user.vemioPlan = tenant.vemio_plan;
          user.isMSP = tenant.is_msp;
          user.role = ssoUser.role;
          user.id = ssoUser.id;
          user.authProvider = 'azure-ad';

          return true;
        } catch (err) {
          console.error('[VEMIO SSO] Azure AD sign-in error:', err.message);
          return `/login?error=${encodeURIComponent(err.message)}`;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.tenantSlug = user.tenantSlug;
        token.vemioPlan = user.vemioPlan;
        token.isMSP = user.isMSP;
        token.authProvider = user.authProvider || 'credentials';
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.tenantName = token.tenantName;
      session.user.tenantSlug = token.tenantSlug;
      session.user.vemioPlan = token.vemioPlan;
      session.user.isMSP = token.isMSP;
      session.user.authProvider = token.authProvider;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };