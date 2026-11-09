/**
 * Dev Ticket Panel — Re-escrito desde 0 con diseño oscuro neon/pastel.
 * Todo es defensivo: nunca se asume que un campo exista en el ticket.
 * Todos los colores son tokens CSS de src/index.css.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type Ticket = {
  id: string;
  created_by: string;
  created_by_name?: string | null;
  assigned_to: string | null;
  assigned_to_name?: string | null;
  title: string;
  description: string;
  category: string;
  priority: 'baja' | 'media' | 'alta' | 'urgente' | null | undefined;
  status: 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado' | null | undefined;
  type: 'bug' | 'mejora' | 'feature' | 'tarea' | null | undefined;
  source: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

type Comment = {
  id: string;
  ticket_id: string;
  author_id: string;
  author_name?: string | null;
  body: string;
  created_at: string;
};

type Project = {
  id: string;
  name: string;
  baseUrl: string;
};

const PRIORITY_COLOR: Record<string, string> = {
  baja: 'var(--prio-baja)',
  media: 'var(--prio-media)',
  alta: 'var(--prio-alta)',
  urgente: 'var(--prio-urgente)',
};

const PRIORITY_LABEL: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const STATUS_COLOR: Record<string, string> = {
  abierto: 'var(--estado-abierto)',
  en_progreso: 'var(--estado-en_progreso)',
  resuelto: 'var(--estado-resuelto)',
  cerrado: 'var(--estado-cerrado)',
};

const STATUS_LABEL: Record<string, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

const TYPE_COLOR: Record<string, string> = {
  bug: 'var(--type-bug)',
  mejora: 'var(--type-mejora)',
  feature: 'var(--type-feature)',
  tarea: 'var(--type-tarea)',
};

const TYPE_LABEL: Record<string, string> = {
  bug: 'Bug',
  mejora: 'Mejora',
  feature: 'Feature',
  tarea: 'Tarea',
};

const PROJECT_KEY = 'panel_project';

function safeGet<T extends string | number | symbol, V>(
  map: Record<T, V>,
  key: T | null | undefined,
): V | undefined {
  if (key === null || key === undefined) return undefined;
  return map[key];
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
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

function formatClock(d: Date): string {
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** Conserva los comentarios optimistas que todavía no confirmó el servidor. */
function mergeComments(server: Comment[], previous: Comment[]): Comment[] {
  const pending = previous.filter((c) => c.id.startsWith('temp-'));
  const stillPending = pending.filter(
    (p) => !server.some((s) => s.author_id === p.author_id && s.body === p.body),
  );
  return [...server, ...stillPending];
}

function focusable(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null);
}

export default function App() {
  const [auth, setAuth] = useState<'checking' | 'authed' | 'anon' | 'error'>('checking');
  const [bootError, setBootError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState('');
  const [projectId, setProjectId] = useState(() => localStorage.getItem(PROJECT_KEY) || '');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [view, setView] = useState<'list' | 'dashboard' | 'kanban'>('list');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmPending, setConfirmPending] = useState<Ticket | null>(null);
  const [modalError, setModalError] = useState('');
  const [newStatus, setNewStatus] = useState<Ticket['status']>('abierto');
  const commentsSeq = useRef(0);
  const commentsVersion = useRef(0);
  const selectedIdRef = useRef<string | null>(null);
  const typingRef = useRef(false);
  const busyRef = useRef(false);
  const mutationRef = useRef(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  typingRef.current = commentText.trim().length > 0;

  const activeProject = projects.find((p) => p.id === projectId) || null;

  const resetSession = useCallback(() => {
    localStorage.removeItem(PROJECT_KEY);
    selectedIdRef.current = null;
    commentsSeq.current += 1;
    setAuth('anon');
    setProjects([]);
    setProjectId('');
    setTickets([]);
    setSelected(null);
    setComments([]);
    setCommentText('');
    setSending(false);
    setLastUpdate(null);
    setListError('');
    setProjectsError('');
  }, []);

  const api = useCallback(async (path: string, opts: RequestInit = {}) => {
    if (!projectId) throw new Error('No hay proyecto seleccionado');
    const url = `/api/proxy?project=${encodeURIComponent(projectId)}&path=${encodeURIComponent(path)}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
      },
    });
    if (res.status === 401) {
      resetSession();
      throw new Error('Sesión expirada');
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        // sin body JSON
      }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }, [projectId, resetSession]);

  const applyProjects = useCallback((list: Project[]) => {
    setProjects(list);
    setProjectId((prev) => {
      const saved = localStorage.getItem(PROJECT_KEY) || '';
      const candidate = list.find((p) => p.id === prev) || list.find((p) => p.id === saved) || list[0];
      return candidate ? candidate.id : '';
    });
  }, []);

  /** Arranque: ¿sigue viva la cookie de sesión? */
  const boot = useCallback(async () => {
    setBootError('');
    setAuth('checking');
    try {
      const res = await fetch('/api/projects');
      if (res.status === 401) {
        setAuth('anon');
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      applyProjects(Array.isArray(data.projects) ? data.projects : []);
      setAuth('authed');
    } catch (err) {
      setBootError(err instanceof Error ? err.message : 'No se pudo conectar con el servidor');
      setAuth('error');
    }
  }, [applyProjects]);

  /** Refresco de la lista de proyectos con la sesión ya abierta. */
  const loadProjects = useCallback(async () => {
    setProjectsError('');
    try {
      const res = await fetch('/api/projects');
      if (res.status === 401) {
        resetSession();
        return;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      applyProjects(Array.isArray(data.projects) ? data.projects : []);
      setAuth('authed');
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : 'No se pudieron cargar los proyectos');
    }
  }, [applyProjects, resetSession]);

  const loadTickets = useCallback(async (silent = false) => {
    if (!projectId) return;
    const gen = mutationRef.current;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api('/tickets');
      const list: Ticket[] = Array.isArray(data) ? data : [];
      setTickets(list);
      setLastUpdate(new Date());
      setListError('');
      if (mutationRef.current === gen) {
        setSelected((prev) => (prev ? list.find((t) => t.id === prev.id) ?? null : null));
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'No se pudieron cargar los tickets');
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [api, projectId]);

  /** Al abrir: preguntar al servidor si la cookie de sesión sigue viva. */
  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (auth !== 'authed' || !projectId) return;
    localStorage.setItem(PROJECT_KEY, projectId);
    selectedIdRef.current = null;
    commentsSeq.current += 1;
    setSelected(null);
    setComments([]);
    setCommentText('');
    setModalError('');
    loadTickets();
  }, [auth, projectId, loadTickets]);

  /** Refresco automático: 5 s con un ticket abierto, 15 s en la lista. */
  useEffect(() => {
    if (auth !== 'authed' || !projectId) return;
    const delay = selected ? 5000 : 15000;
    const id = window.setInterval(async () => {
      if (document.hidden) return;
      if (typingRef.current) return; // no pisar lo que se está escribiendo
      if (busyRef.current) return; // hay una mutación en vuelo
      await loadTickets(true);
      if (selected && !sending) {
        const ticketId = selected.id;
        const seq = ++commentsSeq.current;
        const version = commentsVersion.current;
        try {
          const c = await api(`/tickets/${ticketId}/comments`);
          if (seq !== commentsSeq.current) return;
          if (version !== commentsVersion.current) return;
          if (selectedIdRef.current !== ticketId) return;
          setComments((prev) => mergeComments(Array.isArray(c) ? c : [], prev));
        } catch {
          // se reintenta en el próximo ciclo
        }
      }
    }, delay);
    return () => window.clearInterval(id);
  }, [auth, projectId, selected?.id, sending, api, loadTickets]);

  /** Modal como dialog: Escape cierra, el foco queda atrapado y vuelve al abrir. */
  useEffect(() => {
    if (!selected) return;
    const opener = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTicket();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const items = focusable(modalRef.current);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !modalRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [selected?.id]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loggingIn) return;
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Login fallido');
      setPassword('');
      await loadProjects();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // igual se limpia el estado local
    }
    resetSession();
  };

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const openTicket = async (t: Ticket) => {
    selectedIdRef.current = t.id;
    setSelected(t);
    setNewStatus(t.status || 'abierto');
    setComments([]);
    setCommentText('');
    setModalError('');
    const seq = ++commentsSeq.current;
    try {
      const c = await api(`/tickets/${t.id}/comments`);
      if (seq !== commentsSeq.current) return;
      if (selectedIdRef.current !== t.id) return;
      setComments(Array.isArray(c) ? c : []);
    } catch (err) {
      if (seq === commentsSeq.current) {
        setComments([]);
        setModalError(err instanceof Error ? err.message : 'No se pudieron cargar los comentarios');
      }
    }
  };

  const closeTicket = () => {
    selectedIdRef.current = null;
    commentsSeq.current += 1;
    setSelected(null);
    setComments([]);
    setCommentText('');
    setModalError('');
  };

  const changeTicketStatus = async (ticketId: string, newStatus: Ticket['status']) => {
    if (updating) return;
    busyRef.current = true;
    mutationRef.current += 1;
    setUpdating(true);
    setModalError('');
    try {
      const updated = await api(`/tickets/${ticketId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (selectedIdRef.current === ticketId) setSelected(updated);
    } catch (err) {
      if (selectedIdRef.current === ticketId) {
        setModalError(err instanceof Error ? err.message : 'No se pudo cambiar el estado');
      }
    } finally {
      busyRef.current = false;
      setUpdating(false);
    }
  };

  const updateStatus = async () => {
    if (!selected || updating || newStatus === selected.status) return;
    await changeTicketStatus(selected.id, newStatus);
  };

  const sendComment = async () => {
    const text = commentText.trim();
    if (!selected || !text || sending) return;
    const ticketId = selected.id;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      ticket_id: ticketId,
      author_id: 'panel',
      author_name: 'Soporte',
      body: text,
      created_at: new Date().toISOString(),
    };

    commentsVersion.current += 1;
    busyRef.current = true;
    setSending(true);
    setCommentText('');
    setModalError('');
    setComments((prev) => [...prev, optimistic]);

    try {
      const c = await api(`/tickets/${ticketId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: text }),
      });
      if (selectedIdRef.current !== ticketId) return;
      setComments((prev) => {
        if (prev.some((x) => x.id === tempId)) {
          return prev.map((x) => (x.id === tempId ? c : x));
        }
        if (prev.some((x) => x.id === c.id)) return prev;
        return [...prev, c];
      });
    } catch (err) {
      if (selectedIdRef.current === ticketId) {
        setComments((prev) => prev.filter((x) => x.id !== tempId));
        setCommentText(text);
        setModalError(err instanceof Error ? err.message : 'No se pudo enviar el comentario');
      }
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmPending || deleting) return;
    const id = confirmPending.id;
    setConfirmPending(null);
    busyRef.current = true;
    mutationRef.current += 1;
    setDeleting(true);
    setModalError('');
    try {
      await api(`/tickets/${id}`, { method: 'DELETE' });
      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'No se pudo eliminar el ticket');
    } finally {
      busyRef.current = false;
      setDeleting(false);
    }
  };

  if (auth === 'checking') {
    return (
      <div className="login-wrap">
        <span className="spinner" aria-label="Cargando" role="status" />
      </div>
    );
  }

  if (auth === 'error') {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1 className="login-title">Sin conexión</h1>
          <p className="login-sub">No se pudo hablar con el servidor del panel.</p>
          <div className="alert" role="alert">
            {bootError}
          </div>
          <button className="btn" onClick={boot}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (auth === 'anon') {
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <h1 className="login-title">Dev Ticket Panel</h1>
          <p className="login-sub">Acceso del desarrollador — varios proyectos</p>
          {loginError && (
            <div className="alert" role="alert">
              {loginError}
            </div>
          )}
          <div>
            <label className="label" htmlFor="user">
              Usuario
            </label>
            <input
              id="user"
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label" htmlFor="pass">
              Contraseña
            </label>
            <input
              id="pass"
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className="btn" type="submit" disabled={loggingIn}>
            {loggingIn ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="sidebar-title">Dev Tickets</h1>
        <p className="sidebar-sub">Panel de soporte multi-proyecto</p>

        {projectsError ? (
          <div className="alert" role="alert" style={{ marginTop: 'var(--space-4)' }}>
            {projectsError}
          </div>
        ) : projects.length > 0 ? (
          <div style={{ marginTop: 'var(--space-4)' }}>
            <label className="label" htmlFor="project">
              Proyecto
            </label>
            <select
              id="project"
              className="select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {activeProject && <p className="project-url">{activeProject.baseUrl}</p>}
          </div>
        ) : (
          <p className="sidebar-sub" style={{ marginTop: 'var(--space-4)' }}>
            No hay proyectos configurados.
          </p>
        )}

        <div className="filters">
          <select
            className="select"
            aria-label="Filtrar por estado"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="abierto">Abierto</option>
            <option value="en_progreso">En progreso</option>
            <option value="resuelto">Resuelto</option>
            <option value="cerrado">Cerrado</option>
          </select>
          <select
            className="select"
            aria-label="Filtrar por prioridad"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="all">Todas las prioridades</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
        </div>

        <div className="sidebar-actions">
          <button className="btn btn-secondary" onClick={() => loadTickets(true)} disabled={refreshing}>
            {refreshing ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Actualizando…
              </>
            ) : (
              'Actualizar'
            )}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              const next = view === 'list' ? 'dashboard' : view === 'dashboard' ? 'kanban' : 'list';
              setView(next);
            }}
            title={view === 'list' ? 'Ver dashboard' : view === 'dashboard' ? 'Ver kanban' : 'Ver lista'}
          >
            {view === 'list' ? 'Dashboard' : view === 'dashboard' ? 'Kanban' : 'Lista'}
          </button>
          <div className="sidebar-status">
            <span>
              {filtered.length} {filtered.length === 1 ? 'ticket' : 'tickets'}
              {statusFilter !== 'all' || priorityFilter !== 'all' ? ' (filtrados)' : ''}
            </span>
            {lastUpdate && <span>Actualizado {formatClock(lastUpdate)}</span>}
            <span>Auto-refresco {selected ? '5' : '15'}s</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="btn btn-ghost" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        {view === 'dashboard' ? (
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
                      onClick={() => setProjectId(pr.id)}
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
                    onChange={(e) => setProjectId(e.target.value)}
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
                    onChange={(e) => setStatusFilter(e.target.value)}
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
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">Todas las prioridades</option>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <span className="query-hint">
                  URL: ?project={projectId}&status={statusFilter}&priority={priorityFilter}
                </span>
              </div>

              <div className="kpis">
                <div className="kpi-card">
                  <div className="kpi-title">Total de tickets</div>
                  <div className="kpi-value" style={{ color: 'var(--text)' }}>
                    {filtered.length}
                  </div>
                  <div className="kpi-sub">en el período</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">Abiertos</div>
                  <div className="kpi-value" style={{ color: 'var(--neon-primary)' }}>
                    {filtered.filter((t) => t.status === 'abierto').length}
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">En progreso</div>
                  <div className="kpi-value" style={{ color: 'var(--prio-media)' }}>
                    {filtered.filter((t) => t.status === 'en_progreso').length}
                  </div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-title">Resueltos</div>
                  <div className="kpi-value" style={{ color: 'var(--neon-success)' }}>
                    {filtered.filter((t) => t.status === 'resuelto').length}
                  </div>
                </div>
              </div>

              <div className="charts">
                <section className="card">
                  <h3 className="chart-title">Tickets creados vs resueltos</h3>
                  <div className="chart-wrap">
                    <div className="empty">
                      <h3>Gráfico de área</h3>
                      <p>Gráfico de área disponible en vista dedicada.</p>
                    </div>
                  </div>
                </section>
                <section className="card">
                  <h3 className="chart-title">Tickets por prioridad</h3>
                  <div className="empty">
                    <h3>Gráfico de barras</h3>
                    <p>Gráfico de barras disponible en vista dedicada.</p>
                  </div>
                </section>
              </div>

              <section className="card">
                <h3 className="chart-title">Últimos tickets</h3>
                <div className="list">
                  {filtered.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className="ticket-card"
                      role="button"
                      tabIndex={0}
                      aria-current={selected?.id === t.id}
                      onClick={() => openTicket(t)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openTicket(t);
                        }
                      }}
                      style={{
                        borderLeft: `4px solid ${
                          safeGet(PRIORITY_COLOR, t.priority) || 'var(--border)'
                        }`,
                      }}
                    >
                      <div className="ticket-head">
                        <span className="ticket-title">{t.title || 'Sin título'}</span>
                        <span
                          className="ticket-status"
                          style={{ color: safeGet(STATUS_COLOR, t.status) || 'var(--text-muted)' }}
                        >
                          {(safeGet(STATUS_LABEL, t.status) ?? t.status) || 'Sin estado'}
                        </span>
                        <span
                          className="badge"
                          style={{ color: safeGet(TYPE_COLOR, t.type) || 'var(--text-muted)' }}
                        >
                          {(safeGet(TYPE_LABEL, t.type) ?? t.type) || 'Sin tipo'}
                        </span>
                      </div>
                      <div className="ticket-meta">
                        {t.created_by_name || 'operador'} · {formatDate(t.created_at)} · {
                          t.category || 'Sin categoría'
                        }
                      </div>
                      <div className="ticket-desc">
                        {(t.description || '').slice(0, 120)}
                        {(t.description || '').length > 120 ? '…' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </main>
          </div>
        ) : view === 'kanban' ? (
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
                      onClick={() => setProjectId(pr.id)}
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
                    onChange={(e) => setProjectId(e.target.value)}
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
                    onChange={(e) => setStatusFilter(e.target.value)}
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
                    onChange={(e) => setPriorityFilter(e.target.value)}
                  >
                    <option value="all">Todas las prioridades</option>
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
                <span className="query-hint">
                  URL: ?project={projectId}&status={statusFilter}&priority={priorityFilter}
                </span>
              </div>

              <div className="kanban">
                <div className="kanban-header">
                  <h2 className="kanban-title">Tablero de tickets</h2>
                  <span className="kanban-count">
                    {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="kanban-columns">
                  {['abierto', 'en_progreso', 'resuelto', 'cerrado'].map((statusId) => {
                    const columnTickets = filtered.filter((t) => t.status === statusId);
                    return (
                      <div
                        key={statusId}
                        className="kanban-column"
                      >
                        <div className="kanban-column-header">
                          <h3 className="kanban-column-title" style={{ color: STATUS_COLOR[statusId] || 'var(--text-muted)' }}>
                            {STATUS_LABEL[statusId] || statusId}
                          </h3>
                          <span className="kanban-column-count">{columnTickets.length}</span>
                        </div>

                        <div className="kanban-column-cards">
                          {columnTickets.length === 0 ? (
                            <div className="kanban-empty">
                              <span className="kanban-empty-icon">—</span>
                              <span className="kanban-empty-text">Sin tickets</span>
                            </div>
                          ) : (
                            columnTickets.map((ticket) => (
                              <article
                                key={ticket.id}
                                className="kanban-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => openTicket(ticket)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openTicket(ticket);
                                  }
                                }}
                                style={{
                                  borderLeft: `4px solid ${
                                    safeGet(PRIORITY_COLOR, ticket.priority) || 'var(--border)'
                                  }`,
                                }}
                              >
                                <div className="kanban-card-header">
                                  <span
                                    className="kanban-card-type"
                                    style={{ color: safeGet(TYPE_COLOR, ticket.type) || 'var(--text-muted)' }}
                                  >
                                    {(safeGet(TYPE_LABEL, ticket.type) ?? ticket.type) || 'Sin tipo'}
                                  </span>
                                  <span
                                    className="kanban-card-priority"
                                    style={{
                                      color:
                                        ticket.priority && PRIORITY_COLOR[ticket.priority]
                                          ? PRIORITY_COLOR[ticket.priority]
                                          : 'var(--text-muted)',
                                    }}
                                  >
                                    {ticket.priority ? PRIORITY_LABEL[ticket.priority] : 'Sin prioridad'}
                                  </span>
                                </div>
                                <h4 className="kanban-card-title">{ticket.title || 'Sin título'}</h4>
                                <div className="kanban-card-meta">
                                  <span className="kanban-card-category">{ticket.category || 'Sin categoría'}</span>
                                  <span className="kanban-card-author">{ticket.created_by_name || 'operador'}</span>
                                  <span className="kanban-card-date">{formatDate(ticket.created_at)}</span>
                                </div>
                                <div className="kanban-card-actions">
                                  <button
                                    className="kanban-move-btn kanban-move-prev"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      changeTicketStatus(ticket.id, 'abierto');
                                    }}
                                    disabled={ticket.status === 'abierto'}
                                    aria-label="Mover a columna anterior"
                                    title="Mover a columna anterior"
                                  >
                                    <span style={{ fontSize: '14px', lineHeight: 1 }}>&larr;</span>
                                  </button>
                                  <button
                                    className="kanban-move-btn kanban-move-next"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      changeTicketStatus(ticket.id, 'cerrado');
                                    }}
                                    disabled={ticket.status === 'cerrado'}
                                    aria-label="Mover a columna siguiente"
                                    title="Mover a columna siguiente"
                                  >
                                    <span style={{ fontSize: '14px', lineHeight: 1 }}>&rarr;</span>
                                  </button>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </main>
          </div>
        ) : (
          <>
            {listError && (
              <div className="alert" role="alert" style={{ marginBottom: 'var(--space-4)' }}>
                {listError}
                <button
                  className="btn btn-secondary"
                  style={{ marginLeft: 'var(--space-3)' }}
                  onClick={() => loadTickets(true)}
                >
                  Reintentar
                </button>
              </div>
            )}

            {!projectId ? (
              <p className="empty">Elegí un proyecto para ver sus tickets.</p>
            ) : loading ? (
              <p className="empty" role="status">
                Cargando tickets…
              </p>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <strong>Sin tickets en este filtro</strong>
                {statusFilter !== 'all' || priorityFilter !== 'all' ? (
                  <>
                    <span>Probá con otro filtro.</span>
                    <br />
                    <button
                      className="btn btn-ghost"
                      style={{ marginTop: 'var(--space-3)' }}
                      onClick={() => {
                        setStatusFilter('all');
                        setPriorityFilter('all');
                      }}
                    >
                      Limpiar filtros
                    </button>
                  </>
                ) : (
                  <span>No hay tickets en este proyecto.</span>
                )}
              </div>
            ) : (
              <div className="list">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="ticket-card"
                    role="button"
                    tabIndex={0}
                    aria-current={selected?.id === t.id}
                    onClick={() => openTicket(t)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openTicket(t);
                      }
                    }}
                    style={{
                      borderLeft: `4px solid ${
                        safeGet(PRIORITY_COLOR, t.priority) || 'var(--border)'
                      }`,
                    }}
                  >
                    <div className="ticket-head">
                      <span className="ticket-title">{t.title || 'Sin título'}</span>
                      <span
                        className="ticket-status"
                        style={{ color: safeGet(STATUS_COLOR, t.status) || 'var(--text-muted)' }}
                      >
                        {(safeGet(STATUS_LABEL, t.status) ?? t.status) || 'Sin estado'}
                      </span>
                      <span
                        className="badge"
                        style={{ color: safeGet(TYPE_COLOR, t.type) || 'var(--text-muted)' }}
                      >
                        {(safeGet(TYPE_LABEL, t.type) ?? t.type) || 'Sin tipo'}
                      </span>
                    </div>
                    <div className="ticket-meta">
                      {t.created_by_name || 'operador'} · {formatDate(t.created_at)} · {
                        t.category || 'Sin categoría'
                      }
                    </div>
                    <div className="ticket-desc">
                      {(t.description || '').slice(0, 120)}
                      {(t.description || '').length > 120 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selected && (
        <div className="modal-overlay" onClick={closeTicket}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-title"
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2 className="modal-title" id="ticket-title">
                {selected.title || 'Sin título'}
              </h2>
              <button
                className="icon-btn"
                ref={closeBtnRef}
                onClick={closeTicket}
                aria-label="Cerrar ticket"
              >
                ✕
              </button>
            </div>

            <div className="badges">
              <span
                className="badge"
                style={{ color: safeGet(PRIORITY_COLOR, selected.priority) || 'var(--text-muted)' }}
              >
                Prioridad: {selected.priority || 'Sin prioridad'}
              </span>
              <span
                className="badge"
                style={{ color: safeGet(STATUS_COLOR, selected.status) || 'var(--text-muted)' }}
              >
                Estado: {(safeGet(STATUS_LABEL, selected.status) ?? selected.status) || 'Sin estado'}
              </span>
              <span
                className="badge"
                style={{ color: safeGet(TYPE_COLOR, selected.type) || 'var(--text-muted)' }}
              >
                Tipo: {(safeGet(TYPE_LABEL, selected.type) ?? selected.type) || 'Sin tipo'}
              </span>
              <span className="badge">Categoría: {selected.category || 'Sin categoría'}</span>
              <span className="badge">Por: {selected.created_by_name || 'operador'}</span>
            </div>

            <p className="modal-desc">{selected.description || '(sin descripción)'}</p>

            {modalError && (
              <div className="alert" role="alert" style={{ marginTop: 'var(--space-3)' }}>
                {modalError}
              </div>
            )}

            <div className="modal-actions">
              <select
                className="select"
                aria-label="Nuevo estado del ticket"
                value={newStatus || 'abierto'}
                disabled={updating}
                onChange={(e) => setNewStatus(e.target.value as Ticket['status'])}
              >
                <option value="abierto">Abierto</option>
                <option value="en_progreso">En progreso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
              <button
                className="btn"
                onClick={updateStatus}
                disabled={updating || deleting || newStatus === selected.status}
              >
                {updating ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Guardando…
                  </>
                ) : newStatus === selected.status ? (
                  'Sin cambios'
                ) : (
                  'Cambiar estado'
                )}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => { if (selected) { setConfirmPending(selected); closeTicket(); } }}
                disabled={deleting || updating}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>

            <h3 className="comments-title">Comentarios</h3>
            <div className="comments">
              {comments.length === 0 && <p className="empty">Sin comentarios todavía.</p>}
              {comments.map((c) => (
                <div key={c.id} className="comment">
                  <div className="comment-meta">
                    {c.author_name || 'usuario'} · {formatDate(c.created_at)}
                  </div>
                  <div className="comment-body">{c.body}</div>
                </div>
              ))}
            </div>

            <div className="composer">
              <div style={{ flex: 1 }}>
                <label className="sr-only" htmlFor="comment">
                  Escribir comentario
                </label>
                <textarea
                  id="comment"
                  className="input"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      sendComment();
                    }
                  }}
                  placeholder="Escribir comentario…"
                  rows={3}
                />
                <div className="composer-hint">Ctrl+Enter envía · Shift+Enter hace un salto de línea</div>
              </div>
              <button
                className="btn"
                onClick={sendComment}
                disabled={sending || !commentText.trim()}
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPending && (
        <div className="modal-overlay" onClick={() => setConfirmPending(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar eliminación de ticket"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2 className="modal-title">Eliminar ticket</h2>
              <button
                className="icon-btn"
                onClick={() => setConfirmPending(null)}
                aria-label="Cancelar"
              >
                ✕
              </button>
            </div>
            <p>
              ¿Estás seguro de que querés eliminar el ticket{' '}
              <strong>{confirmPending.title || 'sin título'}</strong>?
            </p>
            {modalError && (
              <div className="alert" role="alert" style={{ marginTop: 'var(--space-3)' }}>
                {modalError}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmPending(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
