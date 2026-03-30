/**
 * VEMIO™ — MSP Admin: Tenants API
 * 
 * GET  /api/admin/tenants — List all tenants with stats
 * POST /api/admin/tenants — Create a new tenant
 */

import { withMSPAuth } from '@/lib/admin-auth';
import { queryRaw } from '@/lib/db';

export const GET = withMSPAuth(async (req, session) => {
  const { rows } = await queryRaw(
    `SELECT 
       t.id, t.name, t.slug, t.vemio_plan, t.is_active, t.is_msp,
       t.sla_uptime_target, t.contract_start_date,
       t.primary_contact_name, t.primary_contact_email, t.primary_contact_phone,
       t.created_at, t.updated_at,
       t.settings->'branding' AS branding,
       t.settings->'sso' AS sso_config,
       (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.is_active = true) AS user_count,
       (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.is_monitored = true) AS device_count,
       (SELECT COUNT(*) FROM alerts a WHERE a.tenant_id = t.id AND a.state = 'active') AS active_alerts,
       (SELECT COUNT(*) FROM sites s WHERE s.tenant_id = t.id) AS site_count
     FROM tenants t
     WHERE t.is_msp = false
     ORDER BY t.name`
  );

  // Sanitize SSO config (don't expose secrets)
  const tenants = rows.map(t => ({
    ...t,
    sso_config: t.sso_config ? {
      enabled: t.sso_config.enabled,
      provider: t.sso_config.provider,
      enforce_sso: t.sso_config.enforce_sso,
    } : null,
  }));

  return Response.json({ tenants });
});

export const POST = withMSPAuth(async (req, session) => {
  const body = await req.json();
  const { name, slug, vemio_plan, sla_uptime_target, primary_contact_name, primary_contact_email, primary_contact_phone } = body;

  if (!name || !slug) {
    return Response.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // Check for duplicate slug
  const { rows: existing } = await queryRaw(
    'SELECT id FROM tenants WHERE slug = $1',
    [slug.toLowerCase().trim()]
  );

  if (existing.length > 0) {
    return Response.json({ error: 'A tenant with this slug already exists' }, { status: 409 });
  }

  const validPlans = ['essentials', 'professional', 'command'];
  const plan = validPlans.includes(vemio_plan) ? vemio_plan : 'essentials';

  const { rows } = await queryRaw(
    `INSERT INTO tenants (name, slug, vemio_plan, sla_uptime_target, primary_contact_name, primary_contact_email, primary_contact_phone, is_active)
     VALUES ($1, $2, $3::vemio_plan, $4, $5, $6, $7, true)
     RETURNING id, name, slug, vemio_plan, sla_uptime_target, is_active, created_at`,
    [
      name,
      slug.toLowerCase().trim(),
      plan,
      sla_uptime_target || 99.50,
      primary_contact_name || null,
      primary_contact_email || null,
      primary_contact_phone || null,
    ]
  );

  return Response.json({ tenant: rows[0] }, { status: 201 });
});