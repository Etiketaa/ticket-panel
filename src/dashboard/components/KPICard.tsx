import type { KPI } from '../types';

export function KPICard({ title, value, subtitle, trend, color = 'var(--text)' }: KPI) {
  const arrow = trend?.up ? '▲' : '▼';
  const trendLabel = trend ? (
    <span className={`kpi-trend ${trend.up ? 'trend-up' : 'trend-down'}`} aria-label={trend.label}>
      {arrow} {trend.label}
    </span>
  ) : null;

  return (
    <article className="kpi-card" style={{ borderColor: color }}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value" style={{ color }}>
        {value}
      </div>
      {subtitle && <div className="kpi-sub">{subtitle}</div>}
      {trendLabel}
    </article>
  );
}
