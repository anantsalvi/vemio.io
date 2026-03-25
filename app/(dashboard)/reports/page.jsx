'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Download, FileText, Shield, Server, ChevronDown } from 'lucide-react';

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

const REPORT_TYPES = [
  { key: 'sla', label: 'SLA Compliance Report', desc: 'Ticket SLA metrics, breach analysis, and compliance percentages', icon: FileText },
  { key: 'bcs', label: 'BCS Summary Report', desc: 'Business Continuity Score with dimension breakdown and trend', icon: Shield },
  { key: 'device_health', label: 'Device Health Report', desc: 'Device status by type and site, down device inventory', icon: Server },
];

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

// ── PDF Renderer ────────────────────────────────────────────────────────────

function generatePDFContent(data) {
  if (!data) return '';
  const { report_type, report_month, generated_at, tenant } = data;
  const monthLabel = new Date(report_month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const generatedLabel = new Date(generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #F59E0B;">
      <div>
        <div style="font-size:24px;font-weight:800;color:#F59E0B;letter-spacing:-0.5px;">VEMIO™</div>
        <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:2px;margin-top:2px;">Network Intelligence</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:14px;font-weight:600;color:#1E293B;">${tenant.name}</div>
        <div style="font-size:11px;color:#64748B;">Plan: ${(tenant.plan || 'essentials').charAt(0).toUpperCase() + (tenant.plan || 'essentials').slice(1)}</div>
      </div>
    </div>
    <div style="margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;color:#0F172A;">${
        report_type === 'sla' ? 'SLA Compliance Report' :
        report_type === 'bcs' ? 'Business Continuity Score Report' :
        'Device Health Report'
      }</div>
      <div style="font-size:12px;color:#64748B;margin-top:4px;">${monthLabel} · Generated ${generatedLabel} IST</div>
    </div>
  `;

  if (report_type === 'sla') return header + renderSLAReport(data);
  if (report_type === 'bcs') return header + renderBCSReport(data);
  if (report_type === 'device_health') return header + renderDeviceHealthReport(data);
  return header;
}

function renderSLAReport(data) {
  const { summary, sla_compliance, sla_by_priority, breached_tickets } = data;
  const rc = sla_compliance.response ?? 'N/A';
  const rsc = sla_compliance.resolution ?? 'N/A';

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      ${metricCard('Total Tickets', summary.total_tickets)}
      ${metricCard('Resolved', summary.resolved, '#10B981')}
      ${metricCard('Open', summary.open, summary.open > 0 ? '#F59E0B' : '#64748B')}
      ${metricCard('SLA Breaches', sla_compliance.resolution_breached, sla_compliance.resolution_breached > 0 ? '#EF4444' : '#10B981')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
      ${complianceCard('Response SLA', rc, sla_compliance.response_met, sla_compliance.response_breached)}
      ${complianceCard('Resolution SLA', rsc, sla_compliance.resolution_met, sla_compliance.resolution_breached)}
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px;">SLA by Priority</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="padding:8px 12px;text-align:left;border-bottom:1px solid #E2E8F0;color:#64748B;text-transform:uppercase;font-size:10px;">Priority</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;text-transform:uppercase;font-size:10px;">Total</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;text-transform:uppercase;font-size:10px;">Met</th>
            <th style="padding:8px 12px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;text-transform:uppercase;font-size:10px;">Breached</th>
            <th style="padding:8px 12px;text-align:right;border-bottom:1px solid #E2E8F0;color:#64748B;text-transform:uppercase;font-size:10px;">Avg Resolution</th>
          </tr>
        </thead>
        <tbody>
          ${sla_by_priority.map(r => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;font-weight:500;text-transform:capitalize;">${r.priority}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;text-align:center;">${r.total}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;text-align:center;color:#10B981;">${r.met}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;text-align:center;color:${r.breached > 0 ? '#EF4444' : '#64748B'};">${r.breached}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #F1F5F9;text-align:right;">${r.avg_resolution_hours}h</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${breached_tickets.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:#EF4444;margin-bottom:8px;">SLA Breaches</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#FEF2F2;">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">ID</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Title</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Priority</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Status</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Site</th>
          </tr>
        </thead>
        <tbody>
          ${breached_tickets.map(t => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;font-family:monospace;">#${t.glpi_ticket_id}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;text-transform:capitalize;">${t.priority}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;text-transform:capitalize;">${t.status}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${t.site_name || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8;">
      This report was generated by VEMIO™ · Vinay Enterprises · vinayenterprises.co.in
    </div>
  `;
}

function renderBCSReport(data) {
  const { current_score, trend, critical_devices } = data;
  if (!current_score) return '<p style="color:#64748B;">No BCS data available for this period.</p>';

  const dims = current_score.dimensions;
  const dimLabels = {
    visibility_coverage: 'Visibility Coverage',
    redundancy_readiness: 'Redundancy Readiness',
    firmware_currency: 'Firmware Currency',
    config_integrity: 'Config Integrity',
    alerting_maturity: 'Alerting Maturity',
    response_discipline: 'Response Discipline',
  };

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px;text-align:center;">
        <div style="font-size:48px;font-weight:800;color:${current_score.score >= 70 ? '#10B981' : current_score.score >= 50 ? '#F59E0B' : '#EF4444'};">${current_score.score}</div>
        <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Composite Score</div>
      </div>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;">
        <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">Dimensions</div>
        ${Object.entries(dims).map(([key, val]) => `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;">
            <span style="color:#475569;">${dimLabels[key]}</span>
            <span style="font-weight:600;color:${val >= 70 ? '#10B981' : val >= 50 ? '#F59E0B' : '#EF4444'};">${val.toFixed(1)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    ${trend.length > 1 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px;">Score Trend (${trend.length} data points)</div>
      <div style="display:flex;align-items:flex-end;gap:2px;height:60px;">
        ${trend.map(t => {
          const h = Math.max(4, (t.score / 100) * 60);
          const color = t.score >= 70 ? '#10B981' : t.score >= 50 ? '#F59E0B' : '#EF4444';
          return `<div style="flex:1;height:${h}px;background:${color};border-radius:2px 2px 0 0;min-width:4px;" title="${t.score}"></div>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${critical_devices.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px;">Critical Infrastructure (${critical_devices.length} devices)</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Device</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Type</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Status</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Redundancy</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Firmware</th>
          </tr>
        </thead>
        <tbody>
          ${critical_devices.map(d => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;font-weight:500;">${d.name}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${d.device_type}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;color:${d.current_status === 'up' ? '#10B981' : '#EF4444'};font-weight:600;text-transform:uppercase;">${d.current_status}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${d.has_redundancy === true ? '✓ HA' : d.has_redundancy === false ? '✗ Single' : '—'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${d.firmware_is_current === true ? '✓ Current' : d.firmware_is_current === false ? '✗ Outdated' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8;">
      This report was generated by VEMIO™ · Vinay Enterprises · vinayenterprises.co.in
    </div>
  `;
}

function renderDeviceHealthReport(data) {
  const { overall, by_type, by_site, down_devices } = data;

  return `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      ${metricCard('Total Devices', overall.total)}
      ${metricCard('Devices Up', overall.up, '#10B981')}
      ${metricCard('Health', overall.health_percent + '%', overall.health_percent >= 90 ? '#10B981' : overall.health_percent >= 70 ? '#F59E0B' : '#EF4444')}
    </div>

    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px;">By Device Type</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Type</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Total</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Up</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Down</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Degraded</th>
          </tr>
        </thead>
        <tbody>
          ${by_type.map(r => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-transform:capitalize;">${r.device_type.replace(/_/g, ' ')}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${r.total}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;color:#10B981;">${r.up}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;color:${r.down > 0 ? '#EF4444' : '#64748B'};">${r.down}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;color:${r.degraded > 0 ? '#F59E0B' : '#64748B'};">${r.degraded}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${by_site.length > 0 ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px;">By Site</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#F8FAFC;">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Site</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Total</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Up</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #E2E8F0;color:#64748B;font-size:10px;">Down</th>
          </tr>
        </thead>
        <tbody>
          ${by_site.map(r => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${r.site_name}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${r.total}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;color:#10B981;">${r.up}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;color:${r.down > 0 ? '#EF4444' : '#64748B'};">${r.down}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${down_devices.length > 0 ? `
    <div>
      <div style="font-size:13px;font-weight:600;color:#EF4444;margin-bottom:8px;">Down Devices (top 20)</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#FEF2F2;">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Device</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Type</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Site</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid #FECACA;color:#991B1B;font-size:10px;">Critical</th>
          </tr>
        </thead>
        <tbody>
          ${down_devices.map(d => `
            <tr>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${d.name}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${d.device_type}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${d.site_name || '—'}</td>
              <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;text-align:center;">${d.is_critical ? '⚠ Yes' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:10px;color:#94A3B8;">
      This report was generated by VEMIO™ · Vinay Enterprises · vinayenterprises.co.in
    </div>
  `;
}

function metricCard(label, value, color = '#0F172A') {
  return `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px 16px;">
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;">${label}</div>
      <div style="font-size:24px;font-weight:700;color:${color};margin-top:4px;">${value}</div>
    </div>
  `;
}

function complianceCard(label, percent, met, breached) {
  const color = percent === 'N/A' ? '#64748B' : percent >= 90 ? '#10B981' : percent >= 70 ? '#F59E0B' : '#EF4444';
  return `
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:16px;">
      <div style="font-size:10px;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${label}</div>
      <div style="font-size:28px;font-weight:700;color:${color};">${percent}${percent !== 'N/A' ? '%' : ''}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:4px;">${met} met · ${breached} breached</div>
    </div>
  `;
}

// ── Report Preview + Download ───────────────────────────────────────────────

function ReportPreview({ data, onDownload, downloading }) {
  const content = generatePDFContent(data);

  return (
    <div>
      {/* Preview */}
      <div
        className="rounded-xl overflow-hidden mb-4"
        style={{
          background: '#FFF',
          border: '1px solid var(--color-vemio-border)',
          maxHeight: '600px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{ padding: '32px', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '12px', color: '#1E293B' }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>

      {/* Download button */}
      <button
        onClick={onDownload}
        disabled={downloading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
        style={{
          background: 'var(--color-vemio-amber)',
          color: '#0F172A',
        }}
      >
        <Download className="w-4 h-4" />
        {downloading ? 'Generating PDF...' : 'Download PDF'}
      </button>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reportType, setReportType] = useState('sla');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const months = getMonthOptions();

  async function generateReport() {
    setLoading(true);
    setData(null);
    try {
      const res = await fetch(`/api/reports?type=${reportType}&month=${month}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      console.error('Report generation failed:', err);
    } finally {
      setLoading(false);
    }
  }

  function downloadPDF() {
    if (!data) return;
    setDownloading(true);

    const content = generatePDFContent(data);
    const monthLabel = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).replace(' ', '-');
    const filename = `VEMIO-${reportType}-${monthLabel}.pdf`;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${filename}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1E293B; margin: 0; padding: 0; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
      setDownloading(false);
    }, 500);
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h1 className="text-xl font-bold text-vemio-text">Reports</h1>
        <p className="text-sm text-vemio-text-muted mt-0.5">Generate and download monthly PDF reports</p>
      </motion.div>

      {/* Report Selector */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const isActive = reportType === rt.key;
          return (
            <button
              key={rt.key}
              onClick={() => { setReportType(rt.key); setData(null); }}
              className="rounded-xl p-4 text-left transition-all"
              style={{
                background: isActive ? 'rgba(245,158,11,0.06)' : 'var(--color-vemio-surface)',
                border: isActive ? '1px solid rgba(245,158,11,0.25)' : '1px solid var(--color-vemio-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${isActive ? 'text-vemio-amber' : 'text-vemio-text-dim'}`} />
                <span className={`text-sm font-semibold ${isActive ? 'text-vemio-amber' : 'text-vemio-text'}`}>
                  {rt.label}
                </span>
              </div>
              <p className="text-xs text-vemio-text-dim">{rt.desc}</p>
            </button>
          );
        })}
      </motion.div>

      {/* Month Selector + Generate */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <select
          value={month}
          onChange={e => { setMonth(e.target.value); setData(null); }}
          className="px-3 py-2 rounded-lg text-sm text-vemio-text"
          style={{
            background: 'var(--color-vemio-surface)',
            border: '1px solid var(--color-vemio-border)',
          }}
        >
          {months.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <button
          onClick={generateReport}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: 'var(--color-vemio-amber)',
            color: '#0F172A',
          }}
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Generate Report
        </button>
      </motion.div>

      {/* Report Preview */}
      {data && (
        <motion.div variants={fadeUp}>
          <ReportPreview data={data} onDownload={downloadPDF} downloading={downloading} />
        </motion.div>
      )}
    </motion.div>
  );
}