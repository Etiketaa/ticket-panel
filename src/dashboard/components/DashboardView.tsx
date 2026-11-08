/**
 * Dashboard de tickets — vista integrada con la API real del panel.
 *
 * Recibe datos como props (sin mocks internos) y renderiza métricas,
 * gráfico de área streaming y barras por prioridad.
 *
 * Stack: solo React + TypeScript + CSS nativo. Sin librerías de gráficos
 * ni de animación. Todo el color vive en los tokens de src/index.css.
 */
import { useMemo } from 'react';
import { AreaChart } from './AreaChart';
import { BarChart } from './BarChart';
import { KPICard } from './KPICard';
import type { AreaSeries, BarItem, ChartPoint, KPI } from '../types';

type Status = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';
type Priority = 'baja' | 'media' | 'alta' | 'urgente';

type Ticket = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  type: 'bug' | 'mejora' | 'feature' | 'tarea';
  category: string;
  created_at: string;
  resolved_at: string | null;
};

type Project = {
  id: string;
  name: string;
};

type DashboardViewProps = {
  tickets: Ticket[];
  projects: Project[];
  projectId: string;
  statusFilter: string;
  priorityFilter: string;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onProjectChange: (id: string) => void;
  onStatusFilterChange: (status: string) => void;
  onPriorityFilterChange: (priority: string) => void;
};

const STATUS_LABEL: Record<Status, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function resolveMinutes(created: string, resolved: string | null): number | null {
  if (!resolved) return null;
  return (new Date(resolved).getTime() - new Date(created).getTime()) / 1000 / 60;
}

/* ------------------------------------------------------------------ */
/* Datos derivados de los tickets reales                              */
/* ------------------------------------------------------------------ */

function buildAreaSeries(tickets: Ticket[]): AreaSeries[] {
  const now = new Date();
  const buckets: Record<string, { creados: number; resueltos: number }> = {};
  for (let h = 23; h >= 0; h--) {
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    const key = d.toISOString();
    buckets[key] = { creados: 0, resueltos: 0 };
  }
  for (const t of tickets) {
    if (!t.created_at) continue;
    const bucketKey = new Date(t.created_at).toISOString();
    if (buckets[bucketKey]) buckets[bucketKey].creados += 1;
    if (t.resolved_at) {
      const resolvedKey = new Date(t.resolved_at).toISOString();
      if (buckets[resolvedKey]) buckets[resolvedKey].resueltos += 1;
    }
  }
  const entries = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  const created: ChartPoint[] = [];
  const resolved: ChartPoint[] = [];
  for (const [key, vals] of entries) {
    const d = new Date(key);
    const t = d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    created.push({ t, v: vals.creados });
    resolved.push({ t, v: vals.resueltos });
  }
  return [
    { key: 'creados', label: 'Tickets creados', color: 'var(--neon-primary)', data: created },
    { key: 'resueltos', label: 'Tickets resueltos', color: 'var(--success)', data: resolved },
  ];
}

function buildBars(tickets: Ticket[]): BarItem[] {
  const counts: Record<Priority, number> = { baja: 0, media: 0, alta: 0, urgente: 0 };
  for (const t of tickets) {
    if (t.priority && counts[t.priority] !== undefined) {
      counts[t.priority] += 1;
    }
  }
  return [
    { label: 'Baja', value: counts.baja, color: 'var(--prio-baja)' },
    { label: 'Media', value: counts.media, color: 'var(--prio-media)' },
    { label: 'Alta', value: counts.alta, color: 'var(--prio-alta)' },
    { label: 'Urgente', value: counts.urgente, color: 'var(--prio-urgente)' },
  ];
}




/* ------------------------------------------------------------------ */
/* Sub-componentos de estado                                          */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="skeleton"><div className="skeleton-text lg" /></div>
        <div className="skeleton"><div className="skeleton-text md" /></div>
      </aside>
      <main className="main">
        <div className="filters">
          <div className="skeleton"><div className="skeleton-text sm" /></div>
          <div className="skeleton"><div className="skeleton-text sm" /></div>
        </div>
        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton">
              <div className="skeleton-big" />
              <div className="skeleton-text sm" />
              <div className="skeleton-text xs" />
            </div>
          ))}
        </div>
        <div className="charts">
          <div className="skeleton skeleton-chart" />
          <div className="skeleton skeleton-chart" />
        </div>
      </main>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="dashboard">
      <main className="main">
        <div className="alert" role="alert">
          <div className="alert-title">No se pudieron cargar los tickets</div>
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="dashboard">
      <main className="main">
        <section className="empty">
          <h3>No hay tickets que mostrar</h3>
          <p>
            Con los filtros actuales no hay resultados. Cambiá los filtros.
          </p>
          <button className="btn" onClick={onAction}>
            Limpiar filtros
          </button>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista principal                                                    */
/* ------------------------------------------------------------------ */

export default function DashboardView(props: DashboardViewProps) {
  const {
    tickets,
    projects,
    projectId,
    statusFilter,
    priorityFilter,
    loading,
    error,
    onRefresh,
    onProjectChange,
    onStatusFilterChange,
    onPriorityFilterChange,
  } = props;

  const activeProject = projects.find((p) => p.id === projectId) || null;

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tickets, statusFilter, priorityFilter]);

  const total = filtered.length;
  const abiertos = filtered.filter((t) => t.status === 'abierto').length;
  const enProgreso = filtered.filter((t) => t.status === 'en_progreso').length;
  const resueltos = filtered.filter((t) => t.status === 'resuelto').length;

  const times = filtered
    .map((t) => resolveMinutes(t.created_at, t.resolved_at))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const promedio = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const kpis: KPI[] = [
    { title: 'Total de tickets', value: total, subtitle: 'en el período', color: 'var(--text)' },
    { title: 'Abiertos', value: abiertos, color: 'var(--neon-primary)' },
    { title: 'En progreso', value: enProgreso, color: 'var(--prio-media)' },
    { title: 'Resueltos', value: resueltos, color: 'var(--success)' },
    { title: 'Cerrados', value: total - abiertos - enProgreso - resueltos, color: 'var(--text-muted)' },
    {
      title: 'Prom. resolución',
      value: promedio === null ? '—' : `${promedio} min`,
      subtitle: 'tiempo medio',
      color: 'var(--text-dim)',
    },
  ];

  const series = useMemo(() => buildAreaSeries(filtered), [filtered]);
  const bars = useMemo(() => buildBars(filtered), [filtered]);

  const params = new URLSearchParams(window.location.search);
  params.set('project', projectId);
  params.set('status', statusFilter);
  params.set('priority', priorityFilter);
  const queryHint = `?${params.toString()}`;

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={onRefresh} />;
  if (total === 0) return <EmptyState onAction={() => onPriorityFilterChange('all')} />;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="sidebar-title">Ticket Panel</h2>
        <p className="sidebar-sub">
          Soporte técnico · {activeProject?.name || projectId}
        </p>

        <nav aria-label="Proyectos" style={{ marginTop: 'var(--space-5)' }}>
          {projects.map((pr) => {
            const active = pr.id === projectId;
            return (
              <button
                key={pr.id}
                className={`project-item ${active ? 'active' : ''}`}
                onClick={() => onProjectChange(pr.id)}
              >
                <span className="project-dot" aria-hidden="true"></span>
                {pr.name}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <div className="filters">
          <div>
            <label className="label">Proyecto</label>
            <select
              className="select"
              value={projectId}
              onChange={(e) => onProjectChange(e.target.value)}
            >
              {projects.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="abierto">Abierto</option>
              <option value="en_progreso">En progreso</option>
              <option value="resuelto">Resuelto</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </div>
          <div>
            <label className="label">Prioridad</label>
            <select
              className="select"
              value={priorityFilter}
              onChange={(e) => onPriorityFilterChange(e.target.value)}
            >
              <option value="all">Todas las prioridades</option>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <span className="query-hint">
            URL: {queryHint}
          </span>
        </div>

        <div className="kpis">
          {kpis.map((kpi, i) => (
            <KPICard key={i} {...kpi} />
          ))}
        </div>

        <div className="charts">
          <section className="card">
            <h3 className="chart-title">
              Tickets creados vs resueltos · últimas 24 h
            </h3>
            <AreaChart
              series={series}
              refreshIntervalMs={30000}
              onRefresh={onRefresh}
              aria-label="Tickets creados y resueltos en las últimas 24 horas"
            />
          </section>

          <section className="card">
            <h3 className="chart-title">Tickets por prioridad</h3>
            <BarChart
              data={bars}
              aria-label="Cantidad de tickets por prioridad"
            />
          </section>
        </div>

        <section className="card">
          <h3 className="chart-title">Últimos tickets</h3>
          <div className="list">
            {filtered.slice(0, 8).map((t) => (
              <div
                key={t.id}
                className="list-item"
                style={{
                  borderLeft: `3px solid ${
                    t.status === 'abierto'
                      ? 'var(--estado-abierto)'
                      : t.status === 'en_progreso'
                        ? 'var(--estado-en_progreso)'
                        : t.status === 'resuelto'
                          ? 'var(--estado-resuelto)'
                          : 'var(--estado-cerrado)'
                  }`,
                }}
              >
                <div className="list-title">{t.title}</div>
                <div className="list-meta">
                  <span
                    className="badge"
                    style={{
                      backgroundColor: `var(--prio-${t.priority})`,
                      color: 'var(--bg)',
                    }}
                  >
                    {t.priority}
                  </span>
                  <span
                    className="badge"
                    style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text)' }}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                  <span>{fmtDate(t.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
