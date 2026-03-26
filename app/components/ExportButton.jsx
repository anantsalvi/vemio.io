'use client';

import { Download } from 'lucide-react';
import { downloadCSV } from '@/lib/exportCSV';

/**
 * VEMIO™ — Export CSV Button
 *
 * Drop-in button that exports data to CSV.
 *
 * Usage:
 *   <ExportButton
 *     data={devices}
 *     filename="devices"
 *     columns={['name', 'status', 'ipAddress', 'type', 'siteName']}
 *     headers={{ ipAddress: 'IP Address', siteName: 'Site' }}
 *   />
 */
export default function ExportButton({ data, filename = 'export', columns, headers, label = 'Export CSV' }) {
  const isEmpty = !data || data.length === 0;

  return (
    <button
      onClick={() => downloadCSV(data, filename, columns, headers)}
      disabled={isEmpty}
      className="export-btn"
      title={isEmpty ? 'No data to export' : `Download ${data.length} rows as CSV`}
    >
      <Download className="w-3.5 h-3.5" />
      <span className="export-btn-label">{label}</span>

      <style>{`
        .export-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          color: var(--color-vemio-text-muted);
          background: var(--color-vemio-surface);
          border: 1px solid var(--color-vemio-border);
          transition: background 0.15s, color 0.15s, border-color 0.15s;
          flex-shrink: 0;
        }

        .export-btn:hover:not(:disabled) {
          background: var(--color-vemio-surface-raised);
          color: var(--color-vemio-text);
          border-color: var(--color-vemio-text-dim);
        }

        .export-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        @media (max-width: 479px) {
          .export-btn-label { display: none; }
          .export-btn { padding: 7px 8px; }
        }
      `}</style>
    </button>
  );
}