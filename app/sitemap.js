/**
 * VEMIO™ — Sitemap
 * Only includes public pages (login).
 * Dashboard pages are behind auth and excluded.
 */

export default function sitemap() {
  return [
    {
      url: 'https://vemio.vinayenterprises.co.in/login',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}