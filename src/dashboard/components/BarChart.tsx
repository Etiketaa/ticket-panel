import { extent, niceTicks, scaleLinear } from '../utils/chartHelpers';
import type { BarItem } from '../types';

interface BarChartProps {
  data: BarItem[];
  /** Ancho y alto del lienzo SVG (en unidades de usuario). El render es fluido. */
  width?: number;
  height?: number;
  'aria-label'?: string;
}

const MARGIN = { top: 22, right: 16, bottom: 44, left: 44 };

const BAR_COLORS = [
  'var(--neon-primary)',
  'var(--neon-secondary)',
  'var(--neon-danger)',
  'var(--neon-success)',
  'var(--prio-media)',
] as const;

export function BarChart({ data, width = 520, height = 260, 'aria-label': ariaLabel }: BarChartProps) {
  const values = data.map((d) => d.value);
  const [, vMaxRaw] = extent(values);
  const max = vMaxRaw === 0 ? 1 : vMaxRaw;
  const yTicks = niceTicks(0, max, 5);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const bottomY = MARGIN.top + plotHeight;
  const yScale = scaleLinear([0, max] as [number, number], [plotHeight, 0]); // px desde el tope del área de plot
  const step = plotWidth / Math.max(1, data.length);
  const barW = step * 0.55;

  return (
    <div className="chart-wrap" style={{ minHeight: height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={ariaLabel}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Ejes */}
        <g stroke="var(--border)" strokeWidth="1">
          <line x1={MARGIN.left} y1={bottomY} x2={width - MARGIN.right} y2={bottomY} />
          <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={bottomY} />
        </g>

        {/* Etiquetas del eje Y */}
        <g
          fontSize="var(--font-xs)"
          fontFamily="var(--font-mono)"
          fill="var(--text-muted)"
          textAnchor="end"
        >
          {yTicks.map((tick) => {
            const y = bottomY - yScale(tick);
            return (
              <text key={tick} x={MARGIN.left - 6} y={y + 4}>
                {tick}
              </text>
            );
          })}
        </g>

        {/* Barras */}
        <g>
          {data.map((d, i) => {
            const x = MARGIN.left + i * step + (step - barW) / 2;
            const h = yScale(d.value);
            const y = bottomY - h;
            const color = d.color || BAR_COLORS[i % BAR_COLORS.length];
            return (
              <g key={d.label}>
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, h)}
                  fill={color}
                  rx={2}
                  ry={2}
                />
                <text
                  className="bar-label"
                  x={x + barW / 2}
                  y={y - 6}
                  fontSize="var(--font-xs)"
                  fontFamily="var(--font-mono)"
                  fill="var(--text-dim)"
                >
                  {d.value}
                </text>
              </g>
            );
          })}
        </g>

        {/* Etiquetas del eje X */}
        <g
          fontSize="var(--font-xs)"
          fontFamily="var(--font-mono)"
          fill="var(--text-muted)"
          textAnchor="middle"
        >
          {data.map((d, i) => (
            <text key={d.label} x={MARGIN.left + i * step + step / 2} y={bottomY + 16}>
              {d.label}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}
