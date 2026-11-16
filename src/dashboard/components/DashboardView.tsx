/**
 * Dashboard de tickets — vista integrada con la API real del panel.
 *
 * Es de solo contenido: App.tsx ya provee el shell (sidebar con proyecto,
 * filtros, pestañas y refresco), así que acá no hay sidebar ni filtros
 * duplicados. Recibe tickets crudos y aplica sus propios filtros de estado
 * / prioridad para el cálculo de métricas y la lista de recientes.
 *
 * Stack: solo React + TypeScript + CSS nativo. Sin librerías de gráficos
 * ni de animación. Todo el color vive en los tokens de src/index.css.
 *
 * Toda la lectura de propiedades de tickets es defensiva.
 */
import { useMemo } from 'react';
import { AreaChart } from './AreaChart';
import { BarChart } from './BarChart';
import { KPICard } from './KPICard';
import type { AreaSeries, BarItem, ChartPoint, KPI } from '../types';
import type { Ticket } from '../../App';

type Priority = 'baja' | 'media' | 'alta' | 'urgente';

const PRIORITY_ORDER: Priority[] = ['urgente', 'alta', 'media', 'baja'];

const PRIORITY_LABEL: Record<Priority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

type Props = {
  tickets: Ticket[];
  projectName?: string | null;
  statusFilter: string;
  priorityFilter: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export default function DashboardView({
  tickets,
  projectName,
  statusFilter,
  priorityFilter,
  loading,
  error,
  onRefresh,
}: Props) {
  const allTickets = useMemo(
    () => tickets.filter((t) => Boolean(t.id)),
    [tickets]
  );

  // El dashboard aplica sus propios filtros de estado/prioridad (distintos
  // de la lista, que también busca por texto).
  const filtered = useMemo(() => {
    return allTickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [allTickets, statusFilter, priorityFilter]);

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);

  const openCount = filtered.filter((t) => t.status === 'abierto').length;
  const inProgressCount = filtered.filter((t) => t.status === 'en_progreso').length;
  const resolvedCount = filtered.filter((t) => t.status === 'resuelto').length;
  const closedCount = filtered.filter((t) => t.status === 'cerrado').length;

  const byPriority = PRIORITY_ORDER.reduce(
    (acc, p) => { acc[p] = filtered.filter((t) => t.priority === p).length; return acc; },
    {} as Record<Priority, number>
  );

  const kpis: KPI[] = [
    { title: 'Abiertos', value: openCount, tone: 'danger' },
    { title: 'En progreso', value: inProgressCount, tone: 'accent' },
    { title: 'Resueltos', value: resolvedCount, tone: 'success' },
    { title: 'Cerrados', value: closedCount, tone: 'muted' },
    { title: 'Urgentes', value: byPriority.urgente, tone: 'danger' },
    { title: 'Total', value: filtered.length, tone: 'dim' },
  ];

  const labels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sevenDaysAgo);
    d.setDate(sevenDaysAgo.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const createdByDay = labels.reduce(
    (acc, label) => { acc[label] = 0; return acc; },
    {} as Record<string, number>
  );
  const resolvedByDay = labels.reduce(
    (acc, label) => { acc[label] = 0; return acc; },
    {} as Record<string, number>
  );

  filtered.forEach((t) => {
    const createdDay = t.created_at.slice(0, 10);
    if (labels.includes(createdDay) && t.status !== 'cerrado') createdByDay[createdDay] += 1;
    if (t.resolved_at && labels.includes(t.resolved_at.slice(0, 10))) resolvedByDay[t.resolved_at.slice(0, 10)] += 1;
  });

  const series: AreaSeries[] = [
    {
      key: 'abiertos',
      label: 'Abiertos / día',
      color: 'var(--neon-primary)',
      data: labels.map((t) => ({ t, v: createdByDay[t] })) as ChartPoint[],
    },
    {
      key: 'resueltos',
      label: 'Resueltos / día',
      color: 'var(--neon-success)',
      data: labels.map((t) => ({ t, v: resolvedByDay[t] })) as ChartPoint[],
    },
  ];

  const barData: BarItem[] = PRIORITY_ORDER.map((p) => ({
    label: PRIORITY_LABEL[p],
    value: byPriority[p],
    color: `var(--prio-${p})`,
  }));

  const recent = useMemo(
    () =>
      [...filtered]
        .sort(
          (a, b) =>
            String(b.updated_at || b.created_at || '').localeCompare(
              String(a.updated_at || a.created_at || '')
            )
        )
        .slice(0, 10),
    [filtered]
  );

  if (loading) {
    return (
      <div className="dashboard" role="region" aria-label="Dashboard de tickets">
        <div className="view-head">
          <div>
            <h2 className="view-title">Dashboard</h2>
            <p className="view-sub">Cargando métricas…</p>
          </div>
        </div>
        <div className="skeleton skeleton-big"></div>
        <div className="skeleton skeleton-chart"></div>
        <div className="skeleton skeleton-chart"></div>
        <div className="skeleton skeleton-big"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard" role="region" aria-label="Dashboard de tickets">
        <div className="view-head">
          <div>
            <h2 className="view-title">Dashboard</h2>
            <p className="view-sub">{projectName ?? 'Sin proyecto'}</p>
          </div>
        </div>
        <div className="alert" role="alert">{error}</div>
        <button className="btn" type="button" onClick={onRefresh}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard" role="region" aria-label="Dashboard de tickets">
      <div className="view-head">
        <div>
          <h2 className="view-title">Dashboard</h2>
          <p className="view-sub">
            {projectName ?? 'Sin proyecto'} · {filtered.length} de {allTickets.length} tickets
          </p>
        </div>
      </div>

      <div className="kpis">
        {kpis.map((k) => (
          <KPICard key={k.title} {...k} />
        ))}
      </div>

      <div className="charts">
        <div className="card">
          <div className="chart-title">Tickets creados por día (últimos 7 días)</div>
          <div className="chart-wrap">
            <AreaChart
              series={series}
              aria-label="Tickets creados y resueltos por día"
            />
          </div>
        </div>
        <div className="card">
          <div className="chart-title">Tickets por prioridad</div>
          <div className="chart-wrap">
            <BarChart data={barData} aria-label="Tickets por prioridad" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="chart-title">Últimos tickets</div>
        <div className="recent-list">
          {recent.length === 0 ? (
            <div className="empty">
              <p>Sin tickets recientes.</p>
            </div>
          ) : (
            recent.map((t) => (
              <div key={t.id} className="recent-item" data-priority={t.priority ?? 'none'}>
                <div className="recent-main">
                  <div className="recent-title">{t.title || 'Sin título'}</div>
                  <div className="recent-meta">
                    {t.category || 'Sin categoría'} · {t.created_by_name || 'operador'}
                    <span className="recent-date">{formatDate(t.updated_at || t.created_at)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}
