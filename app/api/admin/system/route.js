/**
 * VEMIO™ — MSP Admin: System Health API
 * 
 * GET /api/admin/system — Worker heartbeats, DB stats, sync info
 */

import { withMSPAuth } from '@/lib/admin-auth';
import { queryRaw } from '@/lib/db';

export const GET = withMSPAuth(async (req, session) => {
  // Worker heartbeats
  const { rows: workers } = await queryRaw(
    `SELECT worker_name, last_heartbeat, status, details
     FROM worker_heartbeats
     ORDER BY worker_name`
  ).catch(() => ({ rows: [] }));

  // DB stats
  const { rows: dbStats } = await queryRaw(
    `SELECT 
       (SELECT COUNT(*) FROM tenants WHERE is_active = true AND is_msp = false) AS active_tenants,
       (SELECT COUNT(*) FROM users WHERE is_active = true) AS active_users,
       (SELECT COUNT(*) FROM devices WHERE is_monitored = true) AS monitored_devices,
       (SELECT COUNT(*) FROM alerts WHERE state = 'active') AS active_alerts,
       (SELECT COUNT(*) FROM tickets) AS total_tickets,
       (SELECT COUNT(*) FROM audit_log) AS audit_entries,
       (SELECT MAX(created_at) FROM audit_log) AS last_audit_entry`
  );

  // Recent alert stats
  const { rows: alertStats } = await queryRaw(
    `SELECT 
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS alerts_24h,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS alerts_7d,
       COUNT(*) FILTER (WHERE state = 'active') AS active,
       COUNT(*) FILTER (WHERE state = 'acknowledged') AS acknowledged,
       COUNT(*) FILTER (WHERE state = 'resolved' AND resolved_at > NOW() - INTERVAL '24 hours') AS resolved_24h
     FROM alerts`
  );

  // Latest sync timestamps per tenant
  const { rows: syncInfo } = await queryRaw(
    `SELECT t.name AS tenant_name, t.slug,
       (SELECT MAX(d.updated_at) FROM devices d WHERE d.tenant_id = t.id) AS last_device_sync,
       (SELECT MAX(tk.updated_at) FROM tickets tk WHERE tk.tenant_id = t.id) AS last_ticket_sync,
       (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.is_monitored = true) AS device_count
     FROM tenants t
     WHERE t.is_msp = false AND t.is_active = true
     ORDER BY t.name`
  );

  // DB size
  const { rows: dbSize } = await queryRaw(
    `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`
  );

  return Response.json({
    workers: workers.map(w => ({
      ...w,
      is_healthy: w.last_heartbeat && (new Date() - new Date(w.last_heartbeat)) < 10 * 60 * 1000, // 10 min
    })),
    database: {
      ...dbStats[0],
      size: dbSize[0]?.db_size,
    },
    alerts: alertStats[0] || {},
    sync: syncInfo,
  });
});