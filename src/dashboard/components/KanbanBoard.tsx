/**
 * KanbanBoard — Tablero de tickets tipo Notion/Trello.
 *
 * Columnas (estados del ticket):
 *   abierto   → Por hacer
 *   en_progreso → En proceso
 *   resuelto   → Hecho
 *   cerrado    → Cerrado
 *
 * Cada tarjeta es un postit:
 *   - Borde izquierdo de 4px con color de prioridad
 *   - Badge de tipo (bug / mejora / feature / tarea) con color neon
 *   - Badge de prioridad con color pastel
 *   - Título, categoría, autor, fecha
 *   - Al hacer clic → se emite onTicketClick para abrir el modal
 *   - Flechas ← → para cambiar de columna (estado)
 *
 * Stack: solo React + TypeScript + CSS nativo. Sin librerías externas.
 */
import { useMemo } from 'react';
import type { Ticket } from '../../App';

type KanbanColumn = {
  id: string;
  label: string;
  color: string;
};

const COLUMNS: KanbanColumn[] = [
  { id: 'abierto', label: 'Por hacer', color: 'var(--estado-abierto)' },
  { id: 'en_progreso', label: 'En proceso', color: 'var(--estado-en_progreso)' },
  { id: 'resuelto', label: 'Hecho', color: 'var(--estado-resuelto)' },
  { id: 'cerrado', label: 'Cerrado', color: 'var(--estado-cerrado)' },
];

const TYPE_LABEL: Record<string, string> = {
  bug: 'Bug',
  mejora: 'Mejora',
  feature: 'Feature',
  tarea: 'Tarea',
};

const TYPE_COLOR: Record<string, string> = {
  bug: 'var(--type-bug)',
  mejora: 'var(--type-mejora)',
  feature: 'var(--type-feature)',
  tarea: 'var(--type-tarea)',
};

const PRIORITY_LABEL: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

const PRIORITY_COLOR: Record<string, string> = {
  baja: 'var(--prio-baja)',
  media: 'var(--prio-media)',
  alta: 'var(--prio-alta)',
  urgente: 'var(--prio-urgente)',
};

interface KanbanBoardProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
  onStatusChange: (ticketId: string, newStatus: Ticket['status']) => void;
}

const ChevronLeft = () => (
  <svg className="kanban-move-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg className="kanban-move-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 5l7 7-7 7" />
  </svg>
);

export function KanbanBoard({ tickets, onTicketClick, onStatusChange }: KanbanBoardProps) {
  const grouped = useMemo(() => {
    return COLUMNS.reduce<Record<string, Ticket[]>>(
      (acc, col) => {
        acc[col.id] = tickets.filter((t) => t.status === col.id);
        return acc;
      },
      { abierto: [], en_progreso: [], resuelto: [], cerrado: [] },
    );
  }, [tickets]);

  const moveTicket = (ticketId: string, direction: 'prev' | 'next') => {
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === null || ticket.status === undefined) return;
    const ticketStatus: Ticket['status'] = ticket.status;
    const currentIdx = COLUMNS.findIndex((c) => c.id === ticketStatus);
    const nextIdx =
      direction === 'prev'
        ? Math.max(0, currentIdx - 1)
        : Math.min(COLUMNS.length - 1, currentIdx + 1);
    const newStatus = COLUMNS[nextIdx].id as Ticket['status'];
    if (newStatus !== ticket.status) {
      onStatusChange(ticketId, newStatus);
    }
  };

  return (
    <section className="kanban" aria-label="Tablero de tickets">
      <div className="kanban-header">
        <h2 className="kanban-title">Tablero de tickets</h2>
        <span className="kanban-count">
          {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="kanban-columns">
        {COLUMNS.map((col) => {
          const columnTickets = grouped[col.id] || [];
          return (
            <div
              key={col.id}
              className="kanban-column"
            >
              <div className="kanban-column-header">
                <h3 className="kanban-column-title" style={{ color: col.color }}>
                  {col.label}
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
                      onClick={() => onTicketClick(ticket)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onTicketClick(ticket);
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
                        <span className="kanban-card-date">{fmtDate(ticket.created_at)}</span>
                      </div>
                      <div className="kanban-card-actions">
                        <button
                          className="kanban-move-btn kanban-move-prev"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTicket(ticket.id, 'prev');
                          }}
                          disabled={ticket.status === 'abierto'}
                          aria-label="Mover a columna anterior"
                          title="Mover a columna anterior"
                        >
                          <ChevronLeft />
                        </button>
                        <button
                          className="kanban-move-btn kanban-move-next"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTicket(ticket.id, 'next');
                          }}
                          disabled={ticket.status === 'cerrado'}
                          aria-label="Mover a columna siguiente"
                          title="Mover a columna siguiente"
                        >
                          <ChevronRight />
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
    </section>
  );
}

function safeGet<T extends string | number | symbol, V>(
  map: Record<T, V>,
  key: T | null | undefined,
): V | undefined {
  if (key === null || key === undefined) return undefined;
  return map[key];
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
  });
}
