/**
 * Recharts implementation behind ChartBlock's dynamic import.
 *
 * Both variants share one axis-free presentation and one tooltip theme, and
 * both state "no data" rather than drawing an empty ring, which previously
 * read as a zero-rate compliance failure to operators.
 */
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartBlockProps, ChartDatum } from './ChartBlock';

const TOOLTIP_STYLE = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 11,
  color: '#e2e8f0',
};

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#8b5cf6', '#f59e0b', '#14b8a6', '#ec4899', '#a855f7'];

function NoData({ height, label }: { height: number; label?: string }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 text-xs text-slate-400"
    >
      {label ?? 'No records to plot yet'}
    </div>
  );
}

const ChartImpl: React.FC<Omit<ChartBlockProps, 'variant'> & { variant: ChartBlockProps['variant'] }> = ({
  variant,
  data,
  height = 260,
  emptyLabel,
}) => {
  const series: ChartDatum[] = data.map((point, index) => ({
    ...point,
    color: point.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
  }));

  const total = series.reduce((sum, point) => sum + (Number.isFinite(point.value) ? point.value : 0), 0);
  if (series.length === 0 || total === 0) return <NoData height={height} label={emptyLabel} />;

  if (variant === 'donut') {
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={series}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={Math.round(height * 0.2)}
              outerRadius={Math.round(height * 0.34)}
              paddingAngle={3}
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {series.map(point => (
                <Cell key={point.name} fill={point.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} interval={0} />
          <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="value" name="Volume" radius={[8, 8, 0, 0]} maxBarSize={48}>
            {series.map(point => (
              <Cell key={point.name} fill={point.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default React.memo(ChartImpl);
