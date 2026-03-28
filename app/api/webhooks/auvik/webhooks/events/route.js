/**
 * VEMIO™ — Webhook Events API
 * 
 * GET /api/webhooks/events
 * 
 * Returns recent webhook events for the logged-in tenant.
 * Admin-only endpoint for debugging webhook integrations.
 * 
 * Query params:
 *   ?limit=50        — number of events (default 50, max 200)
 *   ?status=all       — filter: all | processed | failed | unprocessed
 *   ?source=auvik     — filter by source (default: all)
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export async function GET(request) {
  return withAuth(request, async (session) => {
    // Only admins can view webhook logs
    if (session.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const status = searchParams.get('status') || 'all';
    const source = searchParams.get('source') || 'all';

    // Build WHERE clauses
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status === 'processed') {
      conditions.push(`we.processed = true AND we.error_message IS NULL`);
    } else if (status === 'failed') {
      conditions.push(`we.error_message IS NOT NULL`);
    } else if (status === 'unprocessed') {
      conditions.push(`we.processed = false`);
    }

    if (source !== 'all') {
      conditions.push(`we.source = $${paramIndex}`);
      params.push(source);
      paramIndex++;
    }

    const whereClause = conditions.length > 0
      ? `AND ${conditions.join(' AND ')}`
      : '';

    params.push(limit);

    const result = await queryWithTenant(
      session.tenantId,
      `SELECT 
         we.id,
         we.source,
         we.event_type,
         we.auvik_device_id,
         we.tenant_id,
         we.processed,
         we.processed_at,
         we.error_message,
         we.raw_payload,
         we.created_at
       FROM webhook_events we
       WHERE we.tenant_id = app.current_tenant_id()
         ${whereClause}
       ORDER BY we.created_at DESC
       LIMIT $${paramIndex}`,
      params
    );

    // Extract useful display fields from raw_payload
    const events = result.rows.map((row) => {
      let displayName = null;
      let displayStatus = null;
      let alertName = null;

      try {
        const payload = typeof row.raw_payload === 'string'
          ? JSON.parse(row.raw_payload)
          : row.raw_payload;

        // Handle JSONata-transformed format
        if (payload.data) {
          displayName = payload.data.deviceName || payload.data.deviceId || null;
          displayStatus = payload.data.status || null;
          alertName = payload.data.alertName || null;
        }
        // Handle raw Auvik format (fallback)
        if (!displayName) {
          displayName = payload.entityName || payload.entityId || null;
          displayStatus = payload.alertStatusString || null;
          alertName = payload.alertName || null;
        }
      } catch {}

      return {
        id: row.id,
        source: row.source,
        eventType: row.event_type,
        deviceName: displayName,
        alertStatus: displayStatus,
        alertName: alertName,
        processed: row.processed,
        processedAt: row.processed_at,
        errorMessage: row.error_message,
        rawPayload: row.raw_payload,
        createdAt: row.created_at,
      };
    });

    // Summary stats
    const statsResult = await queryWithTenant(
      session.tenantId,
      `SELECT 
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE processed = true AND error_message IS NULL) AS processed,
         COUNT(*) FILTER (WHERE error_message IS NOT NULL) AS failed,
         COUNT(*) FILTER (WHERE processed = false) AS unprocessed,
         MIN(created_at) AS first_event,
         MAX(created_at) AS last_event
       FROM webhook_events
       WHERE tenant_id = app.current_tenant_id()`,
      []
    );

    const stats = statsResult.rows[0] || {};

    return Response.json({
      events,
      stats: {
        total: parseInt(stats.total || '0'),
        processed: parseInt(stats.processed || '0'),
        failed: parseInt(stats.failed || '0'),
        unprocessed: parseInt(stats.unprocessed || '0'),
        firstEvent: stats.first_event,
        lastEvent: stats.last_event,
      },
    });
  });
}