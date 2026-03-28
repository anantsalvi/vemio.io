/**
 * VEMIO™ — Auvik Webhook Receiver
 * 
 * POST /api/webhooks/auvik
 * 
 * Receives push events from Auvik, validates auth,
 * logs raw payload to webhook_events, and processes device status changes.
 * 
 * Auvik sends raw alert payloads, but we use a JSONata transformation
 * in the Auvik webhook config to reshape into this format:
 * 
 * {
 *   "eventType": "device.status.changed",
 *   "data": {
 *     "deviceId": "MTI3Mzg5...",        // base64, = auvik_device_id
 *     "deviceName": "Core-Switch-01",
 *     "status": "Triggered" | "Cleared", // alertStatusString from Auvik
 *     "networkId": "1338754018033971966", // companyId from Auvik = Auvik tenant ID
 *     "alertName": "Firewall is online (webhook)",
 *     "alertSeverity": 1
 *   },
 *   "timestamp": "2026-03-28T12:00:00.000Z"
 * }
 * 
 * Security:
 * - Auvik Header auth (shared secret sent as header value)
 * - HMAC-SHA256 fallback (future-proofing)
 */

import crypto from 'crypto';
import { queryRaw, withTransaction } from '@/lib/db';

const WEBHOOK_SECRET = process.env.AUVIK_WEBHOOK_SECRET;

// ─── Auvik tenant ID → VEMIO tenant slug mapping ────────────────────────
// Maps companyId (arrives as data.networkId via JSONata transform) to slug.
// Fast path — avoids DB lookup on every webhook hit.
const AUVIK_TENANT_MAP = {
  '1337325442462364413': 'vinay-hq',
  '1338754018033971966': 'aia-engineering',
};


/**
 * Verify webhook auth from Auvik.
 * Supports Header auth (shared secret) and HMAC-SHA256 fallback.
 */
function verifySignature(payload, request) {
  if (!WEBHOOK_SECRET) {
    console.warn('[VEMIO Webhook] AUVIK_WEBHOOK_SECRET not set — skipping validation');
    return true;
  }

  // Collect all candidate header values
  const candidates = [
    request.headers.get('x-auvik-signature'),
    request.headers.get('auvik_webhook_secret'),
    request.headers.get('x-auvik-secret'),
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''),
  ].filter(Boolean);

  // Direct secret comparison (Auvik Header auth mode)
  for (const candidate of candidates) {
    try {
      const sigBuf = Buffer.from(candidate, 'utf8');
      const secretBuf = Buffer.from(WEBHOOK_SECRET, 'utf8');
      if (sigBuf.length === secretBuf.length && crypto.timingSafeEqual(sigBuf, secretBuf)) {
        return true;
      }
    } catch {}
  }

  // HMAC-SHA256 fallback
  const hmacHeader = request.headers.get('x-hub-signature-256')?.replace('sha256=', '');
  if (hmacHeader) {
    try {
      const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(payload, 'utf8')
        .digest('hex');
      return crypto.timingSafeEqual(
        Buffer.from(hmacHeader, 'hex'),
        Buffer.from(expected, 'hex')
      );
    } catch {}
  }

  return false;
}


/**
 * Resolve Auvik companyId → VEMIO tenant_id (UUID) and optional site_id.
 * The companyId arrives as data.networkId via JSONata transform.
 */
async function resolveMapping(networkId) {
  if (!networkId) return { tenantId: null, siteId: null };

  // Fast path: in-memory map → slug → DB lookup for UUID
  const slug = AUVIK_TENANT_MAP[networkId];
  if (slug) {
    const result = await queryRaw(
      `SELECT id FROM tenants WHERE slug = $1 AND is_active = TRUE LIMIT 1`,
      [slug]
    );
    if (result.rows.length > 0) {
      return { tenantId: result.rows[0].id, siteId: null };
    }
  }

  // Check site-level mapping (more specific)
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

  // Slow path: search auvik_network_ids array on tenants
  const result = await queryRaw(
    `SELECT id FROM tenants WHERE $1 = ANY(auvik_network_ids) AND is_active = TRUE LIMIT 1`,
    [networkId]
  );
  if (result.rows.length > 0) {
    return { tenantId: result.rows[0].id, siteId: null };
  }

  return { tenantId: null, siteId: null };
}


/**
 * Determine new device status from the transformed webhook payload.
 * 
 * data.status is alertStatusString: "Triggered" or "Cleared"
 * data.alertName tells us what kind of alert it is.
 * 
 * For "Device is offline" / "X went offline" alerts:
 *   Triggered → device went DOWN
 *   Cleared   → device came back UP
 * 
 * For "Device is online" / "X is online" alerts:
 *   Triggered → device came UP
 *   Cleared   → device went DOWN (unusual, but handle it)
 */
function resolveDeviceStatus(alertStatusString, alertName) {
  const isTriggered = alertStatusString === 'Triggered';
  const isCleared = alertStatusString === 'Cleared';

  if (!isTriggered && !isCleared) return null;

  const name = (alertName || '').toLowerCase();

  // Detect whether this is an "is online" alert (inverse logic)
  const isOnlineAlert = name.includes('is online') || name.includes('went online');
  const isOfflineAlert = name.includes('is offline') || name.includes('went offline');

  if (isOnlineAlert) {
    // "Device is online" alert: Triggered = UP, Cleared = DOWN
    return isTriggered ? 'up' : 'down';
  }

  if (isOfflineAlert) {
    // "Device is offline" alert: Triggered = DOWN, Cleared = UP
    return isTriggered ? 'down' : 'up';
  }

  // Broader patterns: "Online Status", "status change", etc.
  // Default to offline-alert logic (Triggered = down) since
  // Auvik's most common device status alert fires on going offline.
  if (name.includes('online') || name.includes('status') || name.includes('offline')) {
    return isTriggered ? 'down' : 'up';
  }

  // Not a device status alert — return null to skip processing
  return null;
}


/**
 * Process a device status change event.
 * Updates device current_status and writes to device_status_history.
 * UPDATE only — does not create new device records from webhooks.
 */
async function processDeviceStatusChange(data, tenantId, newStatus, timestamp) {
  const { deviceId, deviceName } = data;
  const eventDate = timestamp ? new Date(timestamp) : new Date();

  await withTransaction(async (client) => {
    // Update existing device only (skip retired devices)
    const updateResult = await client.query(
      `UPDATE devices SET
         current_status = $1,
         last_seen_at = $2,
         name = COALESCE(NULLIF($3, ''), name),
         updated_at = NOW()
       WHERE auvik_device_id = $4
         AND tenant_id = $5
         AND is_retired = false
       RETURNING id, name`,
      [newStatus, eventDate, deviceName || null, deviceId, tenantId]
    );

    if (updateResult.rows.length === 0) {
      console.log(`[VEMIO Webhook] Device not found or retired: ${deviceId}`);
      return;
    }

    const device = updateResult.rows[0];

    // Write status history entry
    await client.query(
      `INSERT INTO device_status_history (
         device_id, tenant_id, status, changed_at, source
       ) VALUES ($1, $2, $3, $4, 'webhook')`,
      [device.id, tenantId, newStatus, eventDate]
    );

    console.log(`[VEMIO Webhook] ${device.name} → ${newStatus} (via webhook)`);
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

    // Verify auth
    if (WEBHOOK_SECRET && !verifySignature(rawBody, request)) {
      console.warn('[VEMIO Webhook] Auth verification failed');
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

    // Handle Auvik test connection payload
    if (payload['my-api-test-field'] === 'my-api-test-value') {
      console.log('[VEMIO Webhook] Auvik test connection — OK');
      return Response.json({ received: true, test: true }, { status: 200 });
    }

    // Extract from JSONata-transformed payload
    const eventType = payload.eventType || 'unknown';
    const data = payload.data || {};
    const timestamp = payload.timestamp || null;
    const deviceId = data.deviceId || null;
    const networkId = data.networkId || null;

    // Resolve tenant + site
    const { tenantId, siteId } = await resolveMapping(networkId);

    // Log raw event (includes site_id column)
    const insertResult = await queryRaw(
      `INSERT INTO webhook_events (
         source, event_type, auvik_device_id, tenant_id, site_id, raw_payload
       ) VALUES ('auvik', $1, $2, $3, $4, $5)
       RETURNING id`,
      [eventType, deviceId, tenantId, siteId, JSON.stringify(payload)]
    );

    const webhookEventId = insertResult.rows[0].id;

    // Process based on event type
    let processed = false;
    let errorMessage = null;

    try {
      if (!tenantId) {
        errorMessage = `No tenant mapping for networkId: ${networkId}`;
      } else if (eventType === 'device.status.changed') {
        // Resolve actual up/down status from alertStatusString + alertName
        const newStatus = resolveDeviceStatus(data.status, data.alertName);

        if (newStatus) {
          await processDeviceStatusChange(data, tenantId, newStatus, timestamp);
          processed = true;
        } else {
          // Alert doesn't map to a clear status change
          errorMessage = `Could not resolve status from: ${data.status} / ${data.alertName}`;
          processed = true; // Not an error, just not actionable
        }
      } else {
        // Unknown/future event types — log, don't fail
        processed = true;
      }
    } catch (err) {
      errorMessage = err.message;
      console.error('[VEMIO Webhook] Processing error:', err);
    }

    // Update webhook_events with result
    await queryRaw(
      `UPDATE webhook_events SET 
         processed = $1, processed_at = NOW(), error_message = $2 
       WHERE id = $3`,
      [processed, errorMessage, webhookEventId]
    );

    const duration = Date.now() - startTime;
    console.log(
      `[VEMIO Webhook] ${eventType} | ${data.deviceName || 'unknown'} | ` +
      `status=${data.status || '?'} | tenant=${tenantId ? 'mapped' : 'unmapped'} | ${duration}ms`
    );

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
      'Access-Control-Allow-Headers': 'Content-Type, X-Auvik-Signature, X-Auvik-Secret, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}