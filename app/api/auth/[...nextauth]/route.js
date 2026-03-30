/**
 * VEMIO™ — NextAuth.js Configuration
 * 
 * Phase 7.1: SSO is handled by custom OAuth flow (/api/auth/sso/initiate + callback).
 * NextAuth only handles credentials login and session management.
 * 
 * The custom SSO callback creates a NextAuth JWT directly, so sessions
 * work identically for both credentials and SSO users.
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryRaw } from '@/lib/db';

export const authOptions = {
  providers: [
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
  ],

  session: {
    strategy: 'jwt',
    maxAge: 60 * 60, // 1 hour
  },

  jwt: {
    maxAge: 60 * 60,
  },

  callbacks: {
    async jwt({ token, user }) {
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