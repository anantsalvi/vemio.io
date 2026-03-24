import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

// Protect all dashboard routes, but allow webhooks and health checks
export const config = {
  matcher: [
    '/overview/:path*',
    '/devices/:path*',
    '/tickets/:path*',
    '/sites/:path*',
    '/rca/:path*',
    '/reports/:path*',
    '/settings/:path*',
  ],
};
