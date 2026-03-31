/**
 * VEMIO™ — Alert Thresholds Settings Page
 * app/(dashboard)/settings/thresholds/page.jsx
 *
 * Allows admins to view and customize alert threshold values per metric.
 * Shows system defaults vs tenant-specific overrides.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTenantFetch } from '@/hooks/useTenantFetch';

const METRIC_CONFIG = {
  cpu:            { label: 'CPU Utilization',        unit: '%',  icon: '🖥️' },
  memory:         { label: 'Memory Utilization',     unit: '%',  icon: '🧠' },
  storage:        { label: 'Storage Utilization',    unit: '%',  icon: '💾' },
  bandwidth_util: { label: 'Bandwidth Utilization',  unit: '%',  icon: '📡' },
  latency:        { label: 'WAN Latency',            unit: 'ms', icon: '⏱️' },
  jitter:         { label: 'WAN Jitter',             unit: 'ms', icon: '📊' },
  packet_loss:    { label: 'Packet Loss',            unit: '%',  icon: '📉' },
};

const METRIC_ORDER = ['cpu', 'memory', 'storage', 'bandwidth_util', 'latency', 'jitter', 'packet_loss'];

export default function ThresholdsPage() {
  const [thresholds, setThresholds] = useState([]);
  const [editing, setEditing] = useState(null); // metric being edited
  const [editValues, setEditValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const tenantFetch = useTenantFetch();

  const fetchThresholds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await tenantFetch('/api/settings/thresholds');
      if (res.ok) {
        const json = await res.json();
        setThresholds(json.thresholds);
      }
    } catch (err) {
      console.error('Failed to fetch thresholds:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantFetch]);

  useEffect(() => { fetchThresholds(); }, [fetchThresholds]);

  function startEdit(t) {
    setEditing(t.metric);
    setEditValues({
      warningValue: t.warningValue,
      criticalValue: t.criticalValue,
      sustainedMinutes: t.sustainedMinutes,
      enabled: t.enabled,
    });
  }

  function cancelEdit() {
    setEditing(null);
    setEditValues({});
  }

  async function saveThreshold(metric) {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await tenantFetch('/api/settings/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thresholds: [{
            metric,
            ...editValues,
          }],
        }),
      });
      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Threshold updated' });
        setEditing(null);
        fetchThresholds();
      } else {
        const err = await res.json();
        setSaveMessage({ type: 'error', text: err.error || 'Failed to save' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  async function toggleEnabled(t) {
    try {
      await tenantFetch('/api/settings/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thresholds: [{
            metric: t.metric,
            warningValue: t.warningValue,
            criticalValue: t.criticalValue,
            sustainedMinutes: t.sustainedMinutes,
            enabled: !t.enabled,
          }],
        }),
      });
      fetchThresholds();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold text-[var(--color-text)] mb-6">Alert Thresholds</h1>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-[var(--color-border)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Sort thresholds by defined order
  const sorted = METRIC_ORDER.map(m => thresholds.find(t => t.metric === m)).filter(Boolean);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">Alert Thresholds</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Configure when performance alerts fire. Thresholds must be sustained for the specified
            duration before an alert is created.
          </p>
        </div>
      </div>

      {saveMessage && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm font-medium ${
          saveMessage.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
            : 'bg-red-500/10 text-red-500 border border-red-500/20'
        }`}>
          {saveMessage.text}
        </div>
      )}

      <div className="space-y-3">
        {sorted.map(t => {
          const config = METRIC_CONFIG[t.metric];
          const isEditing = editing === t.metric;

          return (
            <div
              key={t.metric}
              className={`bg-[var(--color-surface)] border rounded-xl p-4 transition-colors ${
                isEditing ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{config.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--color-text)]">{config.label}</span>
                      {t.isCustom && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                          CUSTOM
                        </span>
                      )}
                      {!t.enabled && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]">
                          DISABLED
                        </span>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-4 mt-1 text-xs text-[var(--color-text-secondary)]">
                        <span>Warning: <span className="text-amber-500 font-medium">{t.warningValue}{config.unit}</span></span>
                        <span>Critical: <span className="text-red-500 font-medium">{t.criticalValue}{config.unit}</span></span>
                        <span>Sustained: {t.sustainedMinutes} min</span>
                      </div>
                    )}
                  </div>
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEnabled(t)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        t.enabled ? 'bg-emerald-500' : 'bg-[var(--color-border)]'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        t.enabled ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                    <button
                      onClick={() => startEdit(t)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg
                        bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]
                        hover:text-[var(--color-text)] transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* Edit form */}
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Warning ({config.unit})
                      </label>
                      <input
                        type="number"
                        value={editValues.warningValue}
                        onChange={(e) => setEditValues(v => ({ ...v, warningValue: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)]
                          bg-[var(--color-surface)] text-[var(--color-text)]
                          focus:outline-none focus:border-[var(--color-primary)]"
                        step={config.unit === 'ms' ? 10 : 1}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Critical ({config.unit})
                      </label>
                      <input
                        type="number"
                        value={editValues.criticalValue}
                        onChange={(e) => setEditValues(v => ({ ...v, criticalValue: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)]
                          bg-[var(--color-surface)] text-[var(--color-text)]
                          focus:outline-none focus:border-[var(--color-primary)]"
                        step={config.unit === 'ms' ? 10 : 1}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                        Sustained (min)
                      </label>
                      <input
                        type="number"
                        value={editValues.sustainedMinutes}
                        onChange={(e) => setEditValues(v => ({ ...v, sustainedMinutes: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--color-border)]
                          bg-[var(--color-surface)] text-[var(--color-text)]
                          focus:outline-none focus:border-[var(--color-primary)]"
                        min={1}
                        max={60}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 text-xs font-medium rounded-lg
                        bg-[var(--color-surface-alt)] text-[var(--color-text-secondary)]
                        hover:text-[var(--color-text)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveThreshold(t.metric)}
                      disabled={saving}
                      className="px-4 py-2 text-xs font-medium rounded-lg
                        bg-[var(--color-primary)] text-white
                        hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info box */}
      <div className="mt-6 p-4 rounded-xl bg-[var(--color-surface-alt)] border border-[var(--color-border)]">
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
          <span className="font-semibold text-[var(--color-text)]">How it works:</span> The stats
          collector evaluates thresholds every 5 minutes. When a metric exceeds the warning or critical
          level for the sustained duration, an alert is automatically created. Alerts appear on the Alerts
          page and trigger email notifications for critical severity. Latency, jitter, and packet loss
          thresholds require Cloud Ping to be configured in Auvik.
        </p>
      </div>
    </div>
  );
}