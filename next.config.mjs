/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel deployment optimizations
  poweredByHeader: false,
  
  // Strict mode for catching bugs early
  reactStrictMode: true,
  
  // Image domains (for future tenant logos, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.vinayenterprises.co.in',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Webhook endpoint needs permissive CORS for Auvik
        source: '/api/webhooks/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Auvik-Signature' },
        ],
      },
    ];
  },
};

export default nextConfig;
