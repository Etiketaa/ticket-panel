import { useEffect, useRef } from 'react';
import { areaPath, extent, linePath } from '../utils/chartHelpers';
import type { AreaSeries } from '../types';

interface AreaChartProps {
  series: AreaSeries[];
  /** Ancho y alto del lienzo SVG (en unidades de usuario). El render es fluido. */
  width?: number;
  height?: number;
  /** Intervalo de auto-refresco en ms. Si se omite, no hay auto-refresh. */
  refreshIntervalMs?: number;
  /** Callback que el padre usa para volver a fetchar datos cuando toca refrescar. */
  onRefresh?: () => void;
  'aria-label'?: string;
}

const MARGIN = { top: 22, right: 16, bottom: 42, left: 52 };
const MAX_X_LABELS = 8;

const LINE_COLORS = [
  'var(--neon-primary)',
  'var(--neon-secondary)',
  'var(--neon-danger)',
  'var(--neon-success)',
] as const;

export function AreaChart({
  series,
  width = 520,
  height = 260,
  refreshIntervalMs,
  onRefresh,
  'aria-label': ariaLabel,
}: AreaChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Auto-refresco opcional para que el dashboard se sienta vivo sin recargar.
  useEffect(() => {
    if (!refreshIntervalMs || refreshIntervalMs < 1000) return;
    const id = window.setInterval(() => onRefresh?.(), refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [refreshIntervalMs, onRefresh]);

  return (
    <div className="chart-wrap" style={{ minHeight: height }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="grad-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--neon-primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--neon-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g>
          {series.map((s, si) => {
            const pts = s.data;
            if (pts.length < 2) return null;
            const color = s.color || LINE_COLORS[si % LINE_COLORS.length];

            const ys = pts.map((p) => p.v);
            const [yMin, yMax] = extent(ys);

            const last = Math.max(1, pts.length - 1);
            const sx = (i: number) =>
              MARGIN.left + (i / last) * (width - MARGIN.left - MARGIN.right);
            const spanY = Math.max(1, yMax - yMin);
            const sy = (v: number) =>
              height -
              MARGIN.bottom -
              ((v - yMin) / spanY) * (height - MARGIN.top - MARGIN.bottom);

            const points = pts.map((p, i) => ({ x: sx(i), y: sy(p.v) }));
            return (
              <g key={s.key}>
                <path
                  d={areaPath(points, height - MARGIN.bottom)}
                  fill="url(#grad-area)"
                  stroke="none"
                />
                <path d={linePath(points)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((_p, i) => (
                  <circle
                    key={i}
                    cx={sx(i)}
                    cy={sy(pts[i]?.v ?? 0)}
                    r={3}
                    fill="var(--bg)"
                    stroke={color}
                    strokeWidth="2"
                  />
                ))}
              </g>
            );
          })}

          {/* Ejes */}
          <g stroke="var(--border)" strokeWidth="1">
            <line
              x1={MARGIN.left}
              y1={height - MARGIN.bottom}
              x2={width - MARGIN.right}
              y2={height - MARGIN.bottom}
            />
            <line
              x1={MARGIN.left}
              y1={MARGIN.top}
              x2={MARGIN.left}
              y2={height - MARGIN.bottom}
            />
          </g>

          {/* Etiquetas del eje X */}
          <g
            fontSize="var(--font-xs)"
            fontFamily="var(--font-mono)"
            fill="var(--text-muted)"
            textAnchor="middle"
          >
            {xLabels(series[0]?.data ?? [], width, MARGIN, MAX_X_LABELS).map(
              (lab) => (
                <text key={lab.label} x={lab.x} y={height - MARGIN.bottom + 16}>
                  {lab.label}
                </text>
              )
            )}
          </g>
        </g>
      </svg>
    </div>
  );
}

function xLabels(
  pts: { t: string; v: number }[],
  width: number,
  margin: { left: number; right: number },
  maxLabels: number
): { label: string; x: number }[] {
  const step = Math.max(1, Math.floor(pts.length / maxLabels));
  const plotW = width - margin.left - margin.right;
  const labels: { label: string; x: number }[] = [];
  pts.forEach((_p, i) => {
    if (i % step === 0 || i === pts.length - 1) {
      labels.push({
        label: String(pts[i]?.t ?? ''),
        x: margin.left + i * (plotW / Math.max(1, pts.length - 1)),
      });
    }
  });
  return labels;
}
