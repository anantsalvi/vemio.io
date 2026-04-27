/**
 * VEMIO™ — Collectors API
 * GET  /api/collectors          — list all collectors with status/runs/commands
 * POST /api/collectors          — create a new pending collector (enrollment)
 *                                 Body: { siteId, siteName }
 *                                 Returns: { id, enrollmentToken, siteName, installCommand }
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';
import { randomBytes } from 'crypto';

const VPS_BASE_URL = process.env.VEMIO_VPS_URL || 'https://vemio-backend.vemio.in';

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
        cs.enrollment_token,
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
        hasEnrollmentToken: !!s.enrollment_token,
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

// ── POST /api/collectors ────────────────────────────────────────────────────
// Creates a pending collector_sites row and returns an enrollment token.
// The user runs the install command on their collector machine, which calls
// POST {VPS}/api/collector/enroll with the token to flip pending → active.
// ─────────────────────────────────────────────────────────────────────────────
export const POST = withAuth(async (req, session) => {
  const tenantId = session.tenantId || session.user?.tenantId;
  if (!tenantId) {
    return Response.json({ error: 'No tenant in session' }, { status: 403 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const siteId = (body.siteId || '').trim();
  const siteName = (body.siteName || '').trim();

  if (!siteId) {
    return Response.json({ error: 'siteId is required' }, { status: 400 });
  }
  if (!siteName) {
    return Response.json({ error: 'siteName is required' }, { status: 400 });
  }
  if (siteName.length > 200) {
    return Response.json({ error: 'siteName too long (max 200 chars)' }, { status: 400 });
  }

  try {
    // Confirm site belongs to the caller's tenant before linking.
    const siteCheck = await queryWithTenant(tenantId,
      `SELECT id, name FROM sites WHERE id = $1`, [siteId]);
    if (siteCheck.rows.length === 0) {
      return Response.json({ error: 'Site not found in your tenant' }, { status: 404 });
    }

    // Token is the user-visible secret. api_key is a placeholder until enrollment
    // (the enroll endpoint replaces it with a fresh server-generated key).
    const enrollmentToken = randomBytes(32).toString('hex');
    const placeholderApiKey = 'pending-' + randomBytes(16).toString('hex');

    const inserted = await queryWithTenant(tenantId, `
      INSERT INTO collector_sites
        (tenant_id, site_id, site_name, api_key, enrollment_token, status)
      VALUES
        ($1, $2, $3, $4, $5, 'pending')
      RETURNING id, site_id, site_name, status, created_at
    `, [tenantId, siteId, siteName, placeholderApiKey, enrollmentToken]);

    const row = inserted.rows[0];

    // Install command the user runs on the collector machine.
    const installCommand =
      `curl -X POST ${VPS_BASE_URL}/api/collector/enroll \\
  -H "Content-Type: application/json" \\
  -d '{"enrollment_token":"${enrollmentToken}","hostname":"'"$(hostname)"'","os_info":"'"$(uname -sr)"'","node_version":"'"$(node -v 2>/dev/null || echo unknown)"'"}'`;

    return Response.json({
      id: row.id,
      siteId: row.site_id,
      siteName: row.site_name,
      status: row.status,
      createdAt: row.created_at,
      enrollmentToken,
      vpsUrl: VPS_BASE_URL,
      installCommand,
    }, { status: 201 });
  } catch (err) {
    console.error('[VEMIO API] Collector create error:', err.message);
    return Response.json({ error: 'Failed to create collector' }, { status: 500 });
  }
});
