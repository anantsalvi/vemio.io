/**
 * VEMIO™ — Discovery Run History
 * GET /api/collectors/[id]/runs?limit=20
 */

import { withAuth } from '@/lib/auth';
import { queryWithTenant } from '@/lib/db';

export const GET = withAuth(async (req, session, { params }) => {
  const tenantId = session.tenantId || session.user?.tenantId;
  if (!tenantId) {
    return Response.json({ error: 'No tenant in session' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return Response.json({ error: 'collector id required' }, { status: 400 });

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));

  try {
    const check = await queryWithTenant(tenantId,
      `SELECT id FROM collector_sites WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      return Response.json({ error: 'Collector not found' }, { status: 404 });
    }

    const runs = await queryWithTenant(tenantId, `
      SELECT
        id,
        command_id,
        trigger_source,
        status,
        started_at,
        completed_at,
        duration_ms,
        devices_found,
        devices_new,
        devices_updated,
        endpoints_found,
        topology_links,
        ports_scanned,
        vlans_found,
        ips_pinged,
        ips_responded,
        phase_timings,
        error_message
      FROM collector_discovery_runs
      WHERE collector_site_id = $1
      ORDER BY started_at DESC
      LIMIT $2
    `, [id, limit]);

    const commands = await queryWithTenant(tenantId, `
      SELECT
        id, command_type, status, created_at, delivered_at, completed_at, error_message
      FROM collector_commands
      WHERE collector_site_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [id, limit]);

    return Response.json({
      runs: runs.rows.map(r => ({
        id: r.id,
        commandId: r.command_id,
        triggerSource: r.trigger_source,
        status: r.status,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        durationMs: r.duration_ms,
        devicesFound: r.devices_found,
        devicesNew: r.devices_new,
        devicesUpdated: r.devices_updated,
        endpointsFound: r.endpoints_found,
        topologyLinks: r.topology_links,
        portsScanned: r.ports_scanned,
        vlansFound: r.vlans_found,
        ipsPinged: r.ips_pinged,
        ipsResponded: r.ips_responded,
        phaseTimings: r.phase_timings,
        errorMessage: r.error_message,
      })),
      commands: commands.rows.map(c => ({
        id: c.id,
        commandType: c.command_type,
        status: c.status,
        createdAt: c.created_at,
        deliveredAt: c.delivered_at,
        completedAt: c.completed_at,
        errorMessage: c.error_message,
      })),
    });
  } catch (err) {
    console.error('[VEMIO API] Discovery runs query error:', err.message);
    return Response.json({ error: 'Failed to fetch runs' }, { status: 500 });
  }
});
