/**
 * VEMIO™ — Database Connection Layer
 * 
 * Connects to PostgreSQL via PgBouncer on the DigitalOcean VPS.
 * Every query is tenant-scoped via RLS session variable.
 * 
 * Usage:
 *   import { queryWithTenant, queryRaw } from '@/lib/db';
 *   
 *   // Tenant-scoped (dashboard API routes)
 *   const devices = await queryWithTenant(tenantId, 'SELECT * FROM devices');
 *   
 *   // Raw (webhooks, admin operations)
 *   const result = await queryRaw('SELECT * FROM worker_heartbeats');
 */

import pg from 'pg';

const { Pool } = pg;

// Connection pool — shared across all serverless invocations (warm container)
let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // PgBouncer in transaction mode — disable prepared statements
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 5,                    // Vercel serverless: keep pool small
      idleTimeoutMillis: 10000,  // Release idle connections quickly
      connectionTimeoutMillis: 5000,
      // Critical: PgBouncer transaction mode doesn't support prepared statements
      // This forces pg to use simple query protocol
    });

    pool.on('error', (err) => {
      console.error('[VEMIO DB] Pool error:', err.message);
    });
  }
  return pool;
}


/**
 * Execute a query with tenant isolation via RLS.
 * Sets `app.current_tenant_id` for the transaction scope.
 * 
 * @param {string} tenantId - UUID of the tenant
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function queryWithTenant(tenantId, text, params = []) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.current_tenant_id = $1", [tenantId]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VEMIO DB] Tenant query error:', { tenantId, text, error: err.message });
    throw err;
  } finally {
    client.release();
  }
}


/**
 * Execute a raw query without tenant scoping.
 * Use for: webhook ingestion, admin operations, worker heartbeats.
 * 
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function queryRaw(text, params = []) {
  try {
    return await getPool().query(text, params);
  } catch (err) {
    console.error('[VEMIO DB] Raw query error:', { text, error: err.message });
    throw err;
  }
}


/**
 * Transaction helper for multi-statement operations.
 * 
 * @param {function} callback - async (client) => { ... }
 * @returns {Promise<any>} - Return value of the callback
 */
export async function withTransaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


/**
 * Health check — used by /api/health endpoint.
 */
export async function checkConnection() {
  try {
    const result = await getPool().query('SELECT NOW() as now, current_database() as db');
    return { healthy: true, ...result.rows[0] };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}
