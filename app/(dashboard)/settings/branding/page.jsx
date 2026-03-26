'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Save, Shield, Eye } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };

const DEFAULT_BRANDING = {
  logo_url: '',
  company_name: '',
  tagline: 'Network Intelligence',
  primary_color: '#F59E0B',
  accent_color: '#14B8A6',
  show_powered_by: true,
  powered_by_text: 'Powered by Vinay Enterprises',
};

const PRESET_COLORS = [
  { label: 'Amber (default)', primary: '#F59E0B', accent: '#14B8A6' },
  { label: 'Blue',            primary: '#3B82F6', accent: '#06B6D4' },
  { label: 'Emerald',         primary: '#10B981', accent: '#6366F1' },
  { label: 'Rose',            primary: '#F43F5E', accent: '#F59E0B' },
  { label: 'Violet',          primary: '#8B5CF6', accent: '#EC4899' },
  { label: 'Sky',             primary: '#0EA5E9', accent: '#F59E0B' },
];

/* ── Toggle ── */

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      className="relative w-[42px] h-6 rounded-full shrink-0 transition-colors duration-200 cursor-pointer border-none"
      style={{ background: value ? 'var(--color-vemio-amber)' : 'var(--color-vemio-border)' }}
    >
      <span
        className="absolute top-[3px] left-0 w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: value ? 'translateX(20px)' : 'translateX(3px)' }}
      />
    </button>
  );
}

/* ── Panel ── */

