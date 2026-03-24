/**
 * VEMIO™ — NextAuth.js Configuration
 * 
 * Credentials provider with tenant-scoped JWT.
 * JWT contains: userId, tenantId, tenantSlug, role, name, email
 * Every authenticated request carries tenant context.
 */

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryRaw } from '@/lib/db';

export const authOptions = {
  providers: [
    CredentialsProvider({
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

        // Fetch user with tenant info in a single query
        const { rows } = await queryRaw(
          `SELECT 
             u.id, u.email, u.password_hash, u.name, u.role, u.is_active,
             t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
             t.vemio_plan, t.is_active AS tenant_active
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

        // Check user is active
        if (!user.is_active) {
          throw new Error('Account is deactivated. Contact your administrator.');
        }

        // Check tenant is active
        if (!user.tenant_active) {
          throw new Error('Organization account is suspended. Contact Vinay Enterprises.');
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.password_hash);
        if (!isValid) {
          throw new Error('Invalid email or password');
        }

        // Update last login timestamp (fire-and-forget)
        queryRaw('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
          .catch(err => console.error('[VEMIO Auth] Failed to update last_login:', err.message));

        // Return user object — this becomes the JWT payload
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id,
          tenantName: user.tenant_name,
          tenantSlug: user.tenant_slug,
          vemioPlan: user.vemio_plan,
        };
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 60 * 60,        // 1 hour
  },

  jwt: {
    maxAge: 60 * 60,         // 1 hour
  },

  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in, inject tenant data into the JWT
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.tenantName = user.tenantName;
        token.tenantSlug = user.tenantSlug;
        token.vemioPlan = user.vemioPlan;
      }
      return token;
    },

    async session({ session, token }) {
      // Expose tenant data on the session object
      session.user.id = token.userId;
      session.user.role = token.role;
      session.user.tenantId = token.tenantId;
      session.user.tenantName = token.tenantName;
      session.user.tenantSlug = token.tenantSlug;
      session.user.vemioPlan = token.vemioPlan;
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
