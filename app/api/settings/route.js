/**
 * VEMIO™ — Tenant Settings API
 * GET   /api/settings  — Read current tenant settings
 * PATCH /api/settings  — Update tenant settings (admin only)
 *
 * Settings shape stored in tenants.settings JSONB:
 * {
 *   notifications: {
 *     enabled: boolean,
 *     email_recipients: string[],
 *     min_severity: 'critical' | 'high' | 'medium' | 'low',
 *     digest_frequency: 'immediate' | 'hourly' | 'daily',
 *     digest_time_ist: string,        // "09:00"
 *     mute_windows: [{ start: "22:00", end: "07:00", days: [0,6] }]
 *     notify_on: {
 *       device_down: boolean,
 *       sla_breach: boolean,
 *       bcs_drop: boolean,
 *       alert_critical: boolean,
 *     }
 *   },
 *   reports: {
 *     // Managed via scheduled_reports table, not here
 *   }
 * }
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

const DEFAULT_SETTINGS = {
  notifications: {
    enabled:           true,
    email_recipients:  [],
    min_severity:      'high',
    digest_frequency:  'immediate',
    digest_time_ist:   '09:00',
    mute_windows:      [],
    notify_on: {
      device_down:    true,
      sla_breach:     true,
      bcs_drop:       true,
      alert_critical: true,
    },
  },
};

export const GET = withAuth(async (req, session) => {
  const tenantId = session.user.tenantId;

  try {
    // Get tenant settings + scheduled reports in one go
    const [tenantResult, scheduledResult] = await Promise.all([
      queryWithTenant(tenantId,
        `SELECT settings FROM tenants WHERE id = $1`, [tenantId]
      ),
      queryWithTenant(tenantId,
        `SELECT id, report_type, frequency, day_of_week, day_of_month,
                recipients, is_active, last_sent_at, next_run_at
         FROM scheduled_reports
         ORDER BY created_at ASC`, []
      ),
    ]);

    const raw      = tenantResult.rows[0]?.settings || {};
    // Deep merge with defaults so missing keys are always present
    const settings = deepMerge(DEFAULT_SETTINGS, raw);

    return Response.json({
      settings,
      scheduled_reports: scheduledResult.rows,
    });

  } catch (err) {
    console.error('Settings GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const PATCH = withAuth(async (req, session) => {
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const tenantId = session.user.tenantId;

  try {
    const body = await req.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return Response.json({ error: 'settings object required' }, { status: 400 });
    }

    // Fetch current, merge, write back — never overwrite the whole column
    const current = await queryWithTenant(tenantId,
      `SELECT settings FROM tenants WHERE id = $1`, [tenantId]
    );
    const existing = current.rows[0]?.settings || {};
    const merged   = deepMerge(existing, settings);

    await queryWithTenant(tenantId,
      `UPDATE tenants SET settings = $2, updated_at = NOW() WHERE id = $1`,
      [tenantId, JSON.stringify(merged)]
    );

    return Response.json({ success: true, settings: merged });

  } catch (err) {
    console.error('Settings PATCH error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Simple deep merge — arrays are replaced, not concatenated
function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key] || {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}