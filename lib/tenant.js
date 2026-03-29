/**
 * VEMIO™ — MSP Tenant Helpers
 * 
 * Server-side utilities for cross-tenant MSP operations.
 * 
 * SECURITY MODEL:
 *   - MSP users are identified by `is_msp` flag on their tenant
 *   - `isMSP` is embedded in the JWT at login time
 *   - Cross-tenant queries are ONLY allowed for MSP users
 *   - Target tenants are validated against `msp_tenant_access` table
 *   - Client users can NEVER see another tenant's data
 * 
 * Usage:
 *   import { getManagedTenants, resolveTargetTenant, queryForTenant } from '@/lib/tenant';
 */

import { queryWithTenant, queryRaw } from '@/lib/db';

/**
 * Get list of tenants an MSP user can access.
 * Returns the MSP's own managed tenants from msp_tenant_access.
 * 
 * @param {string} mspTenantId - The MSP tenant's UUID
 * @returns {Promise<Array<{id: string, name: string, slug: string}>>}
 */
export async function getManagedTenants(mspTenantId) {
  const result = await queryWithTenant(mspTenantId,
    `SELECT t.id, t.name, t.slug
     FROM msp_tenant_access mta
     JOIN tenants t ON t.id = mta.managed_tenant_id
     WHERE mta.msp_tenant_id = $1 AND t.is_active = true
     ORDER BY t.name`,
    [mspTenantId]
  );
  return result.rows;
}

/**
 * Resolve which tenant(s) to query based on request context.
 * 
 * Returns an object with:
 *   - mode: 'single' | 'all'
 *   - tenantId: UUID (for single mode)
 *   - tenantIds: UUID[] (for all mode)
 *   - error: string | null (if access denied)
 * 
 * SECURITY: Client users ALWAYS get their own tenant. MSP users
 * can specify a target via ?tenantId= query param.
 * 
 * @param {object} session - NextAuth session
 * @param {Request} req - Incoming request (to read ?tenantId=)
 * @returns {Promise<{mode: string, tenantId?: string, tenantIds?: string[], error?: string}>}
 */
export async function resolveTargetTenant(session, req) {
  const isMSP = session.user.isMSP === true;
  const userTenantId = session.user.tenantId;

  if (!isMSP) {
    // Client user — always scoped to their own tenant, no exceptions
    return { mode: 'single', tenantId: userTenantId };
  }

  // MSP user — check for tenant selection
  const url = new URL(req.url);
  const requestedTenantId = url.searchParams.get('tenantId');

  if (!requestedTenantId || requestedTenantId === 'all') {
    // "All Tenants" mode — get all managed tenant IDs
    const managed = await getManagedTenants(userTenantId);
    if (managed.length === 0) {
      return { mode: 'single', tenantId: userTenantId };
    }
    return {
      mode: 'all',
      tenantIds: managed.map(t => t.id),
    };
  }

  // Specific tenant requested — validate access
  const accessCheck = await queryWithTenant(userTenantId,
    `SELECT 1 FROM msp_tenant_access
     WHERE msp_tenant_id = $1 AND managed_tenant_id = $2`,
    [userTenantId, requestedTenantId]
  );

  if (accessCheck.rows.length === 0) {
    return { error: 'Access denied — you do not manage this tenant' };
  }

  return { mode: 'single', tenantId: requestedTenantId };
}

/**
 * Execute a query scoped to one or more tenants based on resolved target.
 * 
 * For 'single' mode: uses standard queryWithTenant (RLS).
 * For 'all' mode: runs query once per tenant and merges results.
 *   (This keeps RLS intact per-tenant — no bypass needed.)
 * 
 * @param {object} target - Output from resolveTargetTenant()
 * @param {string} sql - SQL query text
 * @param {Array} params - Query params
 * @param {object} options - { addTenantInfo: boolean }
 * @returns {Promise<{rows: Array}>}
 */
export async function queryForTenant(target, sql, params = [], options = {}) {
  if (target.mode === 'single') {
    const result = await queryWithTenant(target.tenantId, sql, params);
    if (options.addTenantInfo) {
      // Fetch tenant name for labeling
      const tenantResult = await queryRaw(
        'SELECT name, slug FROM tenants WHERE id = $1', [target.tenantId]
      );
      const tenantInfo = tenantResult.rows[0] || {};
      result.rows = result.rows.map(row => ({
        ...row,
        _tenant_name: tenantInfo.name,
        _tenant_slug: tenantInfo.slug,
        _tenant_id: target.tenantId,
      }));
    }
    return result;
  }

  // All-tenants mode: query each managed tenant and merge
  const allRows = [];
  const tenantNames = {};

  // Pre-fetch tenant names
  if (options.addTenantInfo && target.tenantIds.length > 0) {
    const placeholders = target.tenantIds.map((_, i) => `$${i + 1}`).join(',');
    const namesResult = await queryRaw(
      `SELECT id, name, slug FROM tenants WHERE id IN (${placeholders})`,
      target.tenantIds
    );
    for (const row of namesResult.rows) {
      tenantNames[row.id] = { name: row.name, slug: row.slug };
    }
  }

  // Execute per-tenant and merge
  for (const tid of target.tenantIds) {
    try {
      const result = await queryWithTenant(tid, sql, params);
      const info = tenantNames[tid] || {};
      for (const row of result.rows) {
        if (options.addTenantInfo) {
          row._tenant_name = info.name;
          row._tenant_slug = info.slug;
          row._tenant_id = tid;
        }
        allRows.push(row);
      }
    } catch (err) {
      console.error(`[VEMIO MSP] Query failed for tenant ${tid}:`, err.message);
      // Continue with other tenants — don't fail the whole request
    }
  }

  return { rows: allRows };
}

/**
 * Execute an aggregate query across tenants.
 * For 'all' mode, runs per-tenant and sums numeric fields.
 * 
 * @param {object} target - Output from resolveTargetTenant()
 * @param {string} sql - SQL query that returns a single row of aggregates
 * @param {Array} params - Query params
 * @returns {Promise<object>} - Merged aggregate row
 */
export async function queryAggregateForTenant(target, sql, params = []) {
  if (target.mode === 'single') {
    const result = await queryWithTenant(target.tenantId, sql, params);
    return result.rows[0] || {};
  }

  // All-tenants mode: sum aggregates across tenants
  const merged = {};

  for (const tid of target.tenantIds) {
    try {
      const result = await queryWithTenant(tid, sql, params);
      const row = result.rows[0];
      if (!row) continue;

      for (const [key, value] of Object.entries(row)) {
        const num = parseInt(value);
        if (!isNaN(num)) {
          merged[key] = (merged[key] || 0) + num;
        } else if (!(key in merged)) {
          merged[key] = value;
        }
      }
    } catch (err) {
      console.error(`[VEMIO MSP] Aggregate failed for tenant ${tid}:`, err.message);
    }
  }

  return merged;
}
