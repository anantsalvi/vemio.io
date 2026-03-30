/**
 * VEMIO™ — SSO Settings Page
 * Phase 7.1: Tenant admin UI for configuring SSO/SAML.
 * 
 * Route: /settings/sso
 * Access: Admin only
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const PROVIDER_OPTIONS = [
  { value: 'azure-ad', label: 'Microsoft Azure AD', description: 'For organizations using Microsoft 365 or Azure Active Directory' },
  { value: 'google', label: 'Google Workspace', description: 'For organizations using Google Workspace (coming soon)', disabled: true },
  { value: 'okta', label: 'Okta', description: 'For organizations using Okta as their identity provider (coming soon)', disabled: true },
];

export default function SSOSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [config, setConfig] = useState({
    enabled: false,
    provider: '',
    azure_tenant_id: '',
    azure_client_id: '',
    azure_client_secret: '',
    enforce_sso: false,
    auto_provision: true,
    default_role: 'viewer',
    allowed_domains: [],
    has_client_secret: false,
  });

  const [newDomain, setNewDomain] = useState('');

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/sso');
      if (!res.ok) throw new Error('Failed to fetch SSO settings');
      const data = await res.json();
      setConfig(prev => ({ ...prev, ...data, azure_client_secret: '', allowed_domains: data.allowed_domains || [] }));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...config };
      if (!payload.azure_client_secret) delete payload.azure_client_secret;
      delete payload.has_client_secret;
      const res = await fetch('/api/settings/sso', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save SSO settings');
      setSuccess('SSO settings saved successfully');
      setConfig(prev => ({ ...prev, ...data.sso, azure_client_secret: '' }));
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const addDomain = () => {
    const domain = newDomain.toLowerCase().trim();
    if (!domain || !domain.includes('.')) return;
    if (config.allowed_domains.includes(domain)) return;
    setConfig(prev => ({ ...prev, allowed_domains: [...prev.allowed_domains, domain] }));
    setNewDomain('');
  };

  const removeDomain = (domain) => {
    setConfig(prev => ({ ...prev, allowed_domains: prev.allowed_domains.filter(d => d !== domain) }));
  };

  if (!isAdmin) {
    return (<div className="sso-page"><div className="sso-denied"><h2>Access Denied</h2><p>SSO configuration requires admin privileges.</p></div><style>{css}</style></div>);
  }

  if (loading) {
    return (<div className="sso-page"><div className="sso-loading"><div className="sso-dot" /><span>Loading SSO settings...</span></div><style>{css}</style></div>);
  }

  return (
    <div className="sso-page">
      <div className="sso-header">
        <div>
          <h1 className="sso-title">Single Sign-On (SSO)</h1>
          <p className="sso-subtitle">Allow your team to sign in with your organization&apos;s identity provider</p>
        </div>
        {config.enabled && <span className="sso-active-badge"><span className="sso-active-dot" />Active</span>}
      </div>

      {error && <div className="sso-alert sso-alert-err"><span className="sso-alert-icon">!</span>{error}<button onClick={() => setError('')} className="sso-alert-x">&times;</button></div>}
      {success && <div className="sso-alert sso-alert-ok"><span>&#10003;</span>{success}</div>}

      <div className="sso-card">
        <div className="sso-row">
          <div><h3 className="sso-label">Enable SSO</h3><p className="sso-desc">Allow users to sign in with their corporate identity provider</p></div>
          <button onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))} className={`sso-sw ${config.enabled ? 'sso-sw-on' : ''}`}><div className={`sso-sw-k ${config.enabled ? 'sso-sw-k-on' : ''}`} /></button>
        </div>
      </div>

      {config.enabled && (<>
        <div className="sso-card">
          <h3 className="sso-label">Identity Provider</h3>
          <div className="sso-prov-list">
            {PROVIDER_OPTIONS.map(p => (
              <button key={p.value} onClick={() => !p.disabled && setConfig(prev => ({ ...prev, provider: p.value }))} disabled={p.disabled}
                className={`sso-prov ${config.provider === p.value ? 'sso-prov-sel' : ''} ${p.disabled ? 'sso-prov-dis' : ''}`}>
                <span className="sso-prov-name">{p.label}</span>
                <span className="sso-prov-desc">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        {config.provider === 'azure-ad' && (
          <div className="sso-card">
            <h3 className="sso-label">Azure AD Configuration</h3>
            <p className="sso-desc">Register VEMIO as an enterprise application in your Azure AD tenant. Redirect URI: <code className="sso-code">https://vemio.vinayenterprises.co.in/api/auth/callback/azure-ad</code></p>
            <div className="sso-fields">
              <div className="sso-field">
                <label className="sso-flabel">Azure Tenant ID</label>
                <input type="text" value={config.azure_tenant_id} onChange={e => setConfig(prev => ({ ...prev, azure_tenant_id: e.target.value }))} placeholder="e.g. 12345678-abcd-1234-efgh-123456789012" className="sso-input" />
                <span className="sso-hint">Found in Azure Portal &rarr; Azure Active Directory &rarr; Overview</span>
              </div>
              <div className="sso-field">
                <label className="sso-flabel">Application (Client) ID</label>
                <input type="text" value={config.azure_client_id} onChange={e => setConfig(prev => ({ ...prev, azure_client_id: e.target.value }))} placeholder="e.g. 87654321-dcba-4321-hgfe-210987654321" className="sso-input" />
                <span className="sso-hint">Found in Azure Portal &rarr; App Registrations &rarr; Your App &rarr; Overview</span>
              </div>
              <div className="sso-field">
                <label className="sso-flabel">Client Secret {config.has_client_secret && <span className="sso-configured">Configured</span>}</label>
                <input type="password" value={config.azure_client_secret} onChange={e => setConfig(prev => ({ ...prev, azure_client_secret: e.target.value }))} placeholder={config.has_client_secret ? 'Leave blank to keep existing' : 'Paste client secret'} className="sso-input" />
                <span className="sso-hint">Found in Azure Portal &rarr; App Registrations &rarr; Certificates & Secrets</span>
              </div>
            </div>
            <details className="sso-help">
              <summary>Setup instructions for Azure AD</summary>
              <ol className="sso-steps">
                <li>Go to <strong>Azure Portal</strong> &rarr; <strong>Azure Active Directory</strong> &rarr; <strong>App Registrations</strong></li>
                <li>Click <strong>New Registration</strong></li>
                <li>Name: <strong>VEMIO Dashboard</strong></li>
                <li>Supported account types: <strong>Single tenant</strong></li>
                <li>Redirect URI (Web): <code className="sso-code">https://vemio.vinayenterprises.co.in/api/auth/callback/azure-ad</code></li>
                <li>Click <strong>Register</strong>, copy <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></li>
                <li>Go to <strong>Certificates & Secrets</strong> &rarr; <strong>New client secret</strong> &rarr; copy the <strong>Value</strong></li>
                <li>Go to <strong>API Permissions</strong> &rarr; Add <strong>Microsoft Graph</strong> &rarr; <strong>User.Read</strong> (delegated)</li>
                <li>Grant admin consent if required</li>
              </ol>
            </details>
          </div>
        )}

        <div className="sso-card">
          <h3 className="sso-label">Allowed Email Domains</h3>
          <p className="sso-desc">Only users with emails from these domains can use SSO. Leave empty to allow all.</p>
          <div className="sso-domain-row">
            <input type="text" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDomain())} placeholder="e.g. aiaengineering.com" className="sso-input" style={{ flex: 1 }} />
            <button onClick={addDomain} className="sso-add">Add</button>
          </div>
          {config.allowed_domains.length > 0 && <div className="sso-tags">{config.allowed_domains.map(d => <span key={d} className="sso-tag">{d}<button onClick={() => removeDomain(d)} className="sso-tag-x">&times;</button></span>)}</div>}
        </div>

        <div className="sso-card">
          <h3 className="sso-label">Behavior</h3>
          <div className="sso-row">
            <div><span className="sso-rlabel">Auto-provision users</span><p className="sso-rdesc">Automatically create VEMIO accounts for first-time SSO users</p></div>
            <button onClick={() => setConfig(prev => ({ ...prev, auto_provision: !prev.auto_provision }))} className={`sso-sw ${config.auto_provision ? 'sso-sw-on' : ''}`}><div className={`sso-sw-k ${config.auto_provision ? 'sso-sw-k-on' : ''}`} /></button>
          </div>
          {config.auto_provision && <div className="sso-field" style={{ marginTop: 12 }}><label className="sso-flabel">Default role for new SSO users</label><select value={config.default_role} onChange={e => setConfig(prev => ({ ...prev, default_role: e.target.value }))} className="sso-select"><option value="viewer">Viewer (read-only)</option><option value="admin">Admin (full access)</option></select></div>}
          <div className="sso-row" style={{ marginTop: 20 }}>
            <div><span className="sso-rlabel">Enforce SSO</span><p className="sso-rdesc">Disable password login. All users must use SSO.<br /><strong style={{ color: '#EF9F27' }}>Warning:</strong> Ensure SSO works before enabling.</p></div>
            <button onClick={() => setConfig(prev => ({ ...prev, enforce_sso: !prev.enforce_sso }))} className={`sso-sw ${config.enforce_sso ? 'sso-sw-danger' : ''}`}><div className={`sso-sw-k ${config.enforce_sso ? 'sso-sw-k-on' : ''}`} /></button>
          </div>
        </div>
      </>)}

      <div className="sso-save-bar">
        <button onClick={handleSave} disabled={saving} className="sso-save" style={{ opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving...' : 'Save SSO Settings'}</button>
      </div>

      <style>{css}</style>
    </div>
  );
}

const V = (name) => `var(--color-vemio-${name}, var(--vemio-${name}))`;

const css = `
  .sso-page { max-width:720px; margin:0 auto; padding:32px 24px; }
  .sso-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; }
  .sso-title { font-size:20px; font-weight:600; color:${V('text')}; margin:0 0 4px; }
  .sso-subtitle { font-size:13px; color:${V('text-muted')}; margin:0; }
  .sso-active-badge { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:#1D9E75; padding:4px 10px; border-radius:6px; background:rgba(29,158,117,0.1); }
  .sso-active-dot { width:6px; height:6px; border-radius:50%; background:#1D9E75; }

  .sso-alert { display:flex; align-items:center; gap:8px; padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:20px; }
  .sso-alert-err { background:rgba(226,75,74,0.08); border:1px solid rgba(226,75,74,0.2); color:#E24B4A; }
  .sso-alert-ok { background:rgba(29,158,117,0.08); border:1px solid rgba(29,158,117,0.2); color:#1D9E75; }
  .sso-alert-icon { width:18px; height:18px; border-radius:50%; background:#E24B4A; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; }
  .sso-alert-x { margin-left:auto; background:none; border:none; color:inherit; font-size:18px; cursor:pointer; padding:0 4px; opacity:0.6; }

  .sso-card { background:${V('surface')}; border:1px solid ${V('border')}; border-radius:10px; padding:20px 22px; margin-bottom:16px; }
  .sso-label { font-size:14px; font-weight:500; color:${V('text')}; margin:0 0 4px; }
  .sso-desc { font-size:13px; color:${V('text-muted')}; line-height:1.5; margin:0 0 16px; }

  .sso-row { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .sso-rlabel { font-size:13px; font-weight:500; color:${V('text')}; }
  .sso-rdesc { font-size:12px; color:${V('text-muted')}; line-height:1.5; margin:2px 0 0; }

  .sso-sw { width:40px; height:22px; border-radius:11px; border:none; cursor:pointer; flex-shrink:0; position:relative; transition:background 0.2s; background:${V('border')}; }
  .sso-sw-on { background:#1D9E75 !important; }
  .sso-sw-danger { background:#E24B4A !important; }
  .sso-sw-k { width:18px; height:18px; border-radius:50%; background:#fff; position:absolute; top:2px; left:2px; transition:transform 0.2s; }
  .sso-sw-k-on { transform:translateX(18px); }

  .sso-prov-list { display:flex; flex-direction:column; gap:8px; }
  .sso-prov { display:flex; flex-direction:column; gap:4px; padding:14px 16px; border-radius:8px; border:1px solid ${V('border')}; background:${V('surface-raised')}; text-align:left; transition:border-color 0.2s; font-family:inherit; cursor:pointer; }
  .sso-prov-sel { border-color:#C89700 !important; }
  .sso-prov-dis { opacity:0.4; cursor:not-allowed; }
  .sso-prov-name { font-size:13px; font-weight:500; color:${V('text')}; }
  .sso-prov-desc { font-size:12px; color:${V('text-muted')}; }

  .sso-fields { display:flex; flex-direction:column; gap:14px; margin-top:16px; }
  .sso-field { display:flex; flex-direction:column; gap:6px; }
  .sso-flabel { font-size:13px; font-weight:500; color:${V('text')}; display:flex; align-items:center; gap:8px; }
  .sso-hint { font-size:11px; color:${V('text-dim')}; }
  .sso-configured { font-size:10px; font-weight:500; padding:1px 6px; border-radius:4px; background:rgba(29,158,117,0.12); color:#1D9E75; }

  .sso-input { padding:9px 12px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface-raised')}; color:${V('text')}; font-size:13px; outline:none; font-family:inherit; box-sizing:border-box; width:100%; }
  .sso-input:focus { border-color:var(--color-vemio-amber, #C89700); }
  .sso-select { padding:9px 12px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface-raised')}; color:${V('text')}; font-size:13px; outline:none; font-family:inherit; width:100%; }

  .sso-code { font-size:11px; padding:2px 6px; border-radius:4px; background:rgba(239,159,39,0.08); color:#EF9F27; font-family:monospace; word-break:break-all; }

  .sso-help { margin-top:16px; border-top:1px solid ${V('border')}; padding-top:12px; }
  .sso-help summary { font-size:13px; font-weight:500; color:${V('text-muted')}; cursor:pointer; outline:none; }
  .sso-steps { font-size:12px; color:${V('text-muted')}; line-height:1.8; padding-left:20px; margin-top:12px; }

  .sso-domain-row { display:flex; gap:8px; }
  .sso-add { padding:9px 16px; border-radius:7px; border:1px solid ${V('border')}; background:${V('surface-raised')}; color:${V('text')}; font-size:13px; font-weight:500; cursor:pointer; flex-shrink:0; font-family:inherit; }
  .sso-tags { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
  .sso-tag { display:flex; align-items:center; gap:6px; padding:4px 10px; border-radius:6px; background:${V('surface-raised')}; font-size:12px; color:${V('text')}; }
  .sso-tag-x { background:none; border:none; color:${V('text-muted')}; font-size:14px; cursor:pointer; padding:0 2px; line-height:1; }

  .sso-save-bar { display:flex; justify-content:flex-end; margin-top:8px; }
  .sso-save { padding:10px 24px; border-radius:8px; border:none; background:#C89700; color:#0C0C0E; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; transition:opacity 0.2s; }

  .sso-loading { display:flex; align-items:center; justify-content:center; gap:10px; padding:80px 0; font-size:13px; color:${V('text-muted')}; }
  .sso-dot { width:8px; height:8px; border-radius:50%; background:#C89700; animation:sso-p 1s infinite; }
  @keyframes sso-p { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .sso-denied { text-align:center; padding:80px 24px; }
  .sso-denied h2 { font-size:18px; font-weight:600; color:${V('text')}; margin:0 0 8px; }
  .sso-denied p { font-size:13px; color:${V('text-muted')}; margin:0; }
`;