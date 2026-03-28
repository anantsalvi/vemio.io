/**
 * VEMIO™ — robots.txt
 * Blocks all crawlers from dashboard routes.
 * Only allows the login page and OG image to be accessible.
 */

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: [
          '/overview',
          '/intelligence',
          '/devices',
          '/topology',
          '/tickets',
          '/alerts',
          '/sites',
          '/rca',
          '/reports',
          '/settings',
          '/api/',
        ],
        allow: [
          '/login',
          '/api/og',
        ],
      },
    ],
    sitemap: 'https://vemio.vinayenterprises.co.in/sitemap.xml',
  };
}