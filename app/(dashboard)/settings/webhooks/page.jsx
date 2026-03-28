'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Webhook,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Activity,
  Filter,
  ArrowUpDown,
  Monitor,
  Copy,
  Check,
} from 'lucide-react';

export default function WebhookLogPage() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`/api/webhooks/events?limit=100&status=${filter}`);
      if (!res.ok) {
        if (res.status === 403) {
          setError('Admin access required to view webhook logs.');
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setEvents(data.events || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchEvents]);
 useEffect(() => { setMounted(true); }, []);
  const handleCopyPayload = async (payload, id) => {
    try {
      const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    let relative;
    if (diffMin < 1) relative = 'just now';
    else if (diffMin < 60) relative = `${diffMin}m ago`;
    else if (diffHr < 24) relative = `${diffHr}h ago`;
    else relative = `${Math.floor(diffHr / 24)}d ago`;

    const absolute = d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return `${relative} · ${absolute}`;
  };

  const getStatusBadge = (event) => {
    if (event.errorMessage) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
          <XCircle size={12} />
          Error
        </span>
      );
    }
    if (event.processed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
          <CheckCircle2 size={12} />
          Processed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400">
        <Clock size={12} />
        Pending
      </span>
    );
  };

  const getAlertStatusBadge = (alertStatus) => {
    if (!alertStatus) return null;
    if (alertStatus === 'Triggered') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400">
          Triggered
        </span>
      );
    }
    if (alertStatus === 'Cleared') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
          Cleared
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400">
        {alertStatus}
      </span>
    );
  };

  const formatPayload = (payload) => {
    try {
      const obj = typeof payload === 'string' ? JSON.parse(payload) : payload;
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(payload);
    }
  };

  const filterOptions = [
    { value: 'all', label: 'All', icon: ArrowUpDown },
    { value: 'processed', label: 'Processed', icon: CheckCircle2 },
    { value: 'failed', label: 'Errors', icon: XCircle },
    { value: 'unprocessed', label: 'Pending', icon: Clock },
  ];

  if (!mounted) return null;

if (error && events.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Webhook size={24} className="text-amber-400" />
          <h1 className="text-xl font-semibold text-zinc-100">Webhook Log</h1>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  if (!mounted) return null;

return (
    <div className="p-4 md:p-6 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Webhook size={24} className="text-amber-400" />
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Webhook Log</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Auvik webhook events and processing status
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <Activity size={14} className={autoRefresh ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">Live</span>
          </button>

          {/* Manual refresh */}
          <button
            onClick={() => { setLoading(true); fetchEvents(); }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Total Events</div>
            <div className="text-xl font-semibold text-zinc-100">{stats.total}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Processed</div>
            <div className="text-xl font-semibold text-emerald-400">{stats.processed}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Errors</div>
            <div className="text-xl font-semibold text-red-400">{stats.failed}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Last Event</div>
            <div className="text-sm font-medium text-zinc-300 truncate">
              {stats.lastEvent
                ? formatTimestamp(stats.lastEvent)
                : 'None yet'}
            </div>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 mb-4 p-1 bg-zinc-900 border border-zinc-800 rounded-lg w-fit">
        {filterOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === value
                ? 'bg-zinc-700 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading && events.length === 0 ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-20 h-5 bg-zinc-800 rounded" />
                <div className="w-40 h-5 bg-zinc-800 rounded" />
                <div className="flex-1" />
                <div className="w-24 h-5 bg-zinc-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <Webhook size={40} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium">No webhook events yet</p>
          <p className="text-zinc-600 text-sm mt-1">
            Configure the webhook URL in Auvik and trigger a test connection to verify.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const isExpanded = expandedId === event.id;
            return (
              <div
                key={event.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition-colors"
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  className="w-full flex items-center gap-3 p-3 md:p-4 text-left"
                >
                  <div className="text-zinc-600 flex-shrink-0">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>

                  {/* Device name + alert */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Monitor size={14} className="text-zinc-500 flex-shrink-0" />
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {event.deviceName || 'Unknown Device'}
                      </span>
                      {getAlertStatusBadge(event.alertStatus)}
                    </div>
                    {event.alertName && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate pl-[22px]">
                        {event.alertName}
                      </p>
                    )}
                  </div>

                  {/* Processing status */}
                  <div className="flex-shrink-0 hidden sm:block">
                    {getStatusBadge(event)}
                  </div>

                  {/* Timestamp */}
                  <div className="text-xs text-zinc-500 flex-shrink-0 text-right min-w-[80px] hidden md:block">
                    {formatTimestamp(event.receivedAt)}
                  </div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-zinc-800 pt-3 space-y-3">
                        {/* Meta grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-zinc-500 text-xs block">Event Type</span>
                            <span className="text-zinc-300 font-mono text-xs">{event.eventType}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs block">Source</span>
                            <span className="text-zinc-300">{event.source}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs block">Auvik Device ID</span>
                            <span className="text-zinc-300 font-mono text-xs truncate block max-w-[200px]">
                              {event.auvikDeviceId || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-xs block">Processed At</span>
                            <span className="text-zinc-300 text-xs">
                              {event.processedAt ? formatTimestamp(event.processedAt) : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Error message */}
                        {event.errorMessage && (
                          <div className="bg-red-500/5 border border-red-500/20 rounded-md p-3">
                            <div className="flex items-center gap-2 text-red-400 text-xs font-medium mb-1">
                              <AlertTriangle size={12} />
                              Error
                            </div>
                            <p className="text-red-300 text-xs font-mono">{event.errorMessage}</p>
                          </div>
                        )}

                        {/* Raw payload */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-zinc-500 text-xs font-medium">Raw Payload</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPayload(event.rawPayload, event.id);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              {copiedId === event.id ? (
                                <><Check size={12} className="text-emerald-400" /> Copied</>
                              ) : (
                                <><Copy size={12} /> Copy</>
                              )}
                            </button>
                          </div>
                          <pre className="bg-zinc-950 border border-zinc-800 rounded-md p-3 text-xs text-zinc-400 font-mono overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
                            {formatPayload(event.rawPayload)}
                          </pre>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="fixed bottom-4 right-4 bg-zinc-800 border border-zinc-700 rounded-full px-3 py-1.5 text-xs text-zinc-400 flex items-center gap-2 shadow-lg z-50">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Live — refreshing every 10s
        </div>
      )}
    </div>
  );
}