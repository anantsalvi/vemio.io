/**
 * VEMIO™ — Audit Logger
 * Phase 7.2: Centralized audit logging for all user actions.
 * 
 * Usage:
 *   import { logAudit } from '@/lib/audit';
 *   
 *   await logAudit({
 *     tenantId: session.user.tenantId,
 *     userId: session.user.id,
 *     action: 'report_downloaded',
 *     resourceType: 'report',
 *     resourceId: reportId,
 *     details: { format: 'pdf', report_type: 'monthly_sla' },
 *     req,  // optional — extracts IP and user agent
 *   });
 */

import { queryRaw } from '@/lib/db';

/**
 * Log an audit event.
 * Fails silently — audit logging should never break the main operation.
 *
 * @param {Object} params
 * @param {string} params.tenantId - Tenant UUID
 * @param {string} params.userId - User UUID (nullable for system actions)
 * @param {string} params.action - Action identifier (e.g. 'login', 'report_downloaded')
 * @param {string} [params.resourceType] - Type of resource acted on
 * @param {string} [params.resourceId] - ID of the resource
 * @param {Object} [params.details] - Additional context as JSONB
 * @param {Request} [params.req] - Request object for IP/UA extraction
 */
export async function logAudit({
  tenantId,
  userId = null,
  action,
  resourceType = null,
  resourceId = null,
  details = {},
  req = null,
}) {
  try {
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      // Extract IP from various headers
      ipAddress = req.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers?.get?.('x-real-ip')
        || null;
      userAgent = req.headers?.get?.('user-agent') || null;
    }

    await queryRaw(
      `INSERT INTO audit_log 
        (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::inet, $8)`,
      [
        tenantId,
        userId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(details),
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    // Never throw — audit failures are non-critical
    console.error('[VEMIO Audit] Failed to log:', action, err.message);
  }
}

/**
 * Standard action names for consistency.
 */
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  LOGIN_SSO: 'login_sso',
  LOGOUT: 'logout',

  // Settings
  SSO_CONFIG_UPDATED: 'sso_config_updated',
  BRANDING_UPDATED: 'branding_updated',
  NOTIFICATION_PREFS_UPDATED: 'notification_prefs_updated',

  // Reports
  REPORT_DOWNLOADED: 'report_downloaded',
  REPORT_SCHEDULED: 'report_scheduled',
  REPORT_SCHEDULE_DELETED: 'report_schedule_deleted',

  // User management
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  USER_ROLE_CHANGED: 'user_role_changed',

  // Alerts
  ALERT_ACKNOWLEDGED: 'alert_acknowledged',
  ALERT_RESOLVED: 'alert_resolved',

  // Data access
  DEVICES_VIEWED: 'devices_viewed',
  DEVICE_DETAIL_VIEWED: 'device_detail_viewed',
  TOPOLOGY_VIEWED: 'topology_viewed',
  AUDIT_LOG_EXPORTED: 'audit_log_exported',
};