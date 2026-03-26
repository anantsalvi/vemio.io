// app/components/ResponsiveGrid.jsx
// Drop-in responsive layout helpers used across all 8 dashboard pages.
// Usage:
//   <PageGrid>          — outer page wrapper (max-width + padding handled by layout)
//     <StatRow>         — 2-col on mobile, 4-col on desktop KPI row
//       <StatCard ...>
//     </StatRow>
//     <ContentGrid>     — 1-col mobile / 2-col desktop split (e.g. chart + table)
//       <Panel>
//     </ContentGrid>
//   </PageGrid>

export function PageGrid({ children, className = "" }) {
  return (
    <>
      <div className={`page-grid ${className}`}>{children}</div>
      <style>{`
        .page-grid {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1400px;
        }
        @media (max-width: 767px) {
          .page-grid { gap: 14px; }
        }
      `}</style>
    </>
  );
}

export function StatRow({ children }) {
  return (
    <>
      <div className="stat-row">{children}</div>
      <style>{`
        .stat-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 1023px) {
          .stat-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 479px) {
          .stat-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        }
      `}</style>
    </>
  );
}

export function StatCard({ label, value, sub, accent, icon: Icon }) {
  return (
    <>
      <div className={`stat-card ${accent ? `stat-card--${accent}` : ""}`}>
        <div className="stat-card-top">
          <span className="stat-label">{label}</span>
          {Icon && <Icon size={16} className="stat-icon" />}
        </div>
        <div className="stat-value">{value ?? "—"}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
      <style>{`
        .stat-card {
          background: var(--vemio-surface);
          border: 1px solid var(--vemio-border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 0;
        }
        .stat-card--amber { border-color: color-mix(in srgb, var(--vemio-amber) 30%, transparent); }
        .stat-card--up    { border-color: color-mix(in srgb, var(--status-up)   30%, transparent); }
        .stat-card--high  { border-color: color-mix(in srgb, var(--severity-high) 30%, transparent); }
        .stat-card--critical { border-color: color-mix(in srgb, var(--severity-critical) 30%, transparent); }

        .stat-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .stat-label {
          font-size: 11.5px;
          color: var(--vemio-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 500;
        }
        .stat-icon {
          color: var(--vemio-text-dim);
          flex-shrink: 0;
        }
        .stat-value {
          font-size: 26px;
          font-weight: 700;
          color: var(--vemio-text);
          line-height: 1;
        }
        .stat-sub {
          font-size: 12px;
          color: var(--vemio-text-dim);
        }

        @media (max-width: 479px) {
          .stat-card { padding: 12px; }
          .stat-value { font-size: 22px; }
        }
      `}</style>
    </>
  );
}

// Two-column layout: wide left (chart/main) + narrow right (sidebar/table)
// Stacks to single column on mobile
export function ContentGrid({ children, ratio = "2fr 1fr" }) {
  return (
    <>
      <div className="content-grid" style={{ "--ratio": ratio }}>
        {children}
      </div>
      <style>{`
        .content-grid {
          display: grid;
          grid-template-columns: var(--ratio);
          gap: 16px;
        }
        @media (max-width: 1023px) {
          .content-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}

// Generic surface panel
export function Panel({ children, title, action, className = "" }) {
  return (
    <>
      <div className={`panel ${className}`}>
        {(title || action) && (
          <div className="panel-header">
            {title && <h2 className="panel-title">{title}</h2>}
            {action && <div className="panel-action">{action}</div>}
          </div>
        )}
        {children}
      </div>
      <style>{`
        .panel {
          background: var(--vemio-surface);
          border: 1px solid var(--vemio-border);
          border-radius: 12px;
          overflow: hidden;
          min-width: 0;
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 0;
          gap: 8px;
        }
        .panel-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--vemio-text);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .panel-action {
          flex-shrink: 0;
        }
      `}</style>
    </>
  );
}

// Responsive table wrapper — horizontal scroll on mobile
export function TableWrap({ children }) {
  return (
    <>
      <div className="table-wrap">{children}</div>
      <style>{`
        .table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .table-wrap table {
          min-width: 560px;
          width: 100%;
          border-collapse: collapse;
        }
      `}</style>
    </>
  );
}