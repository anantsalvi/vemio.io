'use client';

/**
 * VEMIO™ — Skeleton Loading Components
 *
 * Reusable shimmer placeholders that match the actual component layouts.
 * Used while data is loading for the first time (no cached data available).
 */

function Bone({ width = '100%', height = 12, radius = 6, className = '' }) {
  return (
    <div
      className={`skeleton-bone ${className}`}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

function Card({ children, className = '' }) {
  return (
    <div className={`skeleton-card ${className}`}>
      {children}
    </div>
  );
}

/** Skeleton for the Overview page stat cards (6 cards in a 3x2 grid) */
export function OverviewSkeleton() {
  return (
    <div className="skeleton-root">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bone width={180} height={20} />
        <Bone width={260} height={13} />
      </div>

      {/* Row 1: BCS + Device cards */}
      <div className="skeleton-row-1">
        <Card className="skeleton-bcs">
          <Bone width={140} height={10} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Bone width={180} height={100} radius={12} />
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 16 }}>
            <Bone width={50} height={24} />
            <Bone width={50} height={24} />
            <Bone width={50} height={24} />
          </div>
        </Card>
        <div className="skeleton-stats-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <Bone width={28} height={28} radius={8} />
              <div style={{ marginTop: 12 }}>
                <Bone width={48} height={24} />
                <Bone width={72} height={11} className="skeleton-mt-4" />
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Row 2: Charts */}
      <div className="skeleton-row-2">
        <Card>
          <Bone width={120} height={12} />
          <Bone width="100%" height={160} radius={8} className="skeleton-mt-12" />
        </Card>
        <Card>
          <Bone width={100} height={12} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Bone width={28} height={28} radius={8} />
                <div style={{ flex: 1 }}>
                  <Bone width="90%" height={11} />
                  <Bone width="60%" height={9} className="skeleton-mt-4" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <style>{skeletonStyles}</style>
    </div>
  );
}

/** Skeleton for the Device Health table page */
export function DevicesSkeleton() {
  return (
    <div className="skeleton-root">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bone width={160} height={20} />
        <Bone width={220} height={13} />
      </div>

      {/* Pills */}
      <div style={{ display: 'flex', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Bone key={i} width={90} height={32} radius={8} />
        ))}
      </div>

      {/* Search bar */}
      <Bone width="100%" height={40} radius={8} />

      {/* Table */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Header */}
          <div className="skeleton-table-row" style={{ borderBottom: '1px solid var(--color-vemio-border)' }}>
            <Bone width={60} height={10} />
            <Bone width={140} height={10} />
            <Bone width={80} height={10} />
            <Bone width={100} height={10} />
          </div>
          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-table-row">
              <Bone width={56} height={20} radius={12} />
              <Bone width={160} height={13} />
              <Bone width={70} height={11} />
              <Bone width={90} height={11} />
            </div>
          ))}
        </div>
      </Card>

      <style>{skeletonStyles}</style>
    </div>
  );
}

/** Skeleton for the Intelligence / BCS page */
export function IntelligenceSkeleton() {
  return (
    <div className="skeleton-root">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bone width={240} height={20} />
        <Bone width={300} height={13} />
      </div>

      <div className="skeleton-row-1">
        <Card className="skeleton-bcs">
          <Bone width={100} height={10} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <Bone width={180} height={100} radius={12} />
          </div>
        </Card>
        <Card>
          <Bone width={140} height={10} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Bone width={120} height={12} />
                  <Bone width={36} height={12} />
                </div>
                <Bone width="100%" height={8} radius={99} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <style>{skeletonStyles}</style>
    </div>
  );
}

/** Generic page skeleton */
export function PageSkeleton() {
  return (
    <div className="skeleton-root">
      <Bone width={200} height={20} />
      <Bone width={300} height={13} />
      <Card>
        <Bone width="100%" height={200} radius={8} />
      </Card>
      <style>{skeletonStyles}</style>
    </div>
  );
}

const skeletonStyles = `
  .skeleton-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-width: 1400px;
  }

  .skeleton-bone {
    background: linear-gradient(
      90deg,
      var(--color-vemio-surface-raised) 25%,
      var(--color-vemio-surface-hover) 50%,
      var(--color-vemio-surface-raised) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .skeleton-card {
    border-radius: 16px;
    padding: 20px;
    background: var(--color-vemio-surface);
    border: 1px solid var(--color-vemio-border);
  }

  .skeleton-mt-4 { margin-top: 4px; }
  .skeleton-mt-12 { margin-top: 12px; }

  .skeleton-row-1 {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 1023px) {
    .skeleton-row-1 { grid-template-columns: 1fr; }
  }

  .skeleton-row-2 {
    display: grid;
    grid-template-columns: 7fr 5fr;
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 767px) {
    .skeleton-row-2 { grid-template-columns: 1fr; }
  }

  .skeleton-bcs {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .skeleton-stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }
  @media (max-width: 767px) {
    .skeleton-stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .skeleton-table-row {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 12px 14px;
  }
`;