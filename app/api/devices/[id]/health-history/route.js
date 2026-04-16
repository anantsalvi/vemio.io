/**
 * VEMIO™ — Device Health History API
 * GET /api/devices/[id]/health-history?from=<iso>&to=<iso>
 *
 * Returns CPU and memory time-series samples from device_health_metrics
 * for the specified range. Designed to back the <HealthChart> component
 * on the device detail page.
 *
 * Day 16 — Scope 2.
 *
 * Tenant model: mirrors detail/route.js — uses session.user.tenantId directly.
 * The MSP resolver path used by history/route.js currently errors because
 * msp_tenant_access doesn't exist; is_msp is false system-wide until that's
 * built. When MSP is re-enabled, lift the resolveDeviceTenant pattern from
 * history/route.js.
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

// Clamps
const MIN_RANGE_MS = 60 * 1000;               // 1 minute
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_RANGE_MS = 60 * 60 * 1000;      // 1 hour
const MAX_ROWS = 5000;                        // safety cap

function parseIso(s) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export const GET = withAuth(async (req, session, { params }) => {
  const { id: deviceId } = await params;
  const tenantId = session.user.tenantId;
  const url = new URL(req.url);

  // Parse + validate range
  const now = new Date();
  let to = parseIso(url.searchParams.get('to')) || now;
  let from = parseIso(url.searchParams.get('from'));
  if (!from) {
    from = new Date(to.getTime() - DEFAULT_RANGE_MS);
  }

  if (from >= to) {
    return Response.json(
      { error: 'Invalid range: from must be before to' },
      { status: 400 }
    );
  }

  const rangeMs = to.getTime() - from.getTime();
  if (rangeMs < MIN_RANGE_MS) {
    return Response.json(
      { error: 'Range too small (min 1 minute)' },
      { status: 400 }
    );
  }
  if (rangeMs > MAX_RANGE_MS) {
    return Response.json(
      { error: 'Range too large (max 7 days)' },
      { status: 400 }
    );
  }

  try {
    // Verify device exists and belongs to tenant (RLS would filter anyway,
    // but returning 404 explicitly is clearer than an empty samples array)
    const deviceCheck = await queryWithTenant(tenantId,
      'SELECT id FROM devices WHERE id = $1',
      [deviceId]
    );
    if (deviceCheck.rows.length === 0) {
      return Response.json({ error: 'Device not found' }, { status: 404 });
    }

    // Fetch samples. Index idx_dhm_device_recorded covers this query.
    const result = await queryWithTenant(tenantId,
      `SELECT recorded_at, cpu_percent, memory_percent
         FROM device_health_metrics
        WHERE device_id = $1
          AND recorded_at >= $2
          AND recorded_at <= $3
        ORDER BY recorded_at ASC
        LIMIT $4`,
      [deviceId, from.toISOString(), to.toISOString(), MAX_ROWS]
    );

    const samples = result.rows.map(row => ({
      recordedAt: row.recorded_at,
      cpuPercent: row.cpu_percent !== null ? Number(row.cpu_percent) : null,
      memoryPercent: row.memory_percent !== null ? Number(row.memory_percent) : null,
    }));

    return Response.json({
      samples,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        count: samples.length,
        truncated: samples.length === MAX_ROWS,
      },
    });
  } catch (err) {
    console.error('[VEMIO API] Device health history error:', err.message);
    return Response.json(
      { error: 'Failed to fetch health history' },
      { status: 500 }
    );
  }
});
