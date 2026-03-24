/**
 * VEMIO™ — Auvik Webhook Receiver
 * 
 * POST /api/webhooks/auvik
 * 
 * Receives push events from Auvik, validates HMAC-SHA256 signature,
 * logs raw payload to webhook_events, and processes device state changes.
 * 
 * Auvik webhook payload format:
 * {
 *   "eventType": "device.status.changed",
 *   "data": {
 *     "deviceId": "...",
 *     "deviceName": "...",
 *     "status": "up|down|degraded",
 *     "previousStatus": "...",
 *     "networkId": "...",
 *     ...
 *   },
 *   "timestamp": "2026-03-24T12:00:00Z"
 * }
 * 
 * Security:
 * - HMAC-SHA256 signature validation (X-Auvik-Signature header)
 * - Rate limiting via Vercel Edge Config (future)
 * - IP allowlisting (future, when Auvik publishes webhook IPs)
 */

import crypto from 'crypto';
import { queryRaw, withTransaction } from '@/lib/db';

const WEBHOOK_SECRET = process.env.AUVIK_WEBHOOK_SECRET;

/**
 * Verify HMAC-SHA256 signature from Auvik.
 */
function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    console.warn('[VEMIO Webhook] AUVIK_WEBHOOK_SECRET not set — skipping validation');
    return true;
  }

  if (!signature) {
    return false;
  }

  // First try direct comparison (Auvik Header auth sends the secret as-is)
  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const secretBuf = Buffer.from(WEBHOOK_SECRET, 'utf8');
    if (sigBuf.length === secretBuf.length && crypto.timingSafeEqual(sigBuf, secretBuf)) {
      return true;
    }
  } catch {}

  // Fall back to HMAC-SHA256 verification (in case Auvik adds HMAC support later)
  try {
    const expected = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload, 'utf8')
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    );
  } catch {
    return false;
  }
}


/**
 * Resolve Auvik networkId → VEMIO tenant + site.
 */
async function resolveMapping(networkId) {
  if (!networkId) return { tenantId: null, siteId: null };

  // Check site-level mapping first (more specific)
  const siteResult = await queryRaw(
    `SELECT s.id AS site_id, s.tenant_id 
     FROM sites s 
     WHERE s.auvik_network_id = $1 AND s.is_active = TRUE
     LIMIT 1`,
    [networkId]
  );

  if (siteResult.rows.length > 0) {
    return {
      tenantId: siteResult.rows[0].tenant_id,
      siteId: siteResult.rows[0].site_id,
    };
  }

  // Fall back to tenant-level mapping
  const tenantResult = await queryRaw(
    `SELECT id AS tenant_id 
     FROM tenants 
     WHERE $1 = ANY(auvik_network_ids) AND is_active = TRUE
     LIMIT 1`,
    [networkId]
  );

  if (tenantResult.rows.length > 0) {
    return {
      tenantId: tenantResult.rows[0].tenant_id,
      siteId: null,
    };
  }

  return { tenantId: null, siteId: null };
}


/**
 * Process a device status change event.
 * Updates device current_status and writes to device_status_history.
 */
async function processDeviceStatusChange(data, tenantId, siteId) {
  const { deviceId, deviceName, status, previousStatus, networkId } = data;

  await withTransaction(async (client) => {
    // Upsert device record
    await client.query(
      `INSERT INTO devices (
         auvik_device_id, tenant_id, site_id, name, current_status, last_seen_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (auvik_device_id) DO UPDATE SET
         current_status = $5,
         last_seen_at = NOW(),
         name = COALESCE(NULLIF($4, ''), devices.name),
         site_id = COALESCE($3, devices.site_id),
         updated_at = NOW()`,
      [deviceId, tenantId, siteId, deviceName || 'Unknown Device', status || 'unknown']
    );

    // Write status history entry
    if (tenantId) {
      // Get device UUID from auvik_device_id
      const deviceResult = await client.query(
        'SELECT id FROM devices WHERE auvik_device_id = $1',
        [deviceId]
      );

      if (deviceResult.rows.length > 0) {
        await client.query(
          `INSERT INTO device_status_history (
             device_id, tenant_id, status, changed_at, source
           ) VALUES ($1, $2, $3, NOW(), 'webhook')`,
          [deviceResult.rows[0].id, tenantId, status || 'unknown']
        );
      }
    }
  });
}


/**
 * POST handler — receives Auvik webhooks.
 */
export async function POST(request) {
  const startTime = Date.now();

  try {
    // Read raw body for signature verification
    const rawBody = await request.text();

    // Verify HMAC signature
     const signature = request.headers.get('x-auvik-signature')
      || request.headers.get('auvik_webhook_secret')
      || request.headers.get('x-hub-signature-256')?.replace('sha256=', '');

    if (WEBHOOK_SECRET && !verifySignature(rawBody, signature)) {
      console.warn('[VEMIO Webhook] Signature verification failed');
      return Response.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      );
    }

    const eventType = payload.eventType || payload.event_type || 'unknown';
    const data = payload.data || payload;
    const auvikDeviceId = data.deviceId || data.device_id || null;
    const networkId = data.networkId || data.network_id || null;

    // Resolve tenant + site mapping
    const { tenantId, siteId } = await resolveMapping(networkId);

    // Log raw event to webhook_events table (always, even if mapping fails)
    const insertResult = await queryRaw(
      `INSERT INTO webhook_events (
         source, event_type, auvik_device_id, tenant_id, site_id, raw_payload
       ) VALUES ('auvik', $1, $2, $3, $4, $5)
       RETURNING id`,
      [eventType, auvikDeviceId, tenantId, siteId, JSON.stringify(payload)]
    );

    const webhookEventId = insertResult.rows[0].id;

    // Process based on event type
    let processed = false;
    let errorMessage = null;

    try {
      if (tenantId) {
        switch (eventType) {
          case 'device.status.changed':
          case 'device.online':
          case 'device.offline':
            await processDeviceStatusChange(data, tenantId, siteId);
            processed = true;
            break;

          case 'alert.triggered':
          case 'alert.resolved':
            // Phase 2: alert processing pipeline
            // For now, just log — the raw_payload is preserved
            processed = true;
            break;

          default:
            // Unknown event type — log but don't fail
            processed = true;
            break;
        }
      } else {
        errorMessage = `No tenant mapping for networkId: ${networkId}`;
      }
    } catch (err) {
      errorMessage = err.message;
      console.error('[VEMIO Webhook] Processing error:', err);
    }

    // Update webhook_events with processing result
    await queryRaw(
      `UPDATE webhook_events SET 
         processed = $1, processed_at = NOW(), error_message = $2 
       WHERE id = $3`,
      [processed, errorMessage, webhookEventId]
    );

    const duration = Date.now() - startTime;
    console.log(`[VEMIO Webhook] ${eventType} | tenant=${tenantId || 'unmapped'} | ${duration}ms`);

    return Response.json({
      received: true,
      eventId: webhookEventId,
      mapped: !!tenantId,
    }, { status: 200 });

  } catch (err) {
    console.error('[VEMIO Webhook] Fatal error:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


/**
 * OPTIONS handler — CORS preflight for Auvik.
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Auvik-Signature, X-Hub-Signature-256',
      'Access-Control-Max-Age': '86400',
    },
  });
}
