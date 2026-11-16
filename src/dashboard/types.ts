export type ChartPoint = { t: string; v: number };

export type AreaSeries = {
  key: string;
  label: string;
  color: string; // p. ej. 'var(--accent)' o 'var(--success)'
  data: ChartPoint[];
};

export type BarItem = {
  label: string;
  value: number;
  color?: string;
};

export type KPITrend = { label: string; up: boolean };

export type KPITone =
  | 'neutral'
  | 'accent'
  | 'warning'
  | 'success'
  | 'muted'
  | 'danger'
  | 'dim';

export type KPI = {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: KPITrend;
  tone?: KPITone;
};
