// ════════════════════════════════════════════════════════════════════
//  VEMIO™ | Network Endpoints
//  app/(dashboard)/endpoints/page.jsx
//
//  Shows all network endpoints (PCs, phones, cameras, IoT) with
//  connection details, manufacturer, wired/wireless status.
// ════════════════════════════════════════════════════════════════════
'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Monitor, Wifi, WifiOff, Cable, Search, RefreshCw,
  ArrowUpDown, ChevronDown, Laptop, Smartphone,
} from 'lucide-react';

const CONNECTION_COLORS = {
  wired: '#3B82F6',
  wireless: '#A855F7',
};

const STATUS_COLORS = {
  active: '#22c55e',
  inactive: '#6b7280',
};

function timeAgo(date) {
  if (!date) return 'Unknown';
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  return days + 'd ago';
}

export default function EndpointsPage() {
  const [endpoints, setEndpoints] = useState([]);
  const [summary, setSummary] = useState({ total: 0, wired: 0, wireless: 0, withIp: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // all | wired | wireless
  const [sortField, setSortField] = useState('lastSeen');
  const [sortDir, setSortDir] = useState('desc');

  async function fetchEndpoints() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/endpoints');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setEndpoints(data.endpoints || []);
      setSummary(data.summary || { total: 0, wired: 0, wireless: 0, withIp: 0 });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEndpoints(); }, []);

  const filtered = useMemo(() => {
    let list = endpoints;

    if (filterType !== 'all') {
      list = list.filter(e => e.connectionType === filterType);
    }

    if (search) {
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

    list = [...list].sort((a, b) => {
      let va = a[sortField] || '';
      let vb = b[sortField] || '';
      if (sortField === 'lastSeen' || sortField === 'firstSeen') {
        va = new Date(va || 0).getTime();
        vb = new Date(vb || 0).getTime();
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [endpoints, filterType, search, sortField, sortDir]);

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortHeader({ field, label }) {
    const active = sortField === field;
    return (
      <th
        onClick={() => toggleSort(field)}
        className="cursor-pointer select-none group"
        style={{
          padding: '10px 12px', textAlign: 'left', fontSize: '11px',
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
          color: active ? 'var(--color-vemio-text)' : 'var(--color-vemio-text-muted)',
          borderBottom: '1px solid var(--color-vemio-border)',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          <ArrowUpDown size={12} style={{
            opacity: active ? 1 : 0.3,
            transform: active && sortDir === 'desc' ? 'scaleY(-1)' : 'none',
          }} />
        </span>
      </th>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-vemio-text)', margin: 0 }}>
            Network Endpoints
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-vemio-text-muted)', marginTop: 4 }}>
            All devices connected to your network — PCs, phones, IoT, cameras
          </p>
        </div>
        <button
          onClick={fetchEndpoints}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
            color: 'var(--color-vemio-text)', cursor: 'pointer',
            fontSize: 13,
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Endpoints', value: summary.total, icon: Monitor, color: '#3B82F6' },
          { label: 'Wired', value: summary.wired, icon: Cable, color: '#22c55e' },
          { label: 'Wireless', value: summary.wireless, icon: Wifi, color: '#A855F7' },
          { label: 'With IP', value: summary.withIp, icon: Laptop, color: '#F59E0B' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            style={{
              padding: 20, borderRadius: 12,
              background: 'var(--color-vemio-surface)',
              border: '1px solid var(--color-vemio-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-vemio-text-muted)', marginBottom: 4 }}>
                  {card.label}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-vemio-text)' }}>
                  {loading ? '—' : card.value}
                </div>
              </div>
              <card.icon size={24} style={{ color: card.color, opacity: 0.7 }} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8, flex: '1 1 300px',
          background: 'var(--color-vemio-surface)',
          border: '1px solid var(--color-vemio-border)',
        }}>
          <Search size={14} style={{ color: 'var(--color-vemio-text-muted)' }} />
          <input
            type="text"
            placeholder="Search MAC, IP, manufacturer, hostname..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--color-vemio-text)', fontSize: 13, width: '100%',
            }}
          />
        </div>

        {/* Type filter */}
        {['all', 'wired', 'wireless'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13,
              border: '1px solid',
              borderColor: filterType === type ? (type === 'wireless' ? '#A855F7' : type === 'wired' ? '#3B82F6' : 'var(--color-vemio-accent)') : 'var(--color-vemio-border)',
              background: filterType === type ? (type === 'wireless' ? 'rgba(168,85,247,0.15)' : type === 'wired' ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)') : 'var(--color-vemio-surface)',
              color: filterType === type ? 'var(--color-vemio-text)' : 'var(--color-vemio-text-muted)',
              cursor: 'pointer', textTransform: 'capitalize',
              fontWeight: filterType === type ? 600 : 400,
            }}
          >
            {type === 'all' ? `All (${summary.total})` : type === 'wired' ? `Wired (${summary.wired})` : `Wireless (${summary.wireless})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid var(--color-vemio-border)',
        background: 'var(--color-vemio-surface)',
      }}>
        {error ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
            Failed to load endpoints: {error}
          </div>
        ) : loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-vemio-text-muted)' }}>
            Loading endpoints...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-vemio-text-muted)' }}>
            No endpoints found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <SortHeader field="connectionType" label="Type" />
                  <SortHeader field="mac" label="MAC Address" />
                  <SortHeader field="ip" label="IP Address" />
                  <SortHeader field="manufacturer" label="Manufacturer" />
                  <th style={{
                    padding: '10px 12px', textAlign: 'left', fontSize: '11px',
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'var(--color-vemio-text-muted)',
                    borderBottom: '1px solid var(--color-vemio-border)',
                  }}>
                    Connected To
                  </th>
                  <SortHeader field="port" label="Port" />
                  <SortHeader field="vlanId" label="VLAN" />
                  <SortHeader field="lastSeen" label="Last Seen" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((ep, i) => (
                  <motion.tr
                    key={ep.mac}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.5) }}
                    style={{
                      borderBottom: '1px solid var(--color-vemio-border)',
                      cursor: 'default',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Type */}
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: ep.connectionType === 'wireless'
                          ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
                        color: ep.connectionType === 'wireless' ? '#A855F7' : '#3B82F6',
                      }}>
                        {ep.connectionType === 'wireless'
                          ? <Wifi size={11} />
                          : <Cable size={11} />}
                        {ep.connectionType}
                      </span>
                    </td>

                    {/* MAC */}
                    <td style={{
                      padding: '10px 12px', fontSize: 13,
                      color: 'var(--color-vemio-text)',
                      fontFamily: 'monospace',
                    }}>
                      {ep.mac}
                    </td>

                    {/* IP */}
                    <td style={{
                      padding: '10px 12px', fontSize: 13,
                      color: ep.ip ? 'var(--color-vemio-text)' : 'var(--color-vemio-text-muted)',
                      fontFamily: ep.ip ? 'monospace' : 'inherit',
                    }}>
                      {ep.ip || '—'}
                    </td>

                    {/* Manufacturer */}
                    <td style={{
                      padding: '10px 12px', fontSize: 13,
                      color: ep.manufacturer !== 'Unknown' ? 'var(--color-vemio-text)' : 'var(--color-vemio-text-muted)',
                    }}>
                      {ep.manufacturer}
                    </td>

                    {/* Connected To */}
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      <div style={{ color: 'var(--color-vemio-text)' }}>
                        {ep.connectionType === 'wireless' && ep.apName ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Wifi size={12} style={{ color: '#A855F7' }} />
                            {ep.apName}
                          </span>
                        ) : ep.switchName ? (
                          <span>{ep.switchName}</span>
                        ) : '—'}
                      </div>
                      {ep.switchName && ep.connectionType === 'wireless' && (
                        <div style={{ fontSize: 11, color: 'var(--color-vemio-text-muted)', marginTop: 2 }}>
                          via {ep.switchName}
                        </div>
                      )}
                    </td>

                    {/* Port */}
                    <td style={{
                      padding: '10px 12px', fontSize: 13,
                      color: 'var(--color-vemio-text-muted)',
                    }}>
                      {ep.port || '—'}
                    </td>

                    {/* VLAN */}
                    <td style={{
                      padding: '10px 12px', fontSize: 13,
                      color: 'var(--color-vemio-text-muted)',
                    }}>
                      {ep.vlanId || '—'}
                    </td>

                    {/* Last Seen */}
                    <td style={{
                      padding: '10px 12px', fontSize: 12,
                      color: 'var(--color-vemio-text-muted)',
                    }}>
                      {timeAgo(ep.lastSeen)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 12, fontSize: 12, color: 'var(--color-vemio-text-muted)',
      }}>
        <span>Showing {filtered.length} of {endpoints.length} endpoints</span>
        <span>Last updated: {loading ? '...' : 'just now'}</span>
      </div>
    </div>
  );
}
