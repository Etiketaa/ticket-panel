/**
 * Dashboard de tickets de soporte — ejemplo mínimo y funcional.
 *
 * Stack: solo React + TypeScript + CSS nativo. Sin librerías de gráficos,
 * sin librerías de animación. Todo el color vive en los tokens de
 * src/index.css (fondo #0a0a0a, paleta pastel).
 */
import { useCallback, useEffect, useState } from 'react';
import { AreaChart } from './AreaChart';
import { BarChart } from './BarChart';
import { KPICard } from './KPICard';
import type { AreaSeries, BarItem, ChartPoint, KPI } from '../types';
import '../dashboard.css';

type Status = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado';
type Priority = 'baja' | 'media' | 'alta' | 'urgente';

type Ticket = {
  id: string;
  title: string;
  priority: Priority;
  status: Status;
  category: string;
  created_at: string;
  resolved_at: string | null;
};

const PROJECTS: { id: string; name: string }[] = [
  { id: 'gesope', name: 'Gesope' },
  { id: 'web', name: 'Sitio web' },
  { id: 'app', name: 'App móvil' },
];

const STATUS_LABEL: Record<Status, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

function parseQuery(): { project: string; status: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    project: params.get('project') || 'gesope',
    status: params.get('status') || 'all',
  };
}

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
/* Datos de ejemplo (mocks). En producción esto vendría de la API.    */
/* ------------------------------------------------------------------ */

function mockTickets(_project: string, status: Status | 'all'): Ticket[] {
  const now = Date.now();
  const titles = [
    'Error de login',
    'Pantalla en blanco',
    'Consulta de factura',
    'Solicitud de acceso',
    'Reporte lento',
    'Bug de envío',
    'Duda de configuración',
    'Caída de servicio',
  ];
  const categories = ['Facturación', 'Técnico', 'Acceso', 'General'];
  const priorities: Priority[] = ['baja', 'media', 'alta', 'urgente'];
  const statuses: Status[] = ['abierto', 'en_progreso', 'resuelto', 'cerrado'];

  const tickets: Ticket[] = [];
  for (let i = 0; i < 42; i++) {
    const created = new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString();
    const st = statuses[i % 4];
    tickets.push({
      id: `t-${i}`,
      title: `${titles[i % titles.length]} #${i + 1}`,
      priority: priorities[i % 4],
      status: st,
      category: categories[i % 4],
      created_at: created,
      resolved_at: st === 'resuelto' || st === 'cerrado' ? new Date(now - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString() : null,
    });
  }
  return tickets.filter((t) => status === 'all' || t.status === status);
}

function mockAreaSeries(): AreaSeries[] {
  const now = new Date();
  const created: ChartPoint[] = [];
  const resolved: ChartPoint[] = [];
  for (let h = 23; h >= 0; h--) {
    const d = new Date(now);
    d.setHours(h, 0, 0, 0);
    const t = d.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    created.push({ t, v: Math.floor(Math.random() * 18) + 2 });
    resolved.push({ t, v: Math.floor(Math.random() * 14) + 1 });
  }
  return [
    { key: 'creados', label: 'Tickets creados', color: 'var(--neon-primary)', data: created },
    { key: 'resueltos', label: 'Tickets resueltos', color: 'var(--success)', data: resolved },
  ];
}

function mockBars(): BarItem[] {
  return [
    { label: 'Baja', value: 9, color: 'var(--prio-baja)' },
    { label: 'Media', value: 14, color: 'var(--prio-media)' },
    { label: 'Alta', value: 22, color: 'var(--prio-alta)' },
    { label: 'Urgente', value: 7, color: 'var(--prio-urgente)' },
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
            Con los filtros actuales no hay resultados. Cambiá los filtros o
            creá un ticket nuevo.
          </p>
          <button className="btn" onClick={onAction}>
            Crear ticket
          </button>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página principal                                                   */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const [project, setProject] = useState<string>(() => parseQuery().project);
  const [status, setStatus] = useState<Status | 'all'>(() => {
    const s = parseQuery().status;
    return (s === 'all' ? 'all' : s) as Status | 'all';
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const id = setTimeout(() => {
      try {
        setTickets(mockTickets(project, status));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => clearTimeout(id);
  }, [project, status]);

  useEffect(() => {
    const id = load();
    return () => id();
  }, [load]);

  const retry = useCallback(() => {
    load();
  }, [load]);

  // Los filtros se escriben en la URL sin recargar la página.
  const setFilters = useCallback(
    (p: string, s: Status | 'all') => {
      setProject(p);
      setStatus(s);
      const params = new URLSearchParams(window.location.search);
      params.set('project', p);
      params.set('status', s);
      window.history.replaceState(null, '', `?${params.toString()}`);
    },
    [],
  );

  const filtered = tickets;
  const total = filtered.length;
  const abiertos = filtered.filter((t) => t.status === 'abierto').length;
  const enProgreso = filtered.filter((t) => t.status === 'en_progreso').length;
  const resueltos = filtered.filter((t) => t.status === 'resuelto').length;

  const times = filtered.map((t) => resolveMinutes(t.created_at, t.resolved_at)).filter(
    (v): v is number => v !== null,
  );
  const promedio = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;

  const kpis: KPI[] = [
    { title: 'Total de tickets', value: total, subtitle: 'en el período', color: 'var(--text)' },
    {
      title: 'Abiertos',
      value: abiertos,
      color: 'var(--neon-primary)',
      trend: { label: '+12 vs ayer', up: true },
    },
    { title: 'En progreso', value: enProgreso, color: 'var(--prio-media)' },
    {
      title: 'Resueltos',
      value: resueltos,
      color: 'var(--success)',
      trend: { label: '-3 vs ayer', up: false },
    },
    {
      title: 'Prom. resolución',
      value: promedio === null ? '—' : `${promedio} min`,
      subtitle: 'tiempo medio',
      color: 'var(--text-dim)',
    },
  ];

  const series = mockAreaSeries();
  const bars = mockBars();

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={retry} />;
  if (total === 0) return <EmptyState onAction={retry} />;

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <h2 className="sidebar-title">Ticket Panel</h2>
        <p className="sidebar-sub">Soporte técnico · gesope</p>

        <nav aria-label="Proyectos" style={{ marginTop: 'var(--space-5)' }}>
          {PROJECTS.map((pr) => {
            const active = pr.id === project;
            return (
              <button
                key={pr.id}
                className={`project-item ${active ? 'active' : ''}`}
                onClick={() => setFilters(pr.id, status)}
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
              value={project}
              onChange={(e) => setFilters(e.target.value, status)}
            >
              {PROJECTS.map((pr) => (
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
              value={status}
              onChange={(e) => setFilters(project, e.target.value as Status | 'all')}
            >
              <option value="all">Todos los estados</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <span className="query-hint">
            URL: ?project={project}&status={status}
          </span>
        </div>

        <div className="kpis">
          {kpis.map((kpi, i) => (
            <KPICard key={i} {...kpi} />
          ))}
        </div>

        <div className="charts">
          <section className="card">
            <h3 className="chart-title">Tickets creados vs resueltos · últimas 24 h</h3>
            <AreaChart
              series={series}
              refreshIntervalMs={30000}
              onRefresh={load}
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
                  <span className="badge" style={{ backgroundColor: `var(--prio-${t.priority})`, color: 'var(--bg)' }}>
                    {t.priority}
                  </span>
                  <span className="badge" style={{ backgroundColor: 'var(--surface-hover)', color: 'var(--text)' }}>
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
