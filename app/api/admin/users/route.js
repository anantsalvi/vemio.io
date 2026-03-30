/**
 * VEMIO™ — MSP Admin: Users API
 * 
 * GET  /api/admin/users?tenant_id=...&role=...&search=...
 * POST /api/admin/users — Create a new user
 */

import { withMSPAuth } from '@/lib/admin-auth';
import { queryRaw } from '@/lib/db';

export const GET = withMSPAuth(async (req, session) => {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  const role = url.searchParams.get('role');
  const search = url.searchParams.get('search');

  const conditions = [];
  const params = [];
  let idx = 1;

  if (tenantId) {
    conditions.push(`u.tenant_id = $${idx++}`);
    params.push(tenantId);
  }

  if (role) {
    conditions.push(`u.role = $${idx++}::user_role`);
    params.push(role);
  }

  if (search) {
    conditions.push(`(u.email ILIKE $${idx} OR u.name ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const { rows } = await queryRaw(
    `SELECT u.id, u.email, u.name, u.role, u.is_active, u.auth_provider,
            u.last_login_at, u.created_at,
            t.name AS tenant_name, t.slug AS tenant_slug, t.id AS tenant_id
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     ${where}
     ORDER BY t.name, u.name
     LIMIT 500`,
    params
  );

  return Response.json({ users: rows });
});

export const POST = withMSPAuth(async (req, session) => {
  const body = await req.json();
  const { tenant_id, email, name, role, password } = body;

  if (!tenant_id || !email || !name || !password) {
    return Response.json({ error: 'tenant_id, email, name, and password are required' }, { status: 400 });
  }

  const validRoles = ['admin', 'viewer', 'site_manager', 'security_officer', 'executive'];
  const userRole = validRoles.includes(role) ? role : 'viewer';

  // Check for duplicate email
  const { rows: existing } = await queryRaw(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  if (existing.length > 0) {
    return Response.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  // Verify tenant exists
  const { rows: tenants } = await queryRaw(
    'SELECT id, name FROM tenants WHERE id = $1',
    [tenant_id]
  );

  if (tenants.length === 0) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Hash password using pgcrypto
  const { rows: hashRows } = await queryRaw(
    "SELECT crypt($1, gen_salt('bf', 12)) AS hash",
    [password]
  );

  const { rows: newUser } = await queryRaw(
    `INSERT INTO users (tenant_id, email, name, role, password_hash, is_active)
     VALUES ($1, $2, $3, $4::user_role, $5, true)
     RETURNING id, email, name, role, is_active, created_at`,
    [tenant_id, email.toLowerCase().trim(), name, userRole, hashRows[0].hash]
  );

  return Response.json({ user: newUser[0], tenant: tenants[0].name }, { status: 201 });
});