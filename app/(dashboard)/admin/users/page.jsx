/**
 * VEMIO™ — MSP Admin: User Management
 * Route: /admin/users
 * Access: MSP only (isMSP === true)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { UserPlus, Search, Shield, Eye, Key, UserX, UserCheck, X } from 'lucide-react';

const V = (n) => `var(--color-vemio-${n}, var(--vemio-${n}))`;

const ROLE_LABELS = { admin: 'Admin', viewer: 'Viewer', site_manager: 'Site Manager', security_officer: 'Security Officer', executive: 'Executive' };
const ROLE_COLORS = { admin: '#C89700', viewer: '#378ADD', site_manager: '#1D9E75', security_officer: '#D85A30', executive: '#7F77DD' };

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [filter, setFilter] = useState({ tenant_id: '', role: '', search: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [resetId, setResetId] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [createForm, setCreateForm] = useState({ tenant_id: '', email: '', name: '', role: 'viewer', password: '' });
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.tenant_id) params.set('tenant_id', filter.tenant_id);
    if (filter.role) params.set('role', filter.role);
    if (filter.search) params.set('search', filter.search);
    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch { setUsers([]); }
    setLoading(false);
  }, [filter]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/tenants');
      const data = await res.json();
      setTenants(data.tenants || []);
    } catch { setTenants([]); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const showMsg = (type, text) => { setMessage({ type, text }); setTimeout(() => setMessage({ type: '', text: '' }), 4000); };

  const handleCreate = async () => {
    if (!createForm.tenant_id || !createForm.email || !createForm.name || !createForm.password) {
      showMsg('error', 'All fields are required'); return;
    }
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg('success', `User ${data.user.email} created in ${data.tenant}`);
      setShowCreate(false);
      setCreateForm({ tenant_id: '', email: '', name: '', role: 'viewer', password: '' });
      fetchUsers();
    } catch (err) { showMsg('error', err.message); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showMsg('success', `Role updated to ${ROLE_LABELS[newRole]}`);
      setEditingId(null);
      fetchUsers();
    } catch (err) { showMsg('error', err.message); }
  };

  const handleResetPassword = async (userId) => {
    if (!newPassword || newPassword.length < 8) { showMsg('error', 'Password must be at least 8 characters'); return; }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: newPassword }) });
      if (!res.ok) throw new Error('Failed to reset password');
      showMsg('success', 'Password reset successfully');
      setResetId(null);
      setNewPassword('');
    } catch (err) { showMsg('error', err.message); }
  };

  const handleToggleActive = async (userId, currentlyActive) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !currentlyActive }) });
      if (!res.ok) throw new Error('Failed to update');
      showMsg('success', currentlyActive ? 'User deactivated' : 'User reactivated');
      fetchUsers();
    } catch (err) { showMsg('error', err.message); }
  };

  if (!session?.user?.isMSP) {
    return <div className="adm-page"><div className="adm-denied"><h2>MSP Access Required</h2><p>This page is only available to MSP administrators.</p></div><style>{css}</style></div>;
  }

  return (
    <div className="adm-page">
      <div className="adm-header">
        <div>
          <h1 className="adm-title">User Management</h1>
          <p className="adm-subtitle">{users.length} users across {tenants.length} tenants</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="adm-btn-primary"><UserPlus size={16} />Create User</button>
      </div>

      {message.text && <div className={`adm-msg adm-msg-${message.type}`}>{message.text}</div>}

      {/* Filters */}
      <div className="adm-filters">
        <div className="adm-search-wrap">
          <Search size={14} className="adm-search-icon" />
          <input type="text" placeholder="Search by name or email..." value={filter.search} onChange={e => setFilter(p => ({ ...p, search: e.target.value }))} className="adm-search" />
        </div>
        <select value={filter.tenant_id} onChange={e => setFilter(p => ({ ...p, tenant_id: e.target.value }))} className="adm-select">
          <option value="">All tenants</option>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={filter.role} onChange={e => setFilter(p => ({ ...p, role: e.target.value }))} className="adm-select">
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="adm-table-wrap">
        {loading ? (
          <div className="adm-loading">Loading users...</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Tenant</th>
                <th>Role</th>
                <th>Auth</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={!u.is_active ? 'adm-row-inactive' : ''}>
                  <td>
                    <div className="adm-user-cell">
                      <span className="adm-user-name">{u.name}</span>
                      <span className="adm-user-email">{u.email}</span>
                    </div>
                  </td>
                  <td><span className="adm-tenant-badge">{u.tenant_name}</span></td>
                  <td>
                    {editingId === u.id ? (
                      <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)} onBlur={() => setEditingId(null)} autoFocus className="adm-role-select">
                        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span className="adm-role-badge" style={{ color: ROLE_COLORS[u.role] || '#888', background: (ROLE_COLORS[u.role] || '#888') + '18' }} onClick={() => setEditingId(u.id)}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    )}
                  </td>
                  <td><span className="adm-auth-tag">{u.auth_provider || 'credentials'}</span></td>
                  <td><span className="adm-date">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}</span></td>
                  <td>
                    <span className={`adm-status ${u.is_active ? 'adm-status-active' : 'adm-status-inactive'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="adm-actions">
                      <button onClick={() => setEditingId(u.id)} title="Change role" className="adm-action-btn"><Shield size={14} /></button>
                      <button onClick={() => { setResetId(u.id); setNewPassword(''); }} title="Reset password" className="adm-action-btn"><Key size={14} /></button>
                      <button onClick={() => handleToggleActive(u.id, u.is_active)} title={u.is_active ? 'Deactivate' : 'Reactivate'} className="adm-action-btn">
                        {u.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Password Reset Modal */}
      {resetId && (
        <div className="adm-modal-bg" onClick={() => setResetId(null)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-header"><h3>Reset Password</h3><button onClick={() => setResetId(null)} className="adm-modal-close"><X size={16} /></button></div>
            <p className="adm-modal-desc">Set a new password for {users.find(u => u.id === resetId)?.email}</p>
            <input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" className="adm-modal-input" />
            <div className="adm-modal-actions">
              <button onClick={() => setResetId(null)} className="adm-btn-secondary">Cancel</button>
              <button onClick={() => handleResetPassword(resetId)} className="adm-btn-primary">Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <div className="adm-modal-bg" onClick={() => setShowCreate(false)}>
          <div className="adm-modal" onClick={e => e.stopPropagation()}>
            <div className="adm-modal-header"><h3>Create User</h3><button onClick={() => setShowCreate(false)} className="adm-modal-close"><X size={16} /></button></div>
            <div className="adm-modal-form">
              <div className="adm-form-field">
                <label>Tenant</label>
                <select value={createForm.tenant_id} onChange={e => setCreateForm(p => ({ ...p, tenant_id: e.target.value }))} className="adm-modal-input">
                  <option value="">Select tenant...</option>
                  {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="adm-form-field">
                <label>Name</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))} placeholder="Full name" className="adm-modal-input" />
              </div>
              <div className="adm-form-field">
                <label>Email</label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))} placeholder="user@company.com" className="adm-modal-input" />
              </div>
              <div className="adm-form-field">
                <label>Role</label>
                <select value={createForm.role} onChange={e => setCreateForm(p => ({ ...p, role: e.target.value }))} className="adm-modal-input">
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="adm-form-field">
                <label>Password</label>
                <input type="text" value={createForm.password} onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))} placeholder="Temporary password" className="adm-modal-input" />
              </div>
            </div>
            <div className="adm-modal-actions">
              <button onClick={() => setShowCreate(false)} className="adm-btn-secondary">Cancel</button>
              <button onClick={handleCreate} className="adm-btn-primary">Create User</button>
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

  .adm-filters { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .adm-search-wrap { position:relative; flex:1; min-width:200px; }
  .adm-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:${V('text-dim')}; }
  .adm-search { width:100%; padding:8px 12px 8px 32px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; }
  .adm-search:focus { border-color:var(--color-vemio-amber, #C89700); }
  .adm-select { padding:8px 12px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface')}; color:${V('text')}; font-size:13px; font-family:inherit; }

  .adm-table-wrap { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:10px; overflow:hidden; overflow-x:auto; }
  .adm-table { width:100%; border-collapse:collapse; }
  .adm-table th { text-align:left; padding:10px 14px; font-size:11px; font-weight:600; letter-spacing:0.04em; text-transform:uppercase; color:${V('text-muted')}; border-bottom:1px solid ${V('border')}; white-space:nowrap; }
  .adm-table td { padding:10px 14px; font-size:13px; color:${V('text')}; border-bottom:1px solid rgba(255,255,255,0.03); vertical-align:middle; }
  .adm-row-inactive { opacity:0.5; }

  .adm-user-cell { display:flex; flex-direction:column; gap:1px; }
  .adm-user-name { font-weight:500; }
  .adm-user-email { font-size:11px; color:${V('text-muted')}; }
  .adm-tenant-badge { font-size:11px; padding:2px 8px; border-radius:4px; background:${V('surface-raised')}; color:${V('text-muted')}; white-space:nowrap; }
  .adm-role-badge { font-size:11px; font-weight:500; padding:3px 8px; border-radius:5px; cursor:pointer; white-space:nowrap; }
  .adm-role-select { padding:4px 8px; border-radius:5px; border:1px solid #C89700; background:${V('surface')}; color:${V('text')}; font-size:12px; font-family:inherit; }
  .adm-auth-tag { font-size:11px; color:${V('text-dim')}; font-family:monospace; }
  .adm-date { font-size:12px; color:${V('text-muted')}; white-space:nowrap; }

  .adm-status { font-size:11px; font-weight:500; padding:2px 8px; border-radius:4px; }
  .adm-status-active { color:#1D9E75; background:rgba(29,158,117,0.1); }
  .adm-status-inactive { color:#E24B4A; background:rgba(226,75,74,0.1); }

  .adm-actions { display:flex; gap:4px; }
  .adm-action-btn { width:28px; height:28px; border-radius:6px; border:1px solid ${V('border')}; background:transparent; color:${V('text-muted')}; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
  .adm-action-btn:hover { background:${V('surface-raised')}; color:${V('text')}; }

  .adm-loading { padding:60px 0; text-align:center; font-size:13px; color:${V('text-muted')}; }
  .adm-denied { text-align:center; padding:80px 24px; }
  .adm-denied h2 { font-size:18px; font-weight:600; color:${V('text')}; margin:0 0 8px; }
  .adm-denied p { font-size:13px; color:${V('text-muted')}; margin:0; }

  /* Modal */
  .adm-modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:100; padding:24px; }
  .adm-modal { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:12px; padding:24px; width:100%; max-width:440px; }
  .adm-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
  .adm-modal-header h3 { font-size:16px; font-weight:600; color:${V('text')}; margin:0; }
  .adm-modal-close { background:none; border:none; color:${V('text-muted')}; cursor:pointer; padding:4px; }
  .adm-modal-desc { font-size:13px; color:${V('text-muted')}; margin:0 0 16px; }
  .adm-modal-input { width:100%; padding:9px 12px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface-raised')}; color:${V('text')}; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; }
  .adm-modal-input:focus { border-color:var(--color-vemio-amber, #C89700); }
  .adm-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:20px; }
  .adm-modal-form { display:flex; flex-direction:column; gap:14px; }
  .adm-form-field { display:flex; flex-direction:column; gap:5px; }
  .adm-form-field label { font-size:12px; font-weight:500; color:${V('text-muted')}; text-transform:uppercase; letter-spacing:0.04em; }
`;