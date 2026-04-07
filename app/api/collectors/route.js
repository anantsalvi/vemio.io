/**
 * VEMIO™ — Collectors API
 * GET /api/collectors
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session) => {
  const tenantId = session.tenantId || session.user?.tenantId;
  if (!tenantId) {
    return Response.json({ error: 'No tenant in session' }, { status: 403 });
  }

  try {
    const sitesResult = await queryWithTenant(tenantId, `
      SELECT
        cs.id,
        cs.site_id,
        cs.site_name,
        cs.collector_version,
        cs.hostname,
        cs.os_info,
        cs.node_version,
        cs.status,
        cs.last_heartbeat,
        cs.created_at,
        cs.updated_at,
        s.name AS linked_site_name,
        EXTRACT(EPOCH FROM (NOW() - cs.last_heartbeat)) AS seconds_since_heartbeat
      FROM collector_sites cs
      LEFT JOIN sites s ON s.id = cs.site_id
      ORDER BY cs.created_at ASC
    `);

    const sites = sitesResult.rows;
    if (sites.length === 0) {
      return Response.json({ collectors: [] });
    }

    const siteIds = sites.map(s => s.id);

    const runsResult = await queryWithTenant(tenantId, `
      SELECT DISTINCT ON (collector_site_id)
        collector_site_id,
        id AS run_id,
        trigger_source,
        status,
        started_at,
        completed_at,
        duration_ms,
        devices_found,
        devices_new,
        endpoints_found,
        topology_links,
        ports_scanned,
        vlans_found,
        ips_pinged,
        ips_responded,
        error_message
      FROM collector_discovery_runs
      WHERE collector_site_id = ANY($1)
      ORDER BY collector_site_id, started_at DESC
    `, [siteIds]);

    const lastRunBySite = {};
    for (const r of runsResult.rows) lastRunBySite[r.collector_site_id] = r;

    const cmdResult = await queryWithTenant(tenantId, `
      SELECT
        collector_site_id,
        COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
        COUNT(*) FILTER (WHERE status = 'running')   AS running
      FROM collector_commands
      WHERE collector_site_id = ANY($1)
      GROUP BY collector_site_id
    `, [siteIds]);

    const cmdsBySite = {};
    for (const c of cmdResult.rows) cmdsBySite[c.collector_site_id] = c;

    const devCountResult = await queryWithTenant(tenantId, `
      SELECT collector_site_id, COUNT(*) AS device_count
      FROM collector_devices
      WHERE collector_site_id = ANY($1)
      GROUP BY collector_site_id
    `, [siteIds]);

    const devCountBySite = {};
    for (const d of devCountResult.rows) devCountBySite[d.collector_site_id] = parseInt(d.device_count);

    const collectors = sites.map(s => {
      const lastRun = lastRunBySite[s.id] || null;
      const cmds = cmdsBySite[s.id] || { pending: 0, delivered: 0, running: 0 };
      const secs = s.seconds_since_heartbeat != null ? parseFloat(s.seconds_since_heartbeat) : null;
      const isOnline = secs != null && secs < 180;

      return {
        id: s.id,
        siteId: s.site_id,
        siteName: s.site_name,
        linkedSiteName: s.linked_site_name,
        collectorVersion: s.collector_version,
        hostname: s.hostname,
        osInfo: s.os_info,
        nodeVersion: s.node_version,
        status: s.status,
        isOnline,
        lastHeartbeat: s.last_heartbeat,
        secondsSinceHeartbeat: secs,
        createdAt: s.created_at,
        deviceCount: devCountBySite[s.id] || 0,
        pendingCommands: parseInt(cmds.pending) || 0,
        deliveredCommands: parseInt(cmds.delivered) || 0,
        runningCommands: parseInt(cmds.running) || 0,
        lastRun: lastRun ? {
          id: lastRun.run_id,
          triggerSource: lastRun.trigger_source,
          status: lastRun.status,
          startedAt: lastRun.started_at,
          completedAt: lastRun.completed_at,
          durationMs: lastRun.duration_ms,
          devicesFound: lastRun.devices_found,
          devicesNew: lastRun.devices_new,
          endpointsFound: lastRun.endpoints_found,
          topologyLinks: lastRun.topology_links,
          portsScanned: lastRun.ports_scanned,
          vlansFound: lastRun.vlans_found,
          ipsPinged: lastRun.ips_pinged,
          ipsResponded: lastRun.ips_responded,
          errorMessage: lastRun.error_message,
        } : null,
      };
    });

    return Response.json({ collectors });
  } catch (err) {
    console.error('[VEMIO API] Collectors query error:', err.message);
    return Response.json({ error: 'Failed to fetch collectors' }, { status: 500 });
  }
});
