'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-vemio-surface-raised)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      <p className="text-vemio-text-muted">{label}</p>
      <p className="text-vemio-teal font-semibold mt-0.5">
        {payload[0].value.toFixed(2)}% uptime
      </p>
    </div>
  );
}

export default function UptimeChart({ data }) {
  const chartData = data || [];

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: 'var(--color-vemio-surface)',
        border: '1px solid var(--color-vemio-border)',
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-vemio-text">Uptime Trend</h3>
          <p className="text-xs text-vemio-text-dim mt-0.5">Last 7 days · all sites</p>
        </div>
        {chartData.length > 0 && (
          <span className="text-lg font-bold tabular-nums text-vemio-teal">
            {chartData[chartData.length - 1]?.uptime?.toFixed(1)}%
          </span>
        )}
      </div>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
            <defs>
              <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-vemio-border)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-vemio-text-dim)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              }}
            />
            <YAxis
              domain={[97, 100]}
              tick={{ fontSize: 11, fill: 'var(--color-vemio-text-dim)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="uptime"
              stroke="#14b8a6"
              strokeWidth={2}
              fill="url(#uptimeGradient)"
              dot={{ r: 3, fill: '#14b8a6', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#14b8a6', stroke: '#0a0e17', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[220px] text-sm text-vemio-text-dim">
          No uptime data yet — connect Auvik webhooks to start tracking
        </div>
      )}
    </div>
  );
}
