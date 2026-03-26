/**
 * VEMIO™ — Branding API
 * GET /api/branding — returns tenant branding from settings JSONB
 * No auth bypass — uses session tenant context
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const DEFAULTS = {
  logo_url: null,
  company_name: null,
  tagline: 'Network Intelligence',
  primary_color: '#F59E0B',
  accent_color: '#14B8A6',
  show_powered_by: true,
  powered_by_text: 'Powered by Vinay Enterprises',
};

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;

  try {
    const result = await queryWithTenant(tenantId, `
      SELECT name, slug, settings->'branding' AS branding
      FROM tenants WHERE id = $1
    `, [tenantId]);

    const tenant = result.rows[0];
    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const stored = tenant.branding || {};
    const branding = {
      ...DEFAULTS,
      ...stored,
      // Always include tenant name as fallback for company_name
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
    };

    // If no custom company_name, use the tenant name
    if (!branding.company_name) {
      branding.company_name = tenant.name;
    }

    return Response.json({ branding });

  } catch (err) {
    console.error('Branding GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});