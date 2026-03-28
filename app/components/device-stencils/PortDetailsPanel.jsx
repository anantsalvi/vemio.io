'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronDown, ChevronUp, ExternalLink,
  ArrowUpDown, Filter,
} from 'lucide-react';

const STATUS_COLORS = {
  online:   { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'Online' },
  offline:  { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Offline' },
  disabled: { color: '#374151', bg: 'rgba(55,65,81,0.1)',    label: 'Disabled' },
  testing:  { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Testing' },
  unknown:  { color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Unknown' },
};

const MEDIA_BADGES = {
  fiber:    { color: '#F97316', bg: 'rgba(249,115,22,0.1)', label: 'Fiber' },
  copper:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: 'Copper' },
  wireless: { color: '#A855F7', bg: 'rgba(168,85,247,0.1)', label: 'Wireless' },
  virtual:  { color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',  label: 'Virtual' },
  unknown:  { color: '#4b5563', bg: 'rgba(75,85,99,0.08)',  label: '—' },
};

function formatSpeed(bps) {
  if (!bps || bps <= 0) return '—';
  if (bps >= 10000000000) return `${bps / 1000000000} Gbps`;
  if (bps >= 1000000000) return `${(bps / 1000000000).toFixed(bps % 1000000000 === 0 ? 0 : 1)} Gbps`;
  if (bps >= 1000000) return `${bps / 1000000} Mbps`;
  if (bps >= 1000) return `${bps / 1000} Kbps`;
  return `${bps} bps`;
}

export default function PortDetailsPanel({
  ports = [],
  summary,
  selectedPort,
  onPortSelect,
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedRow, setExpandedRow] = useState(null);

  const filteredPorts = useMemo(() => {
    let result = [...ports];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.neighbors?.[0]?.name || '').toLowerCase().includes(q) ||
        (p.vlans?.some(v => v.ipAddress?.includes(q))) ||
        (p.mediaType || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter) {
      result = result.filter(p => p.status === statusFilter);
    }

    // Media filter
    if (mediaFilter) {
      result = result.filter(p => p.mediaType === mediaFilter);
    }

    // Sort
    result.sort((a, b) => {
      let va, vb;
      switch (sortField) {
        case 'name':
          va = a.name || '';
          vb = b.name || '';
          // Natural sort: extract numbers
          const na = parseInt((va.match(/\d+/) || ['0'])[0]);
          const nb = parseInt((vb.match(/\d+/) || ['0'])[0]);
          if (na !== nb) return sortDir === 'asc' ? na - nb : nb - na;
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'status':
          va = a.status || '';
          vb = b.status || '';
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        case 'speed':
          va = a.speed || 0;
          vb = b.speed || 0;
          return sortDir === 'asc' ? va - vb : vb - va;
        case 'connected':
          va = a.neighbors?.length || 0;
          vb = b.neighbors?.length || 0;
          return sortDir === 'asc' ? va - vb : vb - va;
        default:
          return 0;
      }
    });

    return result;
  }, [ports, search, statusFilter, mediaFilter, sortField, sortDir]);

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3" style={{ opacity: 0.3 }} />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3" />
      : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="pdp-root">
      {/* Summary pills */}
      {summary && (
        <div className="pdp-summary">
          <span className="pdp-sum-pill">
            <span className="pdp-sum-val">{summary.totalPorts}</span> ports
          </span>
          <span className="pdp-sum-pill pdp-sum-pill--up">
            <span className="pdp-sum-dot" style={{ background: '#22c55e' }} />
            {summary.up} online
          </span>
          {summary.down > 0 && (
            <span className="pdp-sum-pill">
              <span className="pdp-sum-dot" style={{ background: '#6b7280' }} />
              {summary.down} offline
            </span>
          )}
          {summary.withConnection > 0 && (
            <span className="pdp-sum-pill">
              <span className="pdp-sum-dot" style={{ background: '#3b82f6' }} />
              {summary.withConnection} connected
            </span>
          )}
          {summary.fiber > 0 && (
            <span className="pdp-sum-pill">
              <span className="pdp-sum-dot" style={{ background: '#F97316' }} />
              {summary.fiber} fiber
            </span>
          )}
          {summary.copper > 0 && (
            <span className="pdp-sum-pill">
              <span className="pdp-sum-dot" style={{ background: '#94a3b8' }} />
              {summary.copper} copper
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="pdp-filters">
        <div className="pdp-search-wrap">
          <Search className="pdp-search-icon" />
          <input
            type="text"
            placeholder="Search interfaces, connected devices, IPs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pdp-search-input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="pdp-filter-select"
        >
          <option value="">All status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="disabled">Disabled</option>
        </select>
        <select
          value={mediaFilter}
          onChange={e => setMediaFilter(e.target.value)}
          className="pdp-filter-select"
        >
          <option value="">All media</option>
          <option value="fiber">Fiber</option>
          <option value="copper">Copper</option>
          <option value="wireless">Wireless</option>
        </select>
      </div>

      {/* Table */}
      <div className="pdp-table-scroll">
        <table className="pdp-table">
          <thead>
            <tr className="pdp-thead-row">
              <th className="pdp-th pdp-th--sortable" onClick={() => toggleSort('name')}>
                Interface <SortIcon field="name" />
              </th>
              <th className="pdp-th pdp-th--sortable" onClick={() => toggleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="pdp-th pdp-th--md">Media</th>
              <th className="pdp-th pdp-th--sortable pdp-th--md" onClick={() => toggleSort('speed')}>
                Speed <SortIcon field="speed" />
              </th>
              <th className="pdp-th pdp-th--sortable" onClick={() => toggleSort('connected')}>
                Connected To <SortIcon field="connected" />
              </th>
              <th className="pdp-th pdp-th--lg">VLANs / IPs</th>
            </tr>
          </thead>
          <tbody>
            {filteredPorts.length > 0 ? filteredPorts.map((port, i) => {
              const statusCfg = STATUS_COLORS[port.status] || STATUS_COLORS.unknown;
              const mediaCfg = MEDIA_BADGES[port.mediaType] || MEDIA_BADGES.unknown;
              const isSelected = selectedPort === port.name;
              const isExpanded = expandedRow === port.interfaceId;
              const neighbor = port.neighbors?.[0];

              return (
                <tr
                  key={port.interfaceId || i}
                  className={`pdp-tr ${isSelected ? 'pdp-tr--selected' : ''}`}
                  onClick={() => {
                    onPortSelect?.(port.name);
                    setExpandedRow(isExpanded ? null : port.interfaceId);
                  }}
                >
                  {/* Interface name */}
                  <td className="pdp-td">
                    <span className="pdp-iface-name">{port.name || '—'}</span>
                    <span className="pdp-iface-type">{port.type}</span>
                  </td>

                  {/* Status */}
                  <td className="pdp-td">
                    <span
                      className="pdp-status-badge"
                      style={{ background: statusCfg.bg, color: statusCfg.color }}
                    >
                      <span className="pdp-status-dot" style={{ background: statusCfg.color }} />
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Media */}
                  <td className="pdp-td pdp-td--md">
                    {port.mediaType && port.mediaType !== 'unknown' ? (
                      <span
                        className="pdp-media-badge"
                        style={{ background: mediaCfg.bg, color: mediaCfg.color }}
                      >
                        {mediaCfg.label}
                      </span>
                    ) : (
                      <span className="pdp-dim">—</span>
                    )}
                  </td>

                  {/* Speed */}
                  <td className="pdp-td pdp-td--md pdp-td--mono">
                    {formatSpeed(port.speed)}
                  </td>

                  {/* Connected to */}
                  <td className="pdp-td">
                    {neighbor ? (
                      <button
                        className="pdp-neighbor-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (neighbor.deviceId) {
                            router.push(`/devices/${neighbor.deviceId}`);
                          }
                        }}
                      >
                        <span className="pdp-neighbor-name">{neighbor.name}</span>
                        {neighbor.remoteInterface && (
                          <span className="pdp-neighbor-port">{neighbor.remoteInterface}</span>
                        )}
                        {neighbor.deviceId && (
                          <ExternalLink className="w-3 h-3" style={{ flexShrink: 0, opacity: 0.4 }} />
                        )}
                      </button>
                    ) : port.hasConnection ? (
                      <span className="pdp-dim">Connected (unresolved)</span>
                    ) : (
                      <span className="pdp-dim">—</span>
                    )}
                  </td>

                  {/* VLANs */}
                  <td className="pdp-td pdp-td--lg">
                    {port.vlans?.length > 0 ? (
                      <div className="pdp-vlans">
                        {port.vlans.slice(0, 3).map((v, vi) => (
                          <span key={vi} className="pdp-vlan-chip">
                            {v.ipAddress}
                            {v.vlanId ? ` (VLAN ${v.vlanId})` : ''}
                          </span>
                        ))}
                        {port.vlans.length > 3 && (
                          <span className="pdp-dim">+{port.vlans.length - 3} more</span>
                        )}
                      </div>
                    ) : (
                      <span className="pdp-dim">—</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="pdp-empty">
                  {ports.length === 0 ? 'No port data available' : 'No ports match your filters'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Result count */}
      <div className="pdp-footer">
        <span className="pdp-count">
          Showing {filteredPorts.length} of {ports.length} interfaces
        </span>
      </div>

      <style>{`
        .pdp-root {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* Summary */
        .pdp-summary {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .pdp-sum-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          background: var(--color-vemio-surface-raised);
          padding: 4px 10px;
          border-radius: 6px;
        }
        .pdp-sum-pill--up { color: #22c55e; }
        .pdp-sum-val { font-weight: 600; color: var(--color-vemio-text-muted); }
        .pdp-sum-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* Filters */
        .pdp-filters {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .pdp-search-wrap {
          flex: 1;
          position: relative;
          min-width: 0;
        }
        .pdp-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          width: 14px;
          height: 14px;
          color: var(--color-vemio-text-dim);
          pointer-events: none;
        }
        .pdp-search-input {
          width: 100%;
          padding: 8px 10px 8px 32px;
          font-size: 12px;
          border-radius: 8px;
          background: var(--color-vemio-bg);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          transition: border-color 0.15s;
        }
        .pdp-search-input::placeholder { color: rgba(148,163,184,0.4); }
        .pdp-search-input:focus { border-color: rgba(245,158,11,0.3); }
        .pdp-filter-select {
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 12px;
          background: var(--color-vemio-bg);
          border: 1px solid var(--color-vemio-border);
          color: var(--color-vemio-text);
          outline: none;
          cursor: pointer;
          flex-shrink: 0;
          min-width: 100px;
        }
        @media (max-width: 639px) {
          .pdp-filters { flex-wrap: wrap; }
          .pdp-filter-select { min-width: 0; flex: 1; }
        }

        /* Table */
        .pdp-table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 10px;
          border: 1px solid var(--color-vemio-border);
        }
        .pdp-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 500px;
        }
        .pdp-thead-row {
          border-bottom: 1px solid var(--color-vemio-border);
        }
        .pdp-th {
          padding: 8px 12px;
          text-align: left;
          font-size: 9px;
          font-weight: 600;
          color: var(--color-vemio-text-dim);
          text-transform: uppercase;
          letter-spacing: 0.07em;
          white-space: nowrap;
          user-select: none;
        }
        .pdp-th--sortable {
          cursor: pointer;
          display: table-cell;
        }
        .pdp-th--sortable:hover { color: var(--color-vemio-text-muted); }
        .pdp-th--sortable > svg { display: inline; vertical-align: middle; margin-left: 3px; }
        .pdp-th--md { display: none; }
        @media (min-width: 640px) { .pdp-th--md, .pdp-td--md { display: table-cell; } }
        .pdp-th--lg { display: none; }
        @media (min-width: 1024px) { .pdp-th--lg, .pdp-td--lg { display: table-cell; } }

        .pdp-tr {
          border-bottom: 1px solid rgba(255,255,255,0.02);
          cursor: pointer;
          transition: background 0.12s;
        }
        .pdp-tr:hover { background: rgba(255,255,255,0.02); }
        .pdp-tr--selected {
          background: rgba(245,158,11,0.04);
          border-left: 2px solid var(--color-vemio-amber);
        }

        .pdp-td {
          padding: 8px 12px;
          font-size: 12px;
          vertical-align: middle;
        }
        .pdp-td--mono { font-family: monospace; font-size: 11px; color: var(--color-vemio-text-muted); }
        .pdp-td--md { display: none; }

        .pdp-iface-name {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-vemio-text);
          font-family: monospace;
        }
        .pdp-iface-type {
          display: block;
          font-size: 9px;
          color: var(--color-vemio-text-dim);
          text-transform: capitalize;
          margin-top: 1px;
        }

        .pdp-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .pdp-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .pdp-media-badge {
          display: inline-flex;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .pdp-neighbor-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border: none;
          background: transparent;
          color: var(--color-vemio-text-muted);
          cursor: pointer;
          font-size: 12px;
          padding: 0;
          text-align: left;
          font-family: inherit;
        }
        .pdp-neighbor-link:hover .pdp-neighbor-name {
          color: var(--color-vemio-amber);
        }
        .pdp-neighbor-name {
          font-weight: 500;
          transition: color 0.12s;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 160px;
        }
        .pdp-neighbor-port {
          font-size: 9px;
          font-family: monospace;
          color: var(--color-vemio-text-dim);
          background: rgba(148,163,184,0.08);
          padding: 1px 5px;
          border-radius: 3px;
          flex-shrink: 0;
        }

        .pdp-vlans {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .pdp-vlan-chip {
          font-size: 10px;
          font-family: monospace;
          color: var(--color-vemio-text-dim);
        }

        .pdp-dim {
          font-size: 11px;
          color: var(--color-vemio-text-dim);
          opacity: 0.6;
        }

        .pdp-empty {
          padding: 32px 14px;
          text-align: center;
          font-size: 12px;
          color: var(--color-vemio-text-dim);
        }

        .pdp-footer {
          display: flex;
          justify-content: flex-end;
        }
        .pdp-count {
          font-size: 10px;
          color: var(--color-vemio-text-dim);
        }
      `}</style>
    </div>
  );
}