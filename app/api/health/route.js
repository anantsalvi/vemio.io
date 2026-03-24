/**
 * VEMIO™ — Health Check
 * GET /api/health
 */

import { checkConnection } from '@/lib/db';

export async function GET() {
  const db = await checkConnection();

  return Response.json({
    status: db.healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    database: db,
    version: process.env.npm_package_version || '1.0.0',
  }, {
    status: db.healthy ? 200 : 503,
  });
}
