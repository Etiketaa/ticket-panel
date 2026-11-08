import { extent, niceTicks, scaleLinear } from '../utils/chartHelpers';
import type { BarItem } from '../types';

interface BarChartProps {
  data: BarItem[];
  width?: number;
  height?: number;
  'aria-label'?: string;
}

const MARGIN = { top: 22, right: 16, bottom: 44, left: 44 };

export function BarChart({ data, width = 520, height = 260, 'aria-label': ariaLabel }: BarChartProps) {
  const values = data.map((d) => d.value);
  const [, vMaxRaw] = extent(values);
  const max = vMaxRaw === 0 ? 1 : vMaxRaw;
  const yTicks = niceTicks(0, max, 5);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const bottomY = MARGIN.top + plotHeight;
  const yScale = scaleLinear([0, max], [plotHeight, 0]); // px desde el tope del área de plot
  const step = plotWidth / Math.max(1, data.length);
  const barW = step * 0.55;

  return (
    <div className="chart-wrap" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? 'Gráfico de barras de tickets'}
        style={{ display: 'block' }}
      >
        <title id="bar-title">{ariaLabel ?? 'Gráfico de barras de tickets'}</title>
        <desc id="bar-desc">
          Cada barra representa una prioridad o categoría. La altura es proporcional
          a la cantidad de tickets y el valor está escrito encima de cada barra.
        </desc>

        {/* Grid y etiquetas del eje Y */}
        {yTicks.map((tick) => {
          const py = yScale(tick);
          const y = MARGIN.top + py;
          return (
            <>
              <line
                key={tick}
                x1={MARGIN.left}
                x2={MARGIN.left + plotWidth}
                y1={y}
                y2={y}
                stroke="var(--border)"
                stroke-opacity="0.3"
              />
              <text
                key={`y-${tick}`}
                x={MARGIN.left - 8}
                y={y + 4}
                text-anchor="end"
                className="axis-label"
              >
                {tick}
              </text>
            </>
          );
        })}

        {/* Barras + etiquetas de valor */}
        {data.map((d, i) => {
          const h = yScale(d.value);
          const x = MARGIN.left + i * step + (step - barW) / 2;
          const y = bottomY - h;
          return (
            <g key={i} className="bar-group">
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(0, h)}
                fill={d.color ?? 'var(--text-muted)'}
              >
                <title>
                  {`${d.label}: ${d.value} ticket${d.value !== 1 ? 's' : ''}`}
                </title>
              </rect>
              {d.value > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 8}
                  className="bar-label"
                >
                  {d.value}
                </text>
              )}
            </g>
          );
        })}

        {/* Ejes */}
        <path
          d={`M${MARGIN.left} ${MARGIN.top} L${MARGIN.left} ${bottomY} L${MARGIN.left + plotWidth} ${bottomY}`}
          fill="none"
          stroke="var(--border)"
          stroke-width="1"
        />

        {/* Etiquetas del eje X */}
        {data.map((d, i) => (
          <text
            key={`x-${i}`}
            x={MARGIN.left + i * step + step / 2}
            y={bottomY + 18}
            text-anchor="middle"
            className="axis-label"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
