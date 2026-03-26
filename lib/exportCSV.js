/**
 * VEMIO™ — CSV Export Utility
 *
 * Converts an array of objects to a CSV string and triggers a browser download.
 *
 * Usage:
 *   import { downloadCSV } from '@/lib/exportCSV';
 *   downloadCSV(devices, 'devices-export', ['name', 'status', 'ip_address']);
 *   downloadCSV(tickets, 'tickets-export'); // exports all keys
 */

/**
 * Convert array of objects to CSV string.
 * @param {Object[]} data - Array of flat objects
 * @param {string[]} [columns] - Specific columns to include (in order). If omitted, uses all keys from first row.
 * @param {Object} [headers] - Column key → display header mapping. If omitted, uses the key with underscores replaced.
 */
export function toCSV(data, columns, headers) {
  if (!data || data.length === 0) return '';

  const cols = columns || Object.keys(data[0]);
  const headerRow = cols.map(col => {
    const label = headers?.[col] || col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return escapeCSV(label);
  });

  const rows = data.map(row =>
    cols.map(col => escapeCSV(row[col] ?? '')).join(',')
  );

  return [headerRow.join(','), ...rows].join('\n');
}

function escapeCSV(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Trigger a CSV file download in the browser.
 * @param {Object[]} data - Array of objects to export
 * @param {string} filename - Filename without extension
 * @param {string[]} [columns] - Specific columns to include
 * @param {Object} [headers] - Column key → display header mapping
 */
export function downloadCSV(data, filename = 'export', columns, headers) {
  const csv = toCSV(data, columns, headers);
  if (!csv) return;

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}