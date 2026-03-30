/**
 * VEMIO™ — MSP Admin: Device Operations
 * Route: /admin/devices
 * Access: MSP only
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Monitor, Search, AlertTriangle, Trash2, EyeOff, Eye, RefreshCw, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';

const V = (n) => `var(--color-vemio-${n}, var(--vemio-${n}))`;
const STATUS_COLORS = { up: '#1D9E75', down: '#E24B4A', degraded: '#EF9F27', unknown: '#888' };

export default function AdminDevicesPage() {
  const { data: session } = useSession();
  const [data, setData] = useState({ devices: [], pagination: {}, stats: {}, duplicates: [] });
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState({ tenant_id: '', status: '', search: '', is_monitored: '', category: 'network' });
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 50 });
    Object.entries(filter).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res = await fetch(`/api/admin/devices?${params}`);
      const d = await res.json();
      setData(d);
    } catch { setData({ devices: [], pagination: {}, stats: {}, duplicates: [] }); }
    setLoading(false);
  }, [filter, page]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tenants');
      const d = await res.json();
      setTenants(d.tenants || []);
    } catch { setTenants([]); }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const showMsg = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 4000); };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === devices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(devices.map(d => d.id)));
    }
  };

  const handleBulkAction = async (action) => {
    const ids = Array.from(selected);
    if (ids.length === 0) { showMsg('error', 'No devices selected'); return; }

    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, device_ids: ids }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg('success', `${action === 'delete' ? 'Deleted' : 'Updated'} ${d.updated || d.deleted} device(s)`);
      setSelected(new Set());
      setConfirmAction(null);
      fetchDevices();
    } catch (err) { showMsg('error', err.message); }
  };

  const handleDeleteDuplicates = async (keepFirst, deviceIds) => {
    const idsToDelete = deviceIds.slice(1); // Keep first, delete rest
    try {
      const res = await fetch('/api/admin/devices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', device_ids: idsToDelete }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      showMsg('success', `Removed ${d.deleted} duplicate(s)`);
      fetchDevices();
    } catch (err) { showMsg('error', err.message); }
  };

  if (!session?.user?.isMSP) {
    return <div className="dev-page"><div className="dev-denied"><h2>MSP Access Required</h2></div><style>{css}</style></div>;
  }

  const pagination = data.pagination || {};
  const stats = data.stats || {};
  const duplicates = data.duplicates || [];
  const devices = data.devices || [];

  return (
    <div className="dev-page">
      <div className="dev-header">
        <div>
          <h1 className="dev-title">Device Operations</h1>
          <p className="dev-subtitle">Cross-tenant device management and cleanup</p>
        </div>
        <div className="dev-header-actions">
          {duplicates.length > 0 && (
            <button onClick={() => setShowDuplicates(true)} className="dev-dup-btn">
              <Copy size={14} />{duplicates.length} Duplicate Groups
            </button>
          )}
          <button onClick={fetchDevices} className="dev-refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      {message.text && <div className={`dev-msg dev-msg-${message.type}`}>{message.text}</div>}

      {/* Stats bar */}
      <div className="dev-stats">
        <div className="dev-stat"><span className="dev-stat-val">{stats.total_devices || 0}</span><span className="dev-stat-lbl">Total</span></div>
        <div className="dev-stat"><span className="dev-stat-val" style={{ color: '#1D9E75' }}>{stats.online || 0}</span><span className="dev-stat-lbl">Online</span></div>
        <div className="dev-stat"><span className="dev-stat-val" style={{ color: '#E24B4A' }}>{stats.offline || 0}</span><span className="dev-stat-lbl">Offline</span></div>
        <div className="dev-stat"><span className="dev-stat-val" style={{ color: '#EF9F27' }}>{stats.degraded || 0}</span><span className="dev-stat-lbl">Degraded</span></div>
        <div className="dev-stat"><span className="dev-stat-val">{stats.monitored || 0}</span><span className="dev-stat-lbl">Monitored</span></div>
        <div className="dev-stat"><span className="dev-stat-val">{stats.not_monitored || 0}</span><span className="dev-stat-lbl">Excluded</span></div>
      </div>

      {/* Filters */}
      <div className="dev-filters">
        {/* Network/All toggle */}
        <div className="dev-cat-toggle">
          <button onClick={() => { setFilter(p => ({ ...p, category: 'network' })); setPage(1); }} className={`dev-cat-btn ${filter.category === 'network' ? 'dev-cat-btn-active' : ''}`}>Network</button>
          <button onClick={() => { setFilter(p => ({ ...p, category: 'all' })); setPage(1); }} className={`dev-cat-btn ${filter.category === 'all' ? 'dev-cat-btn-active' : ''}`}>All</button>
        </div>
        <div className="dev-search-wrap">
          <Search size={14} className="dev-search-icon" />
          <input type="text" placeholder="Search name, IP, or model..." value={filter.search} onChange={e => { setFilter(p => ({ ...p, search: e.target.value })); setPage(1); }} className="dev-search" />
        </div>
        <select value={filter.tenant_id} onChange={e => { setFilter(p => ({ ...p, tenant_id: e.target.value })); setPage(1); }} className="dev-select">
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filter.status} onChange={e => { setFilter(p => ({ ...p, status: e.target.value })); setPage(1); }} className="dev-select">
          <option value="">All statuses</option>
          <option value="up">Online</option>
          <option value="down">Offline</option>
          <option value="degraded">Degraded</option>
        </select>
        <select value={filter.is_monitored} onChange={e => { setFilter(p => ({ ...p, is_monitored: e.target.value })); setPage(1); }} className="dev-select">
          <option value="">All</option>
          <option value="true">Monitored</option>
          <option value="false">Excluded</option>
        </select>
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="dev-bulk-bar">
          <span className="dev-bulk-count">{selected.size} selected</span>
          <button onClick={() => handleBulkAction('set_monitored')} className="dev-bulk-btn"><Eye size={13} />Set Monitored</button>
          <button onClick={() => handleBulkAction('set_not_monitored')} className="dev-bulk-btn"><EyeOff size={13} />Exclude</button>
          <button onClick={() => setConfirmAction('delete')} className="dev-bulk-btn dev-bulk-btn-danger"><Trash2 size={13} />Delete</button>
          <button onClick={() => setSelected(new Set())} className="dev-bulk-btn">Clear</button>
        </div>
      )}

      {/* Device table */}
      <div className="dev-table-wrap">
        {loading ? <div className="dev-loading">Loading devices...</div> : (
          <table className="dev-table">
            <thead>
              <tr>
                <th><input type="checkbox" checked={selected.size === devices.length && devices.length > 0} onChange={toggleSelectAll} /></th>
                <th>Device</th>
                <th>Tenant</th>
                <th>Type</th>
                <th>IP Address</th>
                <th>Status</th>
                <th>Monitored</th>
                <th>Site</th>
              </tr>
            </thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id} className={selected.has(d.id) ? 'dev-row-sel' : ''}>
                  <td><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} /></td>
                  <td>
                    <div className="dev-device-cell">
                      <span className="dev-device-name">{d.device_name}</span>
                      <span className="dev-device-model">{d.make_model || ''}</span>
                    </div>
                  </td>
                  <td><span className="dev-tenant-tag">{d.tenant_name}</span></td>
                  <td><span className="dev-type-tag">{d.device_type || 'unknown'}</span></td>
                  <td><span className="dev-ip">{d.ip_address || ''}</span></td>
                  <td>
                    <span className="dev-status" style={{ color: STATUS_COLORS[d.status] || '#888', background: (STATUS_COLORS[d.status] || '#888') + '18' }}>
                      {d.status}
                    </span>
                  </td>
                  <td>
                    <span className={d.is_monitored ? 'dev-mon-yes' : 'dev-mon-no'}>
                      {d.is_monitored ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td><span className="dev-site">{d.site_name || ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="dev-pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="dev-page-btn"><ChevronLeft size={14} /></button>
          <span className="dev-page-info">Page {page} of {pagination.pages} ({pagination.total} devices)</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages} className="dev-page-btn"><ChevronRight size={14} /></button>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmAction === 'delete' && (
        <div className="dev-modal-bg" onClick={() => setConfirmAction(null)}>
          <div className="dev-modal" onClick={e => e.stopPropagation()}>
            <div className="dev-modal-header"><h3>Confirm Delete</h3><button onClick={() => setConfirmAction(null)} className="dev-modal-close"><X size={16} /></button></div>
            <p className="dev-modal-warn"><AlertTriangle size={16} color="#E24B4A" />You are about to permanently delete <strong>{selected.size}</strong> device(s). This cannot be undone. Device history, interfaces, and port data will also be removed.</p>
            <div className="dev-modal-actions">
              <button onClick={() => setConfirmAction(null)} className="dev-btn-secondary">Cancel</button>
              <button onClick={() => handleBulkAction('delete')} className="dev-btn-danger">Delete {selected.size} Device(s)</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates panel */}
      {showDuplicates && (
        <div className="dev-modal-bg" onClick={() => setShowDuplicates(false)}>
          <div className="dev-modal dev-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="dev-modal-header"><h3>Duplicate Devices ({duplicates.length} groups)</h3><button onClick={() => setShowDuplicates(false)} className="dev-modal-close"><X size={16} /></button></div>
            <p className="dev-modal-desc">Devices with the same name within a tenant. Review and remove duplicates.</p>
            <div className="dev-dup-list">
              {duplicates.map((dup, i) => (
                <div key={i} className="dev-dup-item">
                  <div className="dev-dup-info">
                    <span className="dev-dup-name">{dup.device_name}</span>
                    <span className="dev-dup-meta">{dup.tenant_name} &middot; {dup.count} copies</span>
                    <span className="dev-dup-models">Models: {(dup.models || []).join(', ')}</span>
                  </div>
                  <button onClick={() => handleDeleteDuplicates(dup.device_ids[0], dup.device_ids)} className="dev-dup-fix">
                    Keep first, remove {dup.count - 1}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
  .dev-page { max-width:1100px; margin:0 auto; padding:32px 24px; }
  .dev-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; flex-wrap:wrap; gap:12px; }
  .dev-title { font-size:20px; font-weight:600; color:${V('text')}; margin:0 0 4px; }
  .dev-subtitle { font-size:13px; color:${V('text-muted')}; margin:0; }
  .dev-header-actions { display:flex; gap:8px; align-items:center; }
  .dev-refresh { width:32px; height:32px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text-muted')}; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .dev-dup-btn { display:flex; align-items:center; gap:6px; padding:7px 12px; border-radius:7px; border:1px solid rgba(239,159,39,0.3); background:rgba(239,159,39,0.08); color:#EF9F27; font-size:12px; font-weight:500; cursor:pointer; font-family:inherit; }

  .dev-msg { padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; }
  .dev-msg-success { background:rgba(29,158,117,0.08); border:1px solid rgba(29,158,117,0.2); color:#1D9E75; }
  .dev-msg-error { background:rgba(226,75,74,0.08); border:1px solid rgba(226,75,74,0.2); color:#E24B4A; }

  .dev-stats { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .dev-stat { display:flex; flex-direction:column; align-items:center; gap:1px; padding:10px 16px; border-radius:8px; background:${V('surface')}; border:1px solid ${V('border')}; min-width:80px; }
  .dev-stat-val { font-size:18px; font-weight:600; color:${V('text')}; }
  .dev-stat-lbl { font-size:10px; color:${V('text-dim')}; }

  .dev-filters { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap; align-items:center; }
  .dev-cat-toggle { display:flex; border-radius:7px; border:1px solid ${V('border')}; overflow:hidden; flex-shrink:0; }
  .dev-cat-btn { padding:7px 14px; font-size:12px; font-weight:500; border:none; cursor:pointer; font-family:inherit; background:${V('surface')}; color:${V('text-muted')}; transition:all 0.15s; }
  .dev-cat-btn-active { background:var(--color-vemio-amber, #C89700); color:#0C0C0E; }
  .dev-search-wrap { position:relative; flex:1; min-width:200px; }
  .dev-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${V('text-dim')}; }
  .dev-search { width:100%; padding:8px 12px 8px 32px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; }
  .dev-search:focus { border-color:var(--color-vemio-amber, #C89700); }
  .dev-select { padding:8px 12px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; font-size:13px; font-family:inherit; }

  .dev-bulk-bar { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:8px; background:rgba(200,151,0,0.08); border:1px solid rgba(200,151,0,0.2); margin-bottom:12px; flex-wrap:wrap; }
  .dev-bulk-count { font-size:13px; font-weight:500; color:#C89700; margin-right:8px; }
  .dev-bulk-btn { display:flex; align-items:center; gap:4px; padding:5px 10px; border-radius:6px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; font-size:12px; cursor:pointer; font-family:inherit; }
  .dev-bulk-btn:hover { background:${V('surface-raised')}; }
  .dev-bulk-btn-danger { border-color:rgba(226,75,74,0.3); color:#E24B4A; }
  .dev-bulk-btn-danger:hover { background:rgba(226,75,74,0.08); }

  .dev-table-wrap { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:10px; overflow:hidden; overflow-x:auto; }
  .dev-table { width:100%; border-collapse:collapse; }
  .dev-table th { text-align:left; padding:8px 12px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:${V('text-muted')}; border-bottom:1px solid ${V('border')}; white-space:nowrap; }
  .dev-table td { padding:8px 12px; font-size:13px; color:${V('text')}; border-bottom:1px solid rgba(255,255,255,0.03); vertical-align:middle; }
  .dev-row-sel { background:rgba(200,151,0,0.05); }
  .dev-table input[type="checkbox"] { accent-color:#C89700; }

  .dev-device-cell { display:flex; flex-direction:column; gap:1px; }
  .dev-device-name { font-weight:500; white-space:nowrap; }
  .dev-device-model { font-size:11px; color:${V('text-dim')}; }
  .dev-tenant-tag { font-size:11px; padding:2px 7px; border-radius:4px; background:${V('surface-raised')}; color:${V('text-muted')}; white-space:nowrap; }
  .dev-type-tag { font-size:11px; color:${V('text-dim')}; text-transform:capitalize; }
  .dev-ip { font-size:12px; font-family:monospace; color:${V('text-muted')}; }
  .dev-status { font-size:11px; font-weight:500; padding:2px 8px; border-radius:5px; text-transform:capitalize; }
  .dev-mon-yes { font-size:11px; color:#1D9E75; }
  .dev-mon-no { font-size:11px; color:${V('text-dim')}; }
  .dev-site { font-size:12px; color:${V('text-muted')}; white-space:nowrap; }

  .dev-pagination { display:flex; justify-content:center; align-items:center; gap:12px; margin-top:16px; }
  .dev-page-btn { width:32px; height:32px; border-radius:6px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .dev-page-btn:disabled { opacity:0.3; cursor:not-allowed; }
  .dev-page-info { font-size:13px; color:${V('text-muted')}; }

  .dev-loading { padding:60px 0; text-align:center; font-size:13px; color:${V('text-muted')}; }
  .dev-denied { text-align:center; padding:80px 24px; }
  .dev-denied h2 { font-size:18px; font-weight:600; color:${V('text')}; margin:0; }

  .dev-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:100; padding:24px; }
  .dev-modal { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:12px; padding:24px; width:100%; max-width:480px; }
  .dev-modal-wide { max-width:640px; max-height:80vh; overflow-y:auto; }
  .dev-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .dev-modal-header h3 { font-size:16px; font-weight:600; color:${V('text')}; margin:0; }
  .dev-modal-close { background:none; border:none; color:${V('text-muted')}; cursor:pointer; padding:4px; }
  .dev-modal-desc { font-size:13px; color:${V('text-muted')}; margin:0 0 16px; }
  .dev-modal-warn { display:flex; align-items:flex-start; gap:8px; font-size:13px; color:#E24B4A; line-height:1.5; margin:0 0 16px; }
  .dev-modal-actions { display:flex; justify-content:flex-end; gap:8px; }
  .dev-btn-secondary { padding:8px 16px; border-radius:8px; border:1px solid ${V('border')}; background:transparent; color:${V('text')}; font-size:13px; cursor:pointer; font-family:inherit; }
  .dev-btn-danger { padding:8px 16px; border-radius:8px; border:none; background:#E24B4A; color:#fff; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }

  .dev-dup-list { display:flex; flex-direction:column; gap:8px; }
  .dev-dup-item { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; border-radius:8px; border:1px solid ${V('border')}; }
  .dev-dup-info { display:flex; flex-direction:column; gap:2px; }
  .dev-dup-name { font-size:13px; font-weight:500; color:${V('text')}; }
  .dev-dup-meta { font-size:11px; color:${V('text-muted')}; }
  .dev-dup-models { font-size:11px; color:${V('text-dim')}; font-family:monospace; }
  .dev-dup-fix { padding:6px 12px; border-radius:6px; border:1px solid rgba(239,159,39,0.3); background:rgba(239,159,39,0.08); color:#EF9F27; font-size:11px; font-weight:500; cursor:pointer; font-family:inherit; white-space:nowrap; }
`;