/** Utilidades de escala y paths para gráficos SVG nativos. Ninguna librería externa. */

export type ChartPoint = { t: string; v: number };

export function scaleLinear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (x: number) => r0 + ((x - d0) / span) * (r1 - r0);
}

export function extent(values: number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  return [min, max];
}

/** Dominio con un 10 % de aire para que las áreas no toquen el borde superior. */
export function niceDomain(min: number, max: number): [number, number] {
  if (max === min) return [0, 1];
  const pad = (max - min) * 0.1 || 1;
  return [Math.max(0, min - pad), max + pad];
}

/** Ticks "redondos" para el eje Y. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (max === min) return [min];
  const rawStep = (max - min) / (count - 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  let step = rawStep / pow;
  step = step > 5 ? 10 : step > 2 ? 5 : step > 1 ? 2 : 1;
  step *= pow;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Path de área rellena hasta bottomY (eje X). */
export function areaPath(points: { x: number; y: number }[], bottomY: number): string {
  if (points.length === 0) return '';
  const top = points.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  return `${top} L${last.x} ${bottomY} L${first.x} ${bottomY} Z`;
}

/** Path de línea simple. */
export function linePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`)).join(' ');
}
