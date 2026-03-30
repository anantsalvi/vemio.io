/**
 * VEMIO™ — MSP Admin: System Health
 * Route: /admin/system
 * Access: MSP only
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Activity, Database, Bell, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';

const V = (n) => `var(--color-vemio-${n}, var(--vemio-${n}))`;

export default function AdminSystemPage() {
  const { data: session } = useSession();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/system');
      const d = await res.json();
      setData(d);
    } catch { setData(null); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  if (!session?.user?.isMSP) {
    return <div className="sys-page"><div className="sys-denied"><h2>MSP Access Required</h2></div><style>{css}</style></div>;
  }

  if (loading || !data) {
    return <div className="sys-page"><div className="sys-loading">Loading system health...</div><style>{css}</style></div>;
  }

  function timeAgo(ts) {
    if (!ts) return 'Never';
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="sys-page">
      <div className="sys-header">
        <div>
          <h1 className="sys-title">System Health</h1>
          <p className="sys-subtitle">Infrastructure status and sync overview</p>
        </div>
        <button onClick={fetchHealth} className="sys-refresh"><RefreshCw size={14} />Refresh</button>
      </div>

      {/* Worker Status */}
      <div className="sys-section">
        <h2 className="sys-section-title"><Activity size={16} />Docker Workers</h2>
        <div className="sys-worker-grid">
          {data.workers.length === 0 ? (
            <p className="sys-empty">No worker heartbeats found. Workers may not be reporting health yet.</p>
          ) : data.workers.map(w => (
            <div key={w.worker_name} className={`sys-worker ${w.is_healthy ? 'sys-worker-ok' : 'sys-worker-err'}`}>
              <div className="sys-worker-head">
                {w.is_healthy ? <CheckCircle size={16} color="#1D9E75" /> : <XCircle size={16} color="#E24B4A" />}
                <span className="sys-worker-name">{w.worker_name}</span>
              </div>
              <div className="sys-worker-meta">
                <span><Clock size={12} />{timeAgo(w.last_heartbeat)}</span>
                <span className={w.is_healthy ? 'sys-tag-ok' : 'sys-tag-err'}>{w.status || (w.is_healthy ? 'Healthy' : 'Stale')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Database Stats */}
      <div className="sys-section">
        <h2 className="sys-section-title"><Database size={16} />Database</h2>
        <div className="sys-stat-grid">
          <div className="sys-stat"><span className="sys-stat-val">{data.database.active_tenants}</span><span className="sys-stat-lbl">Tenants</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.database.active_users}</span><span className="sys-stat-lbl">Users</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.database.monitored_devices}</span><span className="sys-stat-lbl">Devices</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.database.total_tickets}</span><span className="sys-stat-lbl">Tickets</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.database.audit_entries}</span><span className="sys-stat-lbl">Audit Entries</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.database.size || 'N/A'}</span><span className="sys-stat-lbl">DB Size</span></div>
        </div>
      </div>

      {/* Alert Stats */}
      <div className="sys-section">
        <h2 className="sys-section-title"><Bell size={16} />Alerts (Last 24h / 7d)</h2>
        <div className="sys-stat-grid">
          <div className="sys-stat"><span className="sys-stat-val">{data.alerts.alerts_24h || 0}</span><span className="sys-stat-lbl">24h New</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.alerts.alerts_7d || 0}</span><span className="sys-stat-lbl">7d New</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.alerts.active || 0}</span><span className="sys-stat-lbl">Active</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.alerts.acknowledged || 0}</span><span className="sys-stat-lbl">Ack'd</span></div>
          <div className="sys-stat"><span className="sys-stat-val">{data.alerts.resolved_24h || 0}</span><span className="sys-stat-lbl">Resolved 24h</span></div>
        </div>
      </div>

      {/* Sync Status per Tenant */}
      <div className="sys-section">
        <h2 className="sys-section-title"><RefreshCw size={16} />Sync Status</h2>
        <div className="sys-sync-table">
          <table className="sys-table">
            <thead><tr><th>Tenant</th><th>Devices</th><th>Last Device Sync</th><th>Last Ticket Sync</th></tr></thead>
            <tbody>
              {data.sync.map(s => (
                <tr key={s.slug}>
                  <td className="sys-sync-name">{s.tenant_name}</td>
                  <td>{s.device_count}</td>
                  <td><span className="sys-sync-time">{timeAgo(s.last_device_sync)}</span></td>
                  <td><span className="sys-sync-time">{timeAgo(s.last_ticket_sync)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style>{css}</style>
    </div>
  );
}

const css = `
  .sys-page { max-width:900px; margin:0 auto; padding:32px 24px; }
  .sys-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
  .sys-title { font-size:20px; font-weight:600; color:${V('text')}; margin:0 0 4px; }
  .sys-subtitle { font-size:13px; color:${V('text-muted')}; margin:0; }
  .sys-refresh { display:flex; align-items:center; gap:6px; padding:7px 14px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; font-size:13px; cursor:pointer; font-family:inherit; }

  .sys-section { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:10px; padding:20px; margin-bottom:16px; }
  .sys-section-title { font-size:14px; font-weight:500; color:${V('text')}; margin:0 0 16px; display:flex; align-items:center; gap:8px; }

  .sys-worker-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; }
  .sys-worker { padding:14px; border-radius:8px; border:1px solid ${V('border')}; }
  .sys-worker-ok { border-left:3px solid #1D9E75; }
  .sys-worker-err { border-left:3px solid #E24B4A; }
  .sys-worker-head { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
  .sys-worker-name { font-size:13px; font-weight:500; color:${V('text')}; }
  .sys-worker-meta { display:flex; justify-content:space-between; align-items:center; font-size:11px; color:${V('text-muted')}; }
  .sys-worker-meta span { display:flex; align-items:center; gap:4px; }
  .sys-tag-ok { color:#1D9E75; background:rgba(29,158,117,0.1); padding:1px 6px; border-radius:4px; }
  .sys-tag-err { color:#E24B4A; background:rgba(226,75,74,0.1); padding:1px 6px; border-radius:4px; }

  .sys-stat-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); gap:10px; }
  .sys-stat { display:flex; flex-direction:column; align-items:center; gap:2px; padding:12px 8px; border-radius:8px; background:${V('surface-raised')}; }
  .sys-stat-val { font-size:20px; font-weight:600; color:${V('text')}; }
  .sys-stat-lbl { font-size:11px; color:${V('text-dim')}; }

  .sys-sync-table { overflow-x:auto; }
  .sys-table { width:100%; border-collapse:collapse; }
  .sys-table th { text-align:left; padding:8px 12px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:${V('text-muted')}; border-bottom:1px solid ${V('border')}; }
  .sys-table td { padding:8px 12px; font-size:13px; color:${V('text')}; border-bottom:1px solid rgba(255,255,255,0.03); }
  .sys-sync-name { font-weight:500; }
  .sys-sync-time { font-size:12px; color:${V('text-muted')}; font-family:monospace; }

  .sys-loading { padding:60px 0; text-align:center; font-size:13px; color:${V('text-muted')}; }
  .sys-denied { text-align:center; padding:80px 24px; }
  .sys-denied h2 { font-size:18px; font-weight:600; color:${V('text')}; margin:0; }
  .sys-empty { font-size:13px; color:${V('text-muted')}; margin:0; }
`;