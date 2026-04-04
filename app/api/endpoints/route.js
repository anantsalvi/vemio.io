// ════════════════════════════════════════════════════════════════════
//  VEMIO™ | Network Endpoints v2
//  app/(dashboard)/endpoints/page.jsx
// ════════════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Monitor, Wifi, Cable, Search, RefreshCw,
  ArrowUpDown, Laptop, Smartphone, Cloud, Printer,
  Cpu, HelpCircle, Box, Router, Tv, ChevronDown,
  ChevronUp, Filter, X,
} from 'lucide-react';

/* ── Icon map for device types ── */
const DEVICE_ICONS = {
  workstation: Monitor,
  mobile: Smartphone,
  virtual: Cloud,
  printer: Printer,
  iot: Cpu,
  network: Router,
  media: Tv,
  unknown: HelpCircle,
  other: Box,
};

/* ── Colors ── */
const TYPE_COLORS = {
  workstation: { bg: 'rgba(59,130,246,0.12)', fg: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  mobile:      { bg: 'rgba(168,85,247,0.12)', fg: '#a855f7', border: 'rgba(168,85,247,0.25)' },
  virtual:     { bg: 'rgba(6,182,212,0.12)',  fg: '#06b6d4', border: 'rgba(6,182,212,0.25)' },
  printer:     { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  iot:         { bg: 'rgba(236,72,153,0.12)', fg: '#ec4899', border: 'rgba(236,72,153,0.25)' },
  network:     { bg: 'rgba(34,197,94,0.12)',  fg: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  media:       { bg: 'rgba(249,115,22,0.12)', fg: '#f97316', border: 'rgba(249,115,22,0.25)' },
  unknown:     { bg: 'rgba(107,114,128,0.12)',fg: '#6b7280', border: 'rgba(107,114,128,0.25)' },
  other:       { bg: 'rgba(107,114,128,0.12)',fg: '#6b7280', border: 'rgba(107,114,128,0.25)' },
};

function timeAgo(date) {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function cleanSwitchName(name) {
  if (!name) return '—';
  return name.replace(/\s*\(switch\)\s*$/i, '').replace(/\s*\(access_point\)\s*$/i, '');
}

/* ── Stat Card ── */
function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div style={{
      background: 'var(--color-vemio-surface, #1a1a2e)',
      border: '1px solid var(--color-vemio-border, #2a2a4a)',
      borderRadius: 12, padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      minWidth: 0,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: color + '18', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 24, fontWeight: 700, lineHeight: 1,
          color: 'var(--color-vemio-text, #e2e8f0)',
        }}>{value}</div>
        <div style={{
          fontSize: 12, color: 'var(--color-vemio-text-muted, #8892a4)',
          marginTop: 2,
        }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: color, marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ── Device Type Badge ── */
function TypeBadge({ type, label }) {
  const colors = TYPE_COLORS[type] || TYPE_COLORS.unknown;
  const Icon = DEVICE_ICONS[type] || HelpCircle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 6,
      background: colors.bg, border: `1px solid ${colors.border}`,
      fontSize: 11, fontWeight: 500, color: colors.fg,
      whiteSpace: 'nowrap',
    }}>
      <Icon size={12} />
      {label}
    </span>
  );
}

/* ── Connection Badge ── */
function ConnectionBadge({ type }) {
  const isWireless = type === 'wireless';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 6,
      background: isWireless ? 'rgba(168,85,247,0.12)' : 'rgba(59,130,246,0.12)',
      border: `1px solid ${isWireless ? 'rgba(168,85,247,0.25)' : 'rgba(59,130,246,0.25)'}`,
      fontSize: 11, fontWeight: 500,
      color: isWireless ? '#a855f7' : '#3b82f6',
    }}>
      {isWireless ? <Wifi size={11} /> : <Cable size={11} />}
      {isWireless ? 'Wireless' : 'Wired'}
    </span>
  );
}

/* ── Sortable Column Header ── */
function SortHeader({ label, field, sortField, sortDir, onSort, style }) {
  const active = sortField === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.05em', userSelect: 'none',
        color: active ? 'var(--color-vemio-text, #e2e8f0)' : 'var(--color-vemio-text-muted, #8892a4)',
        borderBottom: '1px solid var(--color-vemio-border, #2a2a4a)',
        whiteSpace: 'nowrap', ...style,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={10} style={{ opacity: 0.4 }} />}
      </span>
    </th>
  );
}

/* ════════════════════════════════════════════════════════════════ */
export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDevice, setFilterDevice] = useState('all');
  const [sortField, setSortField] = useState('lastSeen');
  const [sortDir, setSortDir] = useState('desc');

  async function fetchEndpoints() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/endpoints');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEndpoints(data.endpoints || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEndpoints(); }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchEndpoints, 60000);
    return () => clearInterval(interval);
  }, []);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'lastSeen' ? 'desc' : 'asc');
    }
  }

  // Get unique device types for filter
  const deviceTypes = useMemo(() => {
    const types = new Set(endpoints.map(e => e.deviceType));
    return [...types].sort();
  }, [endpoints]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...endpoints];

    // Connection type filter
    if (filterType !== 'all') {
      list = list.filter(e => e.connectionType === filterType);
    }

    // Device type filter
    if (filterDevice !== 'all') {
      list = list.filter(e => e.deviceType === filterDevice);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.mac && e.mac.toLowerCase().includes(q)) ||
        (e.ip && e.ip.includes(q)) ||
        (e.manufacturer && e.manufacturer.toLowerCase().includes(q)) ||
        (e.hostname && e.hostname.toLowerCase().includes(q)) ||
        (e.switchName && e.switchName.toLowerCase().includes(q)) ||
        (e.apName && e.apName.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      let va = a[sortField] ?? '';
      let vb = b[sortField] ?? '';
      if (sortField === 'port') { va = Number(va) || 0; vb = Number(vb) || 0; }
      if (sortField === 'lastSeen' || sortField === 'firstSeen') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [endpoints, filterType, filterDevice, search, sortField, sortDir]);

  const hasActiveFilters = filterType !== 'all' || filterDevice !== 'all' || search.trim();

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, margin: 0,
            color: 'var(--color-vemio-text, #e2e8f0)',
          }}>
            Network Endpoints
          </h1>
          <p style={{
            fontSize: 13, margin: '4px 0 0',
            color: 'var(--color-vemio-text-muted, #8892a4)',
          }}>
            All discovered clients on your network
          </p>
        </div>
        <button
          onClick={fetchEndpoints}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8,
            background: 'var(--color-vemio-surface, #1a1a2e)',
            border: '1px solid var(--color-vemio-border, #2a2a4a)',
            color: 'var(--color-vemio-text-muted, #8892a4)',
            cursor: 'pointer', fontSize: 13,
            opacity: loading ? 0.5 : 1,
          }}
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      {summary && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          <StatCard label="Total Endpoints" value={summary.total} icon={Laptop} color="#3b82f6" />
          <StatCard label="Wired" value={summary.wired} icon={Cable} color="#06b6d4"
            sub={summary.total ? Math.round(summary.wired / summary.total * 100) + '%' : ''} />
          <StatCard label="Wireless" value={summary.wireless} icon={Wifi} color="#a855f7"
            sub={summary.total ? Math.round(summary.wireless / summary.total * 100) + '%' : ''} />
          <StatCard label="With IP" value={summary.withIp} icon={Monitor} color="#22c55e"
            sub={summary.total ? Math.round(summary.withIp / summary.total * 100) + '% identified' : ''} />
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8, flex: '1 1 240px', maxWidth: 360,
          background: 'var(--color-vemio-surface, #1a1a2e)',
          border: '1px solid var(--color-vemio-border, #2a2a4a)',
        }}>
          <Search size={14} color="var(--color-vemio-text-muted, #8892a4)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search MAC, IP, manufacturer..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--color-vemio-text, #e2e8f0)', fontSize: 13,
              width: '100%',
            }}
          />
          {search && (
            <X size={14} style={{ cursor: 'pointer', color: '#6b7280' }}
              onClick={() => setSearch('')} />
          )}
        </div>

        {/* Connection type filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'wired', 'wireless'].map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: '1px solid',
                cursor: 'pointer',
                background: filterType === t ? (t === 'wired' ? 'rgba(59,130,246,0.15)' : t === 'wireless' ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.08)') : 'transparent',
                borderColor: filterType === t ? (t === 'wired' ? 'rgba(59,130,246,0.4)' : t === 'wireless' ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.15)') : 'var(--color-vemio-border, #2a2a4a)',
                color: filterType === t ? (t === 'wired' ? '#3b82f6' : t === 'wireless' ? '#a855f7' : '#e2e8f0') : 'var(--color-vemio-text-muted, #8892a4)',
              }}
            >
              {t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Device type filter */}
        <div style={{ position: 'relative' }}>
          <select
            value={filterDevice}
            onChange={e => setFilterDevice(e.target.value)}
            style={{
              padding: '6px 28px 6px 10px', borderRadius: 6, fontSize: 12,
              background: 'var(--color-vemio-surface, #1a1a2e)',
              border: '1px solid var(--color-vemio-border, #2a2a4a)',
              color: 'var(--color-vemio-text, #e2e8f0)',
              cursor: 'pointer', appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="all">All Types</option>
            {deviceTypes.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <ChevronDown size={12} style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: '#6b7280',
          }} />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(''); setFilterType('all'); setFilterDevice('all'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 6, fontSize: 12,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444', cursor: 'pointer',
            }}
          >
            <X size={12} /> Clear
          </button>
        )}

        <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
          {filtered.length} of {endpoints.length} endpoints
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div style={{
          padding: 16, borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444', fontSize: 13,
        }}>
          Failed to load endpoints: {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--color-vemio-surface, #1a1a2e)',
        border: '1px solid var(--color-vemio-border, #2a2a4a)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortHeader label="Device Type" field="deviceLabel" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="MAC Address" field="mac" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="IP Address" field="ip" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Manufacturer" field="manufacturer" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Connection" field="connectionType" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Connected To" field="switchName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Port" field="port" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Last Seen" field="lastSeen" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {loading && endpoints.length === 0 ? (
                <tr><td colSpan={8} style={{
                  padding: 48, textAlign: 'center', fontSize: 14,
                  color: 'var(--color-vemio-text-muted, #8892a4)',
                }}>
                  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
                  <div>Loading endpoints...</div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{
                  padding: 48, textAlign: 'center', fontSize: 14,
                  color: 'var(--color-vemio-text-muted, #8892a4)',
                }}>
                  {endpoints.length > 0 ? 'No endpoints match your filters' : 'No endpoints discovered yet'}
                </td></tr>
              ) : filtered.map((ep, i) => (
                <tr
                  key={ep.mac + i}
                  style={{
                    borderBottom: '1px solid var(--color-vemio-border, #1e1e38)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <TypeBadge type={ep.deviceType} label={ep.deviceLabel} />
                  </td>
                  <td style={{
                    padding: '10px 12px', fontFamily: 'monospace', fontSize: 12,
                    color: 'var(--color-vemio-text, #e2e8f0)', letterSpacing: '0.02em',
                  }}>
                    {ep.mac}
                  </td>
                  <td style={{
                    padding: '10px 12px', fontFamily: 'monospace', fontSize: 12,
                    color: ep.ip ? 'var(--color-vemio-text, #e2e8f0)' : '#4a5568',
                  }}>
                    {ep.ip || '—'}
                  </td>
                  <td style={{
                    padding: '10px 12px', fontSize: 13,
                    color: ep.manufacturer === 'Unknown' ? '#4a5568' : 'var(--color-vemio-text, #e2e8f0)',
                  }}>
                    {ep.manufacturer}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <ConnectionBadge type={ep.connectionType} />
                  </td>
                  <td style={{
                    padding: '10px 12px', fontSize: 13,
                    color: 'var(--color-vemio-text, #e2e8f0)',
                  }}>
                    {ep.connectionType === 'wireless' && ep.apName
                      ? cleanSwitchName(ep.apName)
                      : cleanSwitchName(ep.switchName)}
                  </td>
                  <td style={{
                    padding: '10px 12px', fontSize: 13, textAlign: 'center',
                    color: ep.port ? 'var(--color-vemio-text, #e2e8f0)' : '#4a5568',
                  }}>
                    {ep.port || '—'}
                  </td>
                  <td style={{
                    padding: '10px 12px', fontSize: 12,
                    color: 'var(--color-vemio-text-muted, #8892a4)',
                    whiteSpace: 'nowrap',
                  }}>
                    {timeAgo(ep.lastSeen)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
