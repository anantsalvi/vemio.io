// ════════════════════════════════════════════════════════════════════
//  VEMIO™ | Collectors
//  app/(dashboard)/collectors/page.jsx
//
//  MSP-style collector management — list of collector sites with
//  online status, discovery stats, and rediscover trigger.
// ════════════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Radio, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Server, Cpu, Clock, Activity, Trash2,
} from 'lucide-react';

const STATUS_COLORS = {
  online: '#22c55e',
  offline: '#ef4444',
  pending: '#f59e0b',
};

function timeAgo(date) {
  if (!date) return 'Never';
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return minutes + 'm ' + remSec + 's';
}

export default function CollectorsPage() {
  const [collectors, setCollectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [confirmHardId, setConfirmHardId] = useState(null);
  const [toast, setToast] = useState(null);

  const fetchCollectors = useCallback(async () => {
    try {
      const res = await fetch('/api/collectors');
      if (!res.ok) throw new Error('Failed to fetch collectors');
      const data = await res.json();
      setCollectors(data.collectors || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollectors();
    const t = setInterval(fetchCollectors, 5000); // 15s refresh
    return () => clearInterval(t);
  }, [fetchCollectors]);

  function showToast(msg, kind = 'success') {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  async function triggerRediscover(id, hard = false) {
    setBusyId(id);
    try {
      const res = await fetch('/api/collectors/' + id + '/rediscover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hard }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to queue command', 'error');
      } else {
        showToast(data.message || 'Command queued', 'success');
        fetchCollectors();
      }
    } catch (e) {
      showToast(e.message, 'error');
    } finally {
      setBusyId(null);
      setConfirmHardId(null);
    }
  }

  if (loading && collectors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--color-vemio-text-dim)' }} />
      </div>
    );
  }

  const totals = {
    total: collectors.length,
    online: collectors.filter(c => c.isOnline).length,
    offline: collectors.filter(c => !c.isOnline).length,
    pendingCmds: collectors.reduce((s, c) => s + (c.pendingCommands || 0) + (c.deliveredCommands || 0), 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--color-vemio-surface-2)' }}
          >
            <Radio size={20} style={{ color: 'var(--color-vemio-accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-vemio-text)' }}>
              Collectors
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-vemio-text-dim)' }}>
              On-premise edge collectors discovering your network
            </p>
          </div>
        </div>
        <button
          onClick={fetchCollectors}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
            color: 'var(--color-vemio-text)',
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Server} label="Total" value={totals.total} color="#60a5fa" />
        <StatCard icon={CheckCircle2} label="Online" value={totals.online} color={STATUS_COLORS.online} />
        <StatCard icon={XCircle} label="Offline" value={totals.offline} color={STATUS_COLORS.offline} />
        <StatCard icon={Clock} label="Pending Commands" value={totals.pendingCmds} color={STATUS_COLORS.pending} />
      </div>

      {error && (
        <div
          className="p-3 rounded-lg flex items-center gap-2 text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
        >
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* Collector cards */}
      {collectors.length === 0 ? (
        <div
          className="text-center p-12 rounded-lg"
          style={{
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
            color: 'var(--color-vemio-text-dim)',
          }}
        >
          <Radio size={32} className="mx-auto mb-3 opacity-50" />
          <p>No collectors enrolled yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collectors.map((c, idx) => (
            <CollectorCard
              key={c.id}
              collector={c}
              index={idx}
              busy={busyId === c.id}
              onSoftRediscover={() => triggerRediscover(c.id, false)}
              onHardReset={() => setConfirmHardId(c.id)}
            />
          ))}
        </div>
      )}

      {/* Hard reset confirm dialog */}
      {confirmHardId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirmHardId(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="max-w-md w-full mx-4 p-6 rounded-lg"
            style={{
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(239,68,68,0.15)' }}>
                <Trash2 size={20} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--color-vemio-text)' }}>
                  Hard Reset Collector?
                </h3>
                <p className="text-sm" style={{ color: 'var(--color-vemio-text-dim)' }}>
                  This will force a full re-discovery cycle and clear cached state.
                  Existing data is preserved on the server. The collector will be unavailable for several minutes.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmHardId(null)}
                className="px-4 py-2 rounded-lg text-sm"
                style={{
                  background: 'var(--color-vemio-surface-2)',
                  color: 'var(--color-vemio-text)',
                  border: '1px solid var(--color-vemio-border)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => triggerRediscover(confirmHardId, true)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#ef4444', color: 'white' }}
              >
                Hard Reset
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm"
          style={{
            background: toast.kind === 'error' ? '#ef4444' : '#22c55e',
            color: 'white',
          }}
        >
          {toast.msg}
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--color-vemio-text-dim)' }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold" style={{ color: 'var(--color-vemio-text)' }}>
        {value}
      </div>
    </div>
  );
}

function CollectorCard({ collector, index, busy, onSoftRediscover, onHardReset }) {
  const c = collector;
  const isOnline = c.isOnline;
  const lr = c.lastRun;
  const isRunning = lr && lr.status === 'running';

  // Tick every 1s while a discovery is running so the elapsed counter updates
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    const t = setInterval(() => forceTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);
  const hasQueuedCommand = (c.pendingCommands + c.deliveredCommands + c.runningCommands) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg overflow-hidden"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          {/* Left: identity + status */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: isOnline ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              }}
            >
              <Radio
                size={20}
                style={{ color: isOnline ? STATUS_COLORS.online : STATUS_COLORS.offline }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--color-vemio-text)' }}>
                  {c.siteName || c.linkedSiteName || 'Unnamed Collector'}
                </h3>
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1"
                  style={{
                    background: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    color: isOnline ? STATUS_COLORS.online : STATUS_COLORS.offline,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isOnline ? STATUS_COLORS.online : STATUS_COLORS.offline }}
                  />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                {c.status !== 'active' && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: 'rgba(245,158,11,0.15)', color: STATUS_COLORS.pending }}
                  >
                    {c.status}
                  </span>
                )}
              </div>
              <div className="text-xs mt-1 flex items-center gap-3 flex-wrap" style={{ color: 'var(--color-vemio-text-dim)' }}>
                {c.hostname && <span>{c.hostname}</span>}
                {c.osInfo && <span>·  {c.osInfo}</span>}
                {c.nodeVersion && <span>·  Node {c.nodeVersion}</span>}
                {c.collectorVersion && <span>·  v{c.collectorVersion}</span>}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-vemio-text-dim)' }}>
                Last heartbeat: {timeAgo(c.lastHeartbeat)}
              </div>
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={busy || !isOnline || hasQueuedCommand}
              onClick={onSoftRediscover}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{
                background: 'var(--color-vemio-accent)',
                color: 'white',
                opacity: (busy || !isOnline || hasQueuedCommand) ? 0.5 : 1,
                cursor: (busy || !isOnline || hasQueuedCommand) ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
              {hasQueuedCommand ? 'Queued' : 'Rediscover'}
            </button>
            <button
              disabled={busy || !isOnline}
              onClick={onHardReset}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: 'var(--color-vemio-surface-2)',
                border: '1px solid var(--color-vemio-border)',
                color: 'var(--color-vemio-text-dim)',
                opacity: (busy || !isOnline) ? 0.5 : 1,
                cursor: (busy || !isOnline) ? 'not-allowed' : 'pointer',
              }}
              title="Hard reset (advanced)"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Discovery stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5"
          style={{ borderTop: '1px solid var(--color-vemio-border)' }}>
          <Stat label="Devices" value={c.deviceCount} icon={Server} />
          <Stat
            label={isRunning ? "Running" : "Last Run"}
            value={
              isRunning
                ? formatDuration(Date.now() - new Date(lr.startedAt).getTime())
                : (lr ? timeAgo(lr.startedAt) : '—')
            }
            icon={Clock}
            sub={
              isRunning
                ? 'in progress...'
                : (lr ? formatDuration(lr.durationMs) : null)
            }
          />
          <Stat
            label="Endpoints Found"
            value={lr ? (lr.endpointsFound || 0) : '—'}
            icon={Cpu}
          />
          <Stat
            label="Topology Links"
            value={lr ? (lr.topologyLinks || 0) : '—'}
            icon={Activity}
          />
        </div>

        {(hasQueuedCommand || isRunning) && (
          <div
            className="mt-4 p-3 rounded-lg flex items-center gap-2 text-xs"
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: STATUS_COLORS.pending,
            }}
          >
            <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
            {isRunning && (
              <span>
                Discovery running — {formatDuration(Date.now() - new Date(lr.startedAt).getTime())} elapsed
              </span>
            )}
            {!isRunning && c.deliveredCommands > 0 && <span>Command delivered, starting discovery...</span>}
            {!isRunning && c.deliveredCommands === 0 && c.pendingCommands > 0 && (
              <span>Command queued. Collector polls every 30s.</span>
            )}
          </div>
        )}

        {lr && lr.status === 'failed' && lr.errorMessage && (
          <div
            className="mt-4 p-3 rounded-lg flex items-start gap-2 text-xs"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <div className="font-medium mb-0.5">Last run failed</div>
              <div>{lr.errorMessage}</div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ label, value, icon: Icon, sub }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--color-vemio-text-dim)' }}>
        <Icon size={12} />
        {label}
      </div>
      <div className="text-base font-semibold" style={{ color: 'var(--color-vemio-text)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--color-vemio-text-dim)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}
