import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { areaPath, extent, linePath, niceTicks, scaleLinear } from '../utils/chartHelpers';
import type { AreaSeries } from '../types';

interface AreaChartProps {
  series: AreaSeries[];
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
const HOVER_THRESHOLD = 30; // px

export function AreaChart({
  series,
  width = 520,
  height = 260,
  refreshIntervalMs,
  onRefresh,
  'aria-label': ariaLabel,
}: AreaChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Auto-refresh: solo vuelve a pedir datos al padre. No hay animación.
  useEffect(() => {
    if (!refreshIntervalMs || !onRefresh) return undefined;
    const id = setInterval(onRefresh, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs, onRefresh]);

  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const bottomY = MARGIN.top + plotHeight;

  const values = series.flatMap((s) => s.data.map((p) => p.v));
  const [, yMaxRaw] = extent(values);
  const yMax = yMaxRaw === 0 ? 1 : yMaxRaw;
  const yScale = scaleLinear([0, yMax], [bottomY, MARGIN.top]);
  const yTicks = niceTicks(0, yMax, 5);

  const n = series[0]?.data.length ?? 0;
  const xScale = scaleLinear([0, Math.max(0, n - 1)], [MARGIN.left, MARGIN.left + plotWidth]);
  const stepX = Math.max(1, Math.floor(n / MAX_X_LABELS));

  const points = series.flatMap((s) =>
    s.data.map((p, i) => ({
      key: s.key,
      x: xScale(i),
      y: yScale(p.v),
      v: p.v,
      t: p.t,
      i,
    })),
  );

  const colorOf = useCallback(
    (key: string) => series.find((s) => s.key === key)?.color ?? 'var(--text-muted)',
    [series],
  );
  const labelOf = useCallback(
    (key: string) => series.find((s) => s.key === key)?.label ?? key,
    [series],
  );

  const handleMove = useCallback(
    (ev: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = ev.clientX - rect.left;
      let best: typeof points[number] | null = null;
      let bestDist = Infinity;
      for (const p of points) {
        const d = Math.abs(p.x - mx);
        if (d <= HOVER_THRESHOLD && d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      setHoverIndex(best?.i ?? null);
      setHoverKey(best?.key ?? null);
    },
    [points],
  );

  const hoverPoint = points.find((p) => p.i === hoverIndex && p.key === hoverKey) ?? null;

  return (
    <div className="chart-wrap" style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={
          ariaLabel ?? 'Tickets creados vs resueltos en las últimas 24 horas'
        }
        onMouseMove={handleMove}
        onMouseLeave={() => {
          setHoverIndex(null);
          setHoverKey(null);
        }}
        style={{ display: 'block', background: 'var(--surface)' }}
      >
        <title id="area-title">{ariaLabel ?? 'Gráfico de área de tickets'}</title>
        <desc id="area-desc">
          Eje X: hora del día. Eje Y: cantidad de tickets. Área violeta: tickets
          creados. Línea verde: tickets resueltos.
        </desc>
        <defs>
          <linearGradient id="grad-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--neon-primary)" stop-opacity="0.25" />
            <stop offset="100%" stop-color="var(--neon-primary)" stop-opacity="0.02" />
          </linearGradient>
        </defs>

        {/* Líneas de grid del eje Y */}
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <line
              key={tick}
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={y}
              y2={y}
              stroke="var(--border)"
              stroke-opacity="0.3"
            />
          );
        })}

        {/* Etiquetas del eje Y */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={MARGIN.left - 8}
            y={yScale(tick) + 4}
            text-anchor="end"
            className="axis-label"
          >
            {tick}
          </text>
        ))}

        {/* Áreas (relleno + trazo) */}
        {series.map((s) => {
          const pts = s.data.map((p, i) => ({ x: xScale(i), y: yScale(p.v) }));
          return (
            <path
              key={s.key}
              d={areaPath(pts, bottomY)}
              fill="url(#grad-area)"
              stroke={s.color}
              stroke-width="2"
              fill-opacity="0.2"
            >
              <title>{`${labelOf(s.key)}: ${s.data.length} puntos`}</title>
            </path>
          );
        })}

        {/* Línea de la segunda serie (resueltos) sobre el área */}
        {series.length > 1 && (
          <path
            d={linePath(series[1].data.map((p, i) => ({ x: xScale(i), y: yScale(p.v) })))}
            fill="none"
            stroke={series[1].color}
            stroke-width="2"
          />
        )}

        {/* Punto bajo el cursor */}
        {hoverPoint && (
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r="4"
            fill={colorOf(hoverPoint.key)}
            stroke="var(--bg)"
            stroke-width="1.5"
          />
        )}

        {/* Ejes */}
        <path
          d={`M${MARGIN.left} ${MARGIN.top} L${MARGIN.left} ${bottomY} L${MARGIN.left + plotWidth} ${bottomY}`}
          fill="none"
          stroke="var(--border)"
          stroke-width="1"
        />

        {/* Etiquetas del eje X (espaciadas para no apretujarse) */}
        {series[0]?.data.map((p, i) => {
          if (i % stepX !== 0) return null;
          return (
            <text
              key={`x-${i}`}
              x={xScale(i)}
              y={bottomY + 16}
              text-anchor="middle"
              className="axis-label"
            >
              {p.t}
            </text>
          );
        })}
      </svg>

      {/* Tooltip HTML (posicionado con left/top en px) */}
      {hoverPoint && (
        <div
          className="tooltip show"
          style={{
            left: hoverPoint.x - 55,
            top: hoverPoint.y - 34,
          } as CSSProperties}
        >
          <strong>{labelOf(hoverPoint.key)}</strong>
          {hoverPoint.t} — {hoverPoint.v} ticket{hoverPoint.v !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