function Panel({ children }) {
  return (
    <motion.div
      variants={fadeUp}
      className="rounded-[14px] p-5 max-sm:p-3.5"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Field ── */

function Field({ label, desc, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[13px] font-semibold m-0 text-vemio-text">{label}</p>
        {desc && <p className="text-xs mt-0.5 m-0 text-vemio-text-dim">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── Text Input ── */

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="px-3 py-2 text-[13px] rounded-lg outline-none w-full transition-[border-color]"
      style={{
        background: 'var(--color-vemio-surface-raised)',
        border: '1px solid var(--color-vemio-border)',
        color: 'var(--color-vemio-text)',
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(245,158,11,0.4)'}
      onBlur={e => e.target.style.borderColor = 'var(--color-vemio-border)'}
    />
  );
}

/* ── Color Picker ── */

function ColorInput({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg border cursor-pointer shrink-0 relative overflow-hidden"
        style={{ background: value, borderColor: 'var(--color-vemio-border)' }}
      >
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs m-0 text-vemio-text-muted">{label}</p>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-xs font-mono mt-0.5 px-2 py-1 rounded-md outline-none w-24"
          style={{
            background: 'var(--color-vemio-surface-raised)',
            border: '1px solid var(--color-vemio-border)',
            color: 'var(--color-vemio-text)',
          }}
        />
      </div>
    </div>
  );
}

/* ── Live Preview ── */

function BrandPreview({ branding }) {
  const name = branding.company_name || 'Your Company';
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-vemio-border)' }}
    >
      {/* Mini sidebar preview */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--color-vemio-surface)' }}
      >
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${branding.primary_color}26, ${branding.accent_color}1a)`,
              border: `1px solid ${branding.primary_color}33`,
            }}
          >
            <Shield className="w-4 h-4" style={{ color: branding.primary_color }} />
          </div>
        )}
        <div>
          <p className="text-sm font-bold m-0 leading-none">
            <span style={{ color: branding.primary_color }}>VEMIO</span>
            <span className="text-vemio-text-dim text-[9px] align-super ml-0.5">™</span>
          </p>
          <p className="text-[9px] text-vemio-text-dim uppercase tracking-widest mt-0.5">
            {branding.tagline || 'Network Intelligence'}
          </p>
        </div>
      </div>

      {/* Mini topbar preview */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'var(--color-vemio-surface)',
          borderTop: '1px solid var(--color-vemio-border)',
        }}
      >
        <span className="text-xs font-medium text-vemio-text">Overview</span>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full text-vemio-text-muted"
          style={{
            background: 'var(--color-vemio-surface-raised)',
            border: '1px solid var(--color-vemio-border)',
          }}
        >
          {name}
        </span>
      </div>

      {/* Mini metric cards */}
      <div
        className="grid grid-cols-3 gap-2 p-4"
        style={{ background: 'var(--color-vemio-bg)' }}
      >
        {['Devices', 'Uptime', 'BCS Score'].map(label => (
          <div
            key={label}
            className="rounded-lg p-2.5"
            style={{
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
            }}
          >
            <p className="text-[9px] text-vemio-text-dim m-0">{label}</p>
            <p className="text-sm font-bold m-0 mt-0.5" style={{ color: branding.primary_color }}>
              {label === 'Devices' ? '55' : label === 'Uptime' ? '99.2%' : '78'}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      {branding.show_powered_by && (
        <div
          className="px-4 py-2 text-center"
          style={{
            background: 'var(--color-vemio-surface)',
            borderTop: '1px solid var(--color-vemio-border)',
          }}
        >
          <p className="text-[9px] text-vemio-text-dim m-0">
            {branding.powered_by_text || 'Powered by Vinay Enterprises'}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Main Page ── */

export default function BrandingSettingsPage() {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/branding');
        if (!res.ok) throw new Error();
        const json = await res.json();
        setBranding(prev => ({
          ...prev,
          ...json.branding,
          logo_url: json.branding.logo_url || '',
          company_name: json.branding.company_name || '',
          powered_by_text: json.branding.powered_by_text || prev.powered_by_text,
        }));
      } catch { /* defaults */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      // Strip empty strings → null for cleaner storage
      const payload = { ...branding };
      if (!payload.logo_url) payload.logo_url = null;
      if (!payload.company_name) payload.company_name = null;

      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { branding: payload } }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* TODO toast */ }
    finally { setSaving(false); }
  }

  function update(key, value) {
    setBranding(prev => ({ ...prev, [key]: value }));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-5 h-5 text-vemio-amber animate-spin" />
    </div>
  );

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-5 max-sm:gap-3.5 max-w-[860px]"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold m-0 text-vemio-text">Branding</h1>
          <p className="text-[13px] mt-1 m-0 text-vemio-text-muted">
            Customise the dashboard appearance for your organisation
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold
                     shrink-0 whitespace-nowrap cursor-pointer border-none
                     disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'var(--color-vemio-amber)', color: '#0F172A' }}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </motion.div>

      {/* Preview */}
      <Panel>
        <div className="flex items-center gap-2 mb-3">
          <Eye className="w-4 h-4 text-vemio-amber" />
          <p className="text-[13px] font-semibold m-0 text-vemio-text">Live Preview</p>
        </div>
        <BrandPreview branding={branding} />
      </Panel>

      {/* Identity */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-4 text-vemio-text">Identity</p>
        <div className="flex flex-col gap-4">
          <Field label="Logo URL" desc="Direct link to your logo image (PNG/SVG, ~200×200px recommended)">
            <TextInput
              value={branding.logo_url}
              onChange={v => update('logo_url', v)}
              placeholder="https://yourcompany.com/logo.png"
            />
            {branding.logo_url && (
              <div className="flex items-center gap-3 mt-1">
                <img
                  src={branding.logo_url}
                  alt="Preview"
                  className="w-10 h-10 rounded-lg object-contain"
                  style={{ border: '1px solid var(--color-vemio-border)' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <span className="text-[11px] text-vemio-text-dim">Logo preview</span>
              </div>
            )}
          </Field>

          <Field label="Company Name" desc="Shown in the top bar tenant badge and reports">
            <TextInput
              value={branding.company_name}
              onChange={v => update('company_name', v)}
              placeholder="Your Company Name"
            />
          </Field>

          <Field label="Tagline" desc="Shown below VEMIO™ in the sidebar">
            <TextInput
              value={branding.tagline}
              onChange={v => update('tagline', v)}
              placeholder="Network Intelligence"
            />
          </Field>
        </div>
      </Panel>

      {/* Colors */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-1 text-vemio-text">Colors</p>
        <p className="text-xs m-0 mb-4 text-vemio-text-dim">
          Primary color is used for active states, buttons, and highlights. Accent adds depth.
        </p>

        {/* Presets */}
        <div className="flex gap-2 flex-wrap mb-4">
          {PRESET_COLORS.map(preset => {
            const isActive = branding.primary_color === preset.primary && branding.accent_color === preset.accent;
            return (
              <button
                key={preset.label}
                onClick={() => {
                  update('primary_color', preset.primary);
                  update('accent_color', preset.accent);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
                           cursor-pointer transition-colors border"
                style={{
                  background: isActive ? `${preset.primary}15` : 'transparent',
                  borderColor: isActive ? `${preset.primary}40` : 'var(--color-vemio-border)',
                  color: isActive ? preset.primary : 'var(--color-vemio-text-muted)',
                }}
              >
                <div className="flex gap-0.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: preset.primary }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: preset.accent }} />
                </div>
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Custom pickers */}
        <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
          <ColorInput
            label="Primary color"
            value={branding.primary_color}
            onChange={v => update('primary_color', v)}
          />
          <ColorInput
            label="Accent color"
            value={branding.accent_color}
            onChange={v => update('accent_color', v)}
          />
        </div>
      </Panel>

      {/* Footer / Powered-by */}
      <Panel>
        <p className="text-[13px] font-semibold m-0 mb-4 text-vemio-text">Footer</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium m-0 text-vemio-text">Show &quot;Powered by&quot; footer</p>
              <p className="text-xs mt-0.5 m-0 text-vemio-text-dim">
                Display attribution in the sidebar footer
              </p>
            </div>
            <Toggle value={branding.show_powered_by} onChange={v => update('show_powered_by', v)} />
          </div>

          {branding.show_powered_by && (
            <Field label="Footer text" desc="Custom attribution text">
              <TextInput
                value={branding.powered_by_text}
                onChange={v => update('powered_by_text', v)}
                placeholder="Powered by Vinay Enterprises"
              />
            </Field>
          )}
        </div>
      </Panel>

      {/* Bottom save */}
      <motion.div variants={fadeUp} className="flex items-center gap-3.5 pb-6">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold
                     cursor-pointer border-none disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
          style={{ background: 'var(--color-vemio-amber)', color: '#0F172A' }}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
        {saved && <p className="text-xs m-0 text-status-up">Branding saved — refresh to see changes</p>}
      </motion.div>
    </motion.div>
  );
}