/**
 * VEMIO™ — SSO Settings Page
 * Phase 7.1: Tenant admin UI for configuring SSO/SAML.
 * 
 * Route: /settings/sso
 * Access: Admin only
 * 
 * Allows tenant admins to:
 * - Enable/disable SSO
 * - Configure Azure AD (Tenant ID, Client ID, Client Secret)
 * - Toggle enforce SSO (disable password login)
 * - Toggle auto-provisioning of new users
 * - Set default role for auto-provisioned users
 * - Configure allowed email domains
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

  // SSO config state
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

  // ── Fetch current config ──
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/sso');
      if (!res.ok) throw new Error('Failed to fetch SSO settings');
      const data = await res.json();
      setConfig(prev => ({
        ...prev,
        ...data,
        azure_client_secret: '', // Never pre-fill secret
        allowed_domains: data.allowed_domains || [],
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  // ── Save config ──
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = { ...config };
      // Don't send empty client secret (keep existing)
      if (!payload.azure_client_secret) {
        delete payload.azure_client_secret;
      }
      delete payload.has_client_secret;

      const res = await fetch('/api/settings/sso', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save SSO settings');
      }

      setSuccess('SSO settings saved successfully');
      setConfig(prev => ({
        ...prev,
        ...data.sso,
        azure_client_secret: '',
      }));

      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Domain management ──
  const addDomain = () => {
    const domain = newDomain.toLowerCase().trim();
    if (!domain || !domain.includes('.')) return;
    if (config.allowed_domains.includes(domain)) return;
    setConfig(prev => ({
      ...prev,
      allowed_domains: [...prev.allowed_domains, domain],
    }));
    setNewDomain('');
  };

  const removeDomain = (domain) => {
    setConfig(prev => ({
      ...prev,
      allowed_domains: prev.allowed_domains.filter(d => d !== domain),
    }));
  };

  // ── Access guard ──
  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <h2 style={styles.adTitle}>Access Denied</h2>
          <p style={styles.adText}>SSO configuration requires admin privileges.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrap}>
          <div style={styles.loadingDot} />
          <span style={styles.loadingText}>Loading SSO settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Single Sign-On (SSO)</h1>
          <p style={styles.subtitle}>
            Allow your team to sign in with your organization's identity provider
          </p>
        </div>
        <div style={styles.headerActions}>
          {config.enabled && (
            <span style={styles.statusBadge}>
              <span style={styles.statusDot} />
              Active
            </span>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div style={styles.alertError}>
          <span style={styles.alertIcon}>!</span>
          {error}
          <button onClick={() => setError('')} style={styles.alertClose}>&times;</button>
        </div>
      )}
      {success && (
        <div style={styles.alertSuccess}>
          <span style={styles.alertCheckIcon}>&#10003;</span>
          {success}
        </div>
      )}

      {/* Enable toggle */}
      <div style={styles.section}>
        <div style={styles.toggleRow}>
          <div>
            <h3 style={styles.sectionLabel}>Enable SSO</h3>
            <p style={styles.sectionDesc}>
              Allow users to sign in with their corporate identity provider
            </p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            style={{
              ...styles.toggle,
              background: config.enabled ? '#1D9E75' : 'rgba(255,255,255,0.08)',
            }}
          >
            <div style={{
              ...styles.toggleKnob,
              transform: config.enabled ? 'translateX(18px)' : 'translateX(2px)',
            }} />
          </button>
        </div>
      </div>

      {config.enabled && (
        <>
          {/* Provider selection */}
          <div style={styles.section}>
            <h3 style={styles.sectionLabel}>Identity Provider</h3>
            <div style={styles.providerGrid}>
              {PROVIDER_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => !p.disabled && setConfig(prev => ({ ...prev, provider: p.value }))}
                  disabled={p.disabled}
                  style={{
                    ...styles.providerCard,
                    borderColor: config.provider === p.value
                      ? '#C89700'
                      : 'var(--vemio-border, rgba(255,255,255,0.06))',
                    opacity: p.disabled ? 0.4 : 1,
                    cursor: p.disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={styles.providerName}>{p.label}</span>
                  <span style={styles.providerDesc}>{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Azure AD Config */}
          {config.provider === 'azure-ad' && (
            <div style={styles.section}>
              <h3 style={styles.sectionLabel}>Azure AD Configuration</h3>
              <p style={styles.sectionDesc}>
                Register VEMIO as an enterprise application in your Azure AD tenant.
                Redirect URI: <code style={styles.code}>https://vemio.vinayenterprises.co.in/api/auth/callback/azure-ad</code>
              </p>

              <div style={styles.fieldGrid}>
                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Azure Tenant ID</label>
                  <input
                    type="text"
                    value={config.azure_tenant_id}
                    onChange={e => setConfig(prev => ({ ...prev, azure_tenant_id: e.target.value }))}
                    placeholder="e.g. 12345678-abcd-1234-efgh-123456789012"
                    style={styles.input}
                  />
                  <span style={styles.fieldHint}>Found in Azure Portal → Azure Active Directory → Overview</span>
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>Application (Client) ID</label>
                  <input
                    type="text"
                    value={config.azure_client_id}
                    onChange={e => setConfig(prev => ({ ...prev, azure_client_id: e.target.value }))}
                    placeholder="e.g. 87654321-dcba-4321-hgfe-210987654321"
                    style={styles.input}
                  />
                  <span style={styles.fieldHint}>Found in Azure Portal → App Registrations → Your App → Overview</span>
                </div>

                <div style={styles.field}>
                  <label style={styles.fieldLabel}>
                    Client Secret
                    {config.has_client_secret && (
                      <span style={styles.secretBadge}>Configured</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={config.azure_client_secret}
                    onChange={e => setConfig(prev => ({ ...prev, azure_client_secret: e.target.value }))}
                    placeholder={config.has_client_secret ? 'Leave blank to keep existing' : 'Paste client secret'}
                    style={styles.input}
                  />
                  <span style={styles.fieldHint}>Found in Azure Portal → App Registrations → Certificates & Secrets</span>
                </div>
              </div>

              {/* Setup instructions */}
              <details style={styles.helpDetails}>
                <summary style={styles.helpSummary}>Setup instructions for Azure AD</summary>
                <div style={styles.helpContent}>
                  <ol style={styles.helpList}>
                    <li>Go to <strong>Azure Portal</strong> → <strong>Azure Active Directory</strong> → <strong>App Registrations</strong></li>
                    <li>Click <strong>New Registration</strong></li>
                    <li>Name: <strong>VEMIO Dashboard</strong></li>
                    <li>Supported account types: <strong>Single tenant</strong> (your org only)</li>
                    <li>Redirect URI (Web): <code style={styles.code}>https://vemio.vinayenterprises.co.in/api/auth/callback/azure-ad</code></li>
                    <li>Click <strong>Register</strong></li>
                    <li>Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong></li>
                    <li>Go to <strong>Certificates & Secrets</strong> → <strong>New client secret</strong></li>
                    <li>Copy the secret <strong>Value</strong> (not the ID)</li>
                    <li>Go to <strong>API Permissions</strong> → Add: <strong>Microsoft Graph</strong> → <strong>User.Read</strong> (delegated)</li>
                    <li>Grant admin consent if required by your organization</li>
                  </ol>
                </div>
              </details>
            </div>
          )}

          {/* Allowed domains */}
          <div style={styles.section}>
            <h3 style={styles.sectionLabel}>Allowed Email Domains</h3>
            <p style={styles.sectionDesc}>
              Only users with emails from these domains can use SSO. Leave empty to allow all domains.
            </p>
            <div style={styles.domainInputRow}>
              <input
                type="text"
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDomain())}
                placeholder="e.g. aiaengineering.com"
                style={{ ...styles.input, flex: 1 }}
              />
              <button onClick={addDomain} style={styles.addButton}>Add</button>
            </div>
            {config.allowed_domains.length > 0 && (
              <div style={styles.domainList}>
                {config.allowed_domains.map(domain => (
                  <span key={domain} style={styles.domainTag}>
                    {domain}
                    <button onClick={() => removeDomain(domain)} style={styles.domainRemove}>&times;</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Behavior settings */}
          <div style={styles.section}>
            <h3 style={styles.sectionLabel}>Behavior</h3>

            <div style={styles.toggleRow}>
              <div>
                <span style={styles.toggleLabel}>Auto-provision users</span>
                <p style={styles.toggleDesc}>
                  Automatically create VEMIO accounts for users who sign in via SSO for the first time
                </p>
              </div>
              <button
                onClick={() => setConfig(prev => ({ ...prev, auto_provision: !prev.auto_provision }))}
                style={{
                  ...styles.toggle,
                  background: config.auto_provision ? '#1D9E75' : 'rgba(255,255,255,0.08)',
                }}
              >
                <div style={{
                  ...styles.toggleKnob,
                  transform: config.auto_provision ? 'translateX(18px)' : 'translateX(2px)',
                }} />
              </button>
            </div>

            {config.auto_provision && (
              <div style={{ ...styles.field, marginTop: '12px', marginLeft: '0' }}>
                <label style={styles.fieldLabel}>Default role for new SSO users</label>
                <select
                  value={config.default_role}
                  onChange={e => setConfig(prev => ({ ...prev, default_role: e.target.value }))}
                  style={styles.select}
                >
                  <option value="viewer">Viewer (read-only)</option>
                  <option value="admin">Admin (full access)</option>
                </select>
              </div>
            )}

            <div style={{ ...styles.toggleRow, marginTop: '20px' }}>
              <div>
                <span style={styles.toggleLabel}>Enforce SSO</span>
                <p style={styles.toggleDesc}>
                  Disable password login for this organization. All users must use SSO.
                  <br />
                  <strong style={{ color: '#EF9F27' }}>Warning:</strong> Ensure your SSO is working before enabling this.
                </p>
              </div>
              <button
                onClick={() => setConfig(prev => ({ ...prev, enforce_sso: !prev.enforce_sso }))}
                style={{
                  ...styles.toggle,
                  background: config.enforce_sso ? '#E24B4A' : 'rgba(255,255,255,0.08)',
                }}
              >
                <div style={{
                  ...styles.toggleKnob,
                  transform: config.enforce_sso ? 'translateX(18px)' : 'translateX(2px)',
                }} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Save button */}
      <div style={styles.saveBar}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...styles.saveButton,
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save SSO Settings'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '28px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--vemio-text, #E8E6E1)',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#1D9E75',
    padding: '4px 10px',
    borderRadius: '6px',
    background: 'rgba(29, 158, 117, 0.1)',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#1D9E75',
  },
  alertError: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(226, 75, 74, 0.08)',
    border: '1px solid rgba(226, 75, 74, 0.2)',
    color: '#E24B4A',
    fontSize: '13px',
    marginBottom: '20px',
  },
  alertSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(29, 158, 117, 0.08)',
    border: '1px solid rgba(29, 158, 117, 0.2)',
    color: '#1D9E75',
    fontSize: '13px',
    marginBottom: '20px',
  },
  alertIcon: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#E24B4A',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 700,
    flexShrink: 0,
  },
  alertCheckIcon: {
    fontSize: '14px',
    flexShrink: 0,
  },
  alertClose: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px',
    opacity: 0.6,
  },
  section: {
    background: 'var(--vemio-surface, #141418)',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.06))',
    borderRadius: '10px',
    padding: '20px 22px',
    marginBottom: '16px',
  },
  sectionLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
    marginBottom: '4px',
  },
  sectionDesc: {
    fontSize: '13px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.45))',
    lineHeight: 1.5,
    marginBottom: '16px',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
  },
  toggle: {
    width: '40px',
    height: '22px',
    borderRadius: '11px',
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute',
    top: '2px',
    transition: 'transform 0.2s',
  },
  toggleLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
  },
  toggleDesc: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.45))',
    lineHeight: 1.5,
    marginTop: '2px',
  },
  providerGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  providerCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '14px 16px',
    borderRadius: '8px',
    border: '1px solid',
    background: 'var(--vemio-bg, #0C0C0E)',
    textAlign: 'left',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
  },
  providerName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
  },
  providerDesc: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.45))',
  },
  fieldGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginTop: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  fieldHint: {
    fontSize: '11px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.35))',
  },
  secretBadge: {
    fontSize: '10px',
    fontWeight: 500,
    padding: '1px 6px',
    borderRadius: '4px',
    background: 'rgba(29, 158, 117, 0.12)',
    color: '#1D9E75',
  },
  input: {
    padding: '9px 12px',
    borderRadius: '7px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-bg, #0C0C0E)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    width: '100%',
  },
  select: {
    padding: '9px 12px',
    borderRadius: '7px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-bg, #0C0C0E)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
  },
  code: {
    fontSize: '11px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.05)',
    color: '#EF9F27',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
  },
  helpDetails: {
    marginTop: '16px',
    borderTop: '1px solid var(--vemio-border, rgba(255,255,255,0.06))',
    paddingTop: '12px',
  },
  helpSummary: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
    cursor: 'pointer',
    outline: 'none',
  },
  helpContent: {
    marginTop: '12px',
  },
  helpList: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
    lineHeight: 1.8,
    paddingLeft: '20px',
  },
  domainInputRow: {
    display: 'flex',
    gap: '8px',
  },
  addButton: {
    padding: '9px 16px',
    borderRadius: '7px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-bg, #0C0C0E)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
    fontFamily: 'inherit',
  },
  domainList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '10px',
  },
  domainTag: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.05)',
    fontSize: '12px',
    color: 'var(--vemio-text, #E8E6E1)',
  },
  domainRemove: {
    background: 'none',
    border: 'none',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.35))',
    fontSize: '14px',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
  },
  saveBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  saveButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: '#C89700',
    color: '#0C0C0E',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s',
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '80px 0',
  },
  loadingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#C89700',
    animation: 'pulse 1s infinite',
  },
  loadingText: {
    fontSize: '13px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
  },
  accessDenied: {
    textAlign: 'center',
    padding: '80px 24px',
  },
  adTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--vemio-text, #E8E6E1)',
    marginBottom: '8px',
  },
  adText: {
    fontSize: '13px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
  },
};lib/audit.js