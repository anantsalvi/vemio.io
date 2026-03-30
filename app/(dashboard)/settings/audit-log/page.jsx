/**
 * VEMIO™ — Audit Log Page
 * Phase 7.2: Admin-only audit trail viewer.
 * 
 * Route: /settings/audit-log
 * Access: Admin only
 * 
 * Features:
 * - Paginated event log with action, user, timestamp, IP
 * - Filter by action type, user, date range
 * - CSV export
 * - Expandable detail rows
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const ACTION_LABELS = {
  login_success: 'Login',
  login_failed: 'Login Failed',
  login_sso: 'SSO Login',
  logout: 'Logout',
  sso_config_updated: 'SSO Config Changed',
  branding_updated: 'Branding Updated',
  notification_prefs_updated: 'Notification Prefs Updated',
  report_downloaded: 'Report Downloaded',
  report_scheduled: 'Report Scheduled',
  report_schedule_deleted: 'Schedule Deleted',
  user_created: 'User Created',
  user_updated: 'User Updated',
  user_deactivated: 'User Deactivated',
  user_role_changed: 'Role Changed',
  alert_acknowledged: 'Alert Acknowledged',
  alert_resolved: 'Alert Resolved',
  audit_log_exported: 'Audit Log Exported',
};

const ACTION_COLORS = {
  login_success: '#1D9E75',
  login_sso: '#1D9E75',
  login_failed: '#E24B4A',
  logout: '#8A8A8A',
  sso_config_updated: '#C89700',
  user_role_changed: '#C89700',
  user_deactivated: '#E24B4A',
  alert_acknowledged: '#EF9F27',
  alert_resolved: '#1D9E75',
  report_downloaded: '#378ADD',
};

export default function AuditLogPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchEntries = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (actionFilter) params.set('action', actionFilter);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());

      const res = await fetch(`/api/audit-log?${params}`);
      if (!res.ok) throw new Error('Failed to fetch audit log');
      const data = await res.json();
      setEntries(data.entries || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (err) {
      console.error('Audit log fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, fromDate, toDate]);

  useEffect(() => { if (isAdmin) fetchEntries(); }, [fetchEntries, isAdmin]);

  const handleExportCSV = async () => {
    const params = new URLSearchParams({ export: 'csv' });
    if (actionFilter) params.set('action', actionFilter);
    if (fromDate) params.set('from', new Date(fromDate).toISOString());
    if (toDate) params.set('to', new Date(toDate + 'T23:59:59').toISOString());

    const res = await fetch(`/api/audit-log?${params}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vemio-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  if (!isAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <h2 style={styles.adTitle}>Access Denied</h2>
          <p style={styles.adText}>Audit log requires admin privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Audit Log</h1>
          <p style={styles.subtitle}>
            Track all user actions across your organization
            {pagination.total > 0 && (
              <span style={styles.totalBadge}>{pagination.total.toLocaleString()} events</span>
            )}
          </p>
        </div>
        <button onClick={handleExportCSV} style={styles.exportBtn}>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={styles.filterBar}>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          style={styles.filterInput}
          placeholder="From"
        />
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          style={styles.filterInput}
          placeholder="To"
        />
        {(actionFilter || fromDate || toDate) && (
          <button
            onClick={() => { setActionFilter(''); setFromDate(''); setToDate(''); }}
            style={styles.clearBtn}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.loadingDot} />
            <span style={styles.loadingText}>Loading audit log...</span>
          </div>
        ) : entries.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No audit events found</p>
            <p style={styles.emptyHint}>Events will appear here as users interact with VEMIO</p>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Timestamp</th>
                <th style={styles.th}>User</th>
                <th style={styles.th}>Action</th>
                <th style={styles.th}>Resource</th>
                <th style={styles.th}>IP Address</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isExpanded = expandedRow === entry.id;
                const actionColor = ACTION_COLORS[entry.action] || 'var(--vemio-text-muted)';
                return [
                  <tr
                    key={entry.id}
                    onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                    style={{
                      ...styles.tr,
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                  >
                    <td style={styles.td}>
                      <span style={styles.timestamp}>{formatTimestamp(entry.created_at)}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.userCell}>
                        <span style={styles.userName}>{entry.user_name || 'System'}</span>
                        <span style={styles.userEmail}>{entry.user_email || ''}</span>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.actionBadge,
                        color: actionColor,
                        background: actionColor + '15',
                      }}>
                        {ACTION_LABELS[entry.action] || entry.action}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.resource}>
                        {entry.resource_type ? `${entry.resource_type}${entry.resource_id ? `: ${entry.resource_id}` : ''}` : ''}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.ip}>{entry.ip_address || ''}</span>
                    </td>
                  </tr>,
                  isExpanded && (
                    <tr key={entry.id + '-detail'}>
                      <td colSpan={5} style={styles.detailCell}>
                        <div style={styles.detailGrid}>
                          {entry.details && Object.keys(entry.details).length > 0 && (
                            <div style={styles.detailItem}>
                              <span style={styles.detailLabel}>Details</span>
                              <pre style={styles.detailPre}>{JSON.stringify(entry.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={styles.paginationBar}>
          <button
            onClick={() => fetchEntries(pagination.page - 1)}
            disabled={pagination.page <= 1}
            style={{
              ...styles.pageBtn,
              opacity: pagination.page <= 1 ? 0.3 : 1,
            }}
          >
            Previous
          </button>
          <span style={styles.pageInfo}>
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            onClick={() => fetchEntries(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            style={{
              ...styles.pageBtn,
              opacity: pagination.page >= pagination.pages ? 0.3 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '32px 24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
    gap: '16px',
    flexWrap: 'wrap',
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
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  totalBadge: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '4px',
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.45))',
  },
  exportBtn: {
    padding: '8px 16px',
    borderRadius: '7px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-surface, #141418)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  filterSelect: {
    padding: '8px 12px',
    borderRadius: '7px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-surface, #141418)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    fontFamily: 'inherit',
    minWidth: '160px',
  },
  filterInput: {
    padding: '8px 12px',
    borderRadius: '7px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-surface, #141418)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    fontFamily: 'inherit',
    colorScheme: 'dark',
  },
  clearBtn: {
    padding: '8px 12px',
    borderRadius: '7px',
    border: 'none',
    background: 'rgba(226, 75, 74, 0.1)',
    color: '#E24B4A',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tableWrap: {
    background: 'var(--vemio-surface, #141418)',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.06))',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.4))',
    borderBottom: '1px solid var(--vemio-border, rgba(255,255,255,0.06))',
    whiteSpace: 'nowrap',
  },
  tr: {
    borderBottom: '1px solid var(--vemio-border, rgba(255,255,255,0.04))',
    transition: 'background 0.1s',
  },
  td: {
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--vemio-text, #E8E6E1)',
    verticalAlign: 'top',
  },
  timestamp: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  userCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  userName: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
  },
  userEmail: {
    fontSize: '11px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.35))',
  },
  actionBadge: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 8px',
    borderRadius: '5px',
    whiteSpace: 'nowrap',
  },
  resource: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.45))',
    fontFamily: 'monospace',
  },
  ip: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.4))',
    fontFamily: 'monospace',
    fontVariantNumeric: 'tabular-nums',
  },
  detailCell: {
    padding: '0 14px 14px',
    background: 'rgba(255,255,255,0.01)',
  },
  detailGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailLabel: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.4))',
  },
  detailPre: {
    fontSize: '12px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
    fontFamily: 'monospace',
    background: 'rgba(255,255,255,0.02)',
    padding: '10px 12px',
    borderRadius: '6px',
    margin: 0,
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  paginationBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    marginTop: '16px',
  },
  pageBtn: {
    padding: '7px 14px',
    borderRadius: '6px',
    border: '1px solid var(--vemio-border, rgba(255,255,255,0.1))',
    background: 'var(--vemio-surface, #141418)',
    color: 'var(--vemio-text, #E8E6E1)',
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pageInfo: {
    fontSize: '13px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.55))',
  },
  loadingWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '60px 0',
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
  emptyState: {
    textAlign: 'center',
    padding: '60px 24px',
  },
  emptyText: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--vemio-text, #E8E6E1)',
    marginBottom: '6px',
  },
  emptyHint: {
    fontSize: '13px',
    color: 'var(--vemio-text-muted, rgba(232,230,225,0.45))',
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
};