/**
 * VEMIO™ — MSP Admin: Tenant Management
 * Route: /admin/tenants
 * Access: MSP only
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Building2, Users, Monitor, AlertTriangle, MapPin, Plus, X, Pencil } from 'lucide-react';

const V = (n) => `var(--color-vemio-${n}, var(--vemio-${n}))`;
const PLAN_COLORS = { essentials: '#378ADD', professional: '#C89700', command: '#1D9E75' };

export default function AdminTenantsPage() {
  const { data: session } = useSession();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [createForm, setCreateForm] = useState({ name: '', slug: '', vemio_plan: 'essentials', sla_uptime_target: 99.5, primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tenants');
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch { setTenants([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const showMsg = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 4000); };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.slug) { showMsg('error', 'Name and slug are required'); return; }
    try {
      const res = await fetch('/api/admin/tenants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg('success', `Tenant "${data.tenant.name}" created`);
      setShowCreate(false);
      setCreateForm({ name: '', slug: '', vemio_plan: 'essentials', sla_uptime_target: 99.5, primary_contact_name: '', primary_contact_email: '', primary_contact_phone: '' });
      fetchTenants();
    } catch (err) { showMsg('error', err.message); }
  };

  const handleEdit = async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg('success', `Tenant updated`);
      setEditId(null);
      fetchTenants();
    } catch (err) { showMsg('error', err.message); }
  };

  const startEdit = (t) => {
    setEditId(t.id);
    setEditForm({ name: t.name, vemio_plan: t.vemio_plan, sla_uptime_target: t.sla_uptime_target, primary_contact_name: t.primary_contact_name || '', primary_contact_email: t.primary_contact_email || '', primary_contact_phone: t.primary_contact_phone || '', is_active: t.is_active });
  };

  if (!session?.user?.isMSP) {
    return <div className="adm-page"><div className="adm-denied"><h2>MSP Access Required</h2></div><style>{css}</style></div>;
  }

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div>
          <h1 className="adm-title">Tenant Management</h1>
          <p className="adm-subtitle">{tenants.length} active tenants</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="adm-btn-primary"><Plus size={16} />New Tenant</button>
      </div>

      {message.text && <div className={`adm-msg adm-msg-${message.type}`}>{message.text}</div>}

      {loading ? <div className="adm-loading">Loading tenants...</div> : (
        <div className="ten-grid">
          {tenants.map(t => (
            <div key={t.id} className="ten-card">
              <div className="ten-card-header">
                <div>
                  <h3 className="ten-name">{t.name}</h3>
                  <span className="ten-slug">/{t.slug}</span>
                </div>
                <div className="ten-header-right">
                  <span className="ten-plan" style={{ color: PLAN_COLORS[t.vemio_plan] || '#888', background: (PLAN_COLORS[t.vemio_plan] || '#888') + '18' }}>{t.vemio_plan}</span>
                  <button onClick={() => startEdit(t)} className="ten-edit-btn"><Pencil size={13} /></button>
                </div>
              </div>
              <div className="ten-stats">
                <div className="ten-stat"><Users size={14} /><span>{t.user_count}</span><span className="ten-stat-label">Users</span></div>
                <div className="ten-stat"><Monitor size={14} /><span>{t.device_count}</span><span className="ten-stat-label">Devices</span></div>
                <div className="ten-stat"><AlertTriangle size={14} /><span>{t.active_alerts}</span><span className="ten-stat-label">Alerts</span></div>
                <div className="ten-stat"><MapPin size={14} /><span>{t.site_count}</span><span className="ten-stat-label">Sites</span></div>
              </div>
              <div className="ten-meta">
                <span>SLA Target: {t.sla_uptime_target}%</span>
                {t.primary_contact_name && <span>Contact: {t.primary_contact_name}</span>}
                {t.sso_config?.enabled && <span className="ten-sso-tag">SSO Active</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editId && (
        <div className="adm-modal-bg" onClick={() => setEditId(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-header"><h3>Edit Tenant</h3><button onClick={() => setEditId(null)} className="adm-modal-close"><X size={16} /></button></div>
            <div className="adm-modal-form">
              <div className="adm-form-field"><label>Name</label><input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Plan</label><select value={editForm.vemio_plan} onChange={e => setEditForm(p => ({ ...p, vemio_plan: e.target.value }))} className="adm-modal-input"><option value="essentials">Essentials</option><option value="professional">Professional</option><option value="command">Command</option></select></div>
              <div className="adm-form-field"><label>SLA Target (%)</label><input type="number" step="0.01" value={editForm.sla_uptime_target} onChange={e => setEditForm(p => ({ ...p, sla_uptime_target: parseFloat(e.target.value) }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Contact Name</label><input type="text" value={editForm.primary_contact_name} onChange={e => setEditForm(p => ({ ...p, primary_contact_name: e.target.value }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Contact Email</label><input type="email" value={editForm.primary_contact_email} onChange={e => setEditForm(p => ({ ...p, primary_contact_email: e.target.value }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Contact Phone</label><input type="text" value={editForm.primary_contact_phone} onChange={e => setEditForm(p => ({ ...p, primary_contact_phone: e.target.value }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Active</label><select value={editForm.is_active ? 'true' : 'false'} onChange={e => setEditForm(p => ({ ...p, is_active: e.target.value === 'true' }))} className="adm-modal-input"><option value="true">Active</option><option value="false">Suspended</option></select></div>
            </div>
            <div className="adm-modal-actions">
              <button onClick={() => setEditId(null)} className="adm-btn-secondary">Cancel</button>
              <button onClick={handleEdit} className="adm-btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="adm-modal-bg" onClick={() => setShowCreate(false)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-header"><h3>Create Tenant</h3><button onClick={() => setShowCreate(false)} className="adm-modal-close"><X size={16} /></button></div>
            <div className="adm-modal-form">
              <div className="adm-form-field"><label>Organization Name</label><input type="text" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Acme Corp" className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Slug (URL identifier)</label><input type="text" value={createForm.slug} onChange={e => setCreateForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="e.g. acme-corp" className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Plan</label><select value={createForm.vemio_plan} onChange={e => setCreateForm(p => ({ ...p, vemio_plan: e.target.value }))} className="adm-modal-input"><option value="essentials">Essentials</option><option value="professional">Professional</option><option value="command">Command</option></select></div>
              <div className="adm-form-field"><label>SLA Target (%)</label><input type="number" step="0.01" value={createForm.sla_uptime_target} onChange={e => setCreateForm(p => ({ ...p, sla_uptime_target: parseFloat(e.target.value) }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Contact Name</label><input type="text" value={createForm.primary_contact_name} onChange={e => setCreateForm(p => ({ ...p, primary_contact_name: e.target.value }))} className="adm-modal-input" /></div>
              <div className="adm-form-field"><label>Contact Email</label><input type="email" value={createForm.primary_contact_email} onChange={e => setCreateForm(p => ({ ...p, primary_contact_email: e.target.value }))} className="adm-modal-input" /></div>
            </div>
            <div className="adm-modal-actions">
              <button onClick={() => setShowCreate(false)} className="adm-btn-secondary">Cancel</button>
              <button onClick={handleCreate} className="adm-btn-primary">Create Tenant</button>
            </div>
          </div>
        </div>
      )}

      <style>{css}</style>
    </div>
  );
}

const css = `
  .adm-page { max-width:1000px; margin:0 auto; padding:32px 24px; }
  .adm-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:16px; }
  .adm-title { font-size:20px; font-weight:600; color:${V('text')}; margin:0 0 4px; }
  .adm-subtitle { font-size:13px; color:${V('text-muted')}; margin:0; }
  .adm-btn-primary { display:flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px; border:none; background:#C89700; color:#0C0C0E; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; }
  .adm-btn-secondary { padding:8px 16px; border-radius:8px; border:1px solid ${V('border')}; background:transparent; color:${V('text')}; font-size:13px; cursor:pointer; font-family:inherit; }
  .adm-msg { padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:16px; }
  .adm-msg-success { background:rgba(29,158,117,0.08); border:1px solid rgba(29,158,117,0.2); color:#1D9E75; }
  .adm-msg-error { background:rgba(226,75,74,0.08); border:1px solid rgba(226,75,74,0.2); color:#E24B4A; }
  .adm-loading { padding:60px 0; text-align:center; font-size:13px; color:${V('text-muted')}; }
  .adm-denied { text-align:center; padding:80px 24px; }
  .adm-denied h2 { font-size:18px; font-weight:600; color:${V('text')}; margin:0; }

  .ten-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px; }
  .ten-card { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:10px; padding:20px; transition:border-color 0.15s; }
  .ten-card:hover { border-color:rgba(255,255,255,0.12); }
  .ten-card-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; }
  .ten-name { font-size:15px; font-weight:600; color:${V('text')}; margin:0 0 2px; }
  .ten-slug { font-size:11px; color:${V('text-dim')}; font-family:monospace; }
  .ten-header-right { display:flex; align-items:center; gap:6px; }
  .ten-plan { font-size:10px; font-weight:600; padding:3px 8px; border-radius:5px; text-transform:uppercase; letter-spacing:0.04em; }
  .ten-edit-btn { width:26px; height:26px; border-radius:6px; border:1px solid ${V('border')}; background:transparent; color:${V('text-muted')}; cursor:pointer; display:flex; align-items:center; justify-content:center; }
  .ten-edit-btn:hover { background:${V('surface-raised')}; }

  .ten-stats { display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:12px; }
  .ten-stat { display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 4px; border-radius:6px; background:${V('surface-raised')}; color:${V('text')}; font-size:15px; font-weight:600; }
  .ten-stat svg { color:${V('text-dim')}; }
  .ten-stat-label { font-size:10px; font-weight:400; color:${V('text-dim')}; }

  .ten-meta { display:flex; flex-wrap:wrap; gap:8px; font-size:11px; color:${V('text-muted')}; }
  .ten-sso-tag { color:#1D9E75; background:rgba(29,158,117,0.1); padding:1px 6px; border-radius:4px; }

  .adm-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:100; padding:24px; }
  .adm-modal { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:12px; padding:24px; width:100%; max-width:480px; max-height:90vh; overflow-y:auto; }
  .adm-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .adm-modal-header h3 { font-size:16px; font-weight:600; color:${V('text')}; margin:0; }
  .adm-modal-close { background:none; border:none; color:${V('text-muted')}; cursor:pointer; padding:4px; }
  .adm-modal-input { width:100%; padding:9px 12px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface-raised')}; color:${V('text')}; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; }
  .adm-modal-input:focus { border-color:var(--color-vemio-amber, #C89700); }
  .adm-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:20px; }
  .adm-modal-form { display:flex; flex-direction:column; gap:14px; }
  .adm-form-field { display:flex; flex-direction:column; gap:5px; }
  .adm-form-field label { font-size:12px; font-weight:500; color:${V('text-muted')}; text-transform:uppercase; letter-spacing:0.04em; }
`;