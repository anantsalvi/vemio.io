/**
 * VEMIO™ — Admin Query Helper
 * 
 * Executes queries with app.is_admin = 'true' set in the transaction,
 * which allows the admin_bypass RLS policy to grant access.
 * 
 * ONLY use this in /api/admin/* routes behind withMSPAuth.
 * Regular dashboard routes should continue using queryWithTenant or queryRaw.
 */

import pg from 'pg';

const { Pool } = pg;

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[VEMIO Admin DB] Pool error:', err.message);
    });
  }
  return pool;
}

/**
 * Execute a query with admin RLS bypass.
 * Sets app.is_admin = 'true' for the duration of the transaction.
 */
export async function queryAsAdmin(text, params = []) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL app.is_admin = 'true'");
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[VEMIO Admin DB] Query error:', { text: text.substring(0, 100), error: err.message });
    throw err;
  } finally {
    client.release();
  }
}