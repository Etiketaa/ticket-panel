# Dev Ticket Panel

Panel externo de soporte para leer y responder los tickets de una o varias apps.
Es independiente de la app: tiene su propio login y no usa credenciales de clientes.

- **Producción:** https://ticket-panel-seven.vercel.app
- **Proyecto Vercel:** `ticket-panel`
- **Proyecto local:** `/home/franco/Proyectos/ticket-panel`

## Arquitectura

```text
Navegador
  │  login propio (usuario/contraseña) → cookie httpOnly con token firmado (7 días)
  ▼
Vercel Functions (api/)
  ├── POST /api/login      valida PANEL_USER / PANEL_PASSWORD, firma token con PANEL_SECRET
  ├── POST /api/logout     borra la cookie de sesión
  ├── GET  /api/projects   devuelve los proyectos (sin secretos)
  └── *    /api/proxy      agrega X-Dev-Key y reenvía a <baseUrl>/api/dev/tickets...
  │
  ▼
App cliente (ej. gesope)
  └── /api/dev/tickets...  protegido por DEV_API_KEY, identidad "Soporte"
```

El navegador **nunca** ve las `devKey`: las inyecta el proxy server-side.
El proxy solo permite rutas que empiecen con `/tickets`.

La sesión va en una cookie `HttpOnly; SameSite=Lax`, así que el JavaScript del
navegador no puede leerla (no hay token en `localStorage`).

## Dashboard

Desde la versión actual, el panel incluye una vista de **dashboard** con métricas y
gráficos para leer el movimiento del sistema, accesible desde el botón "Dashboard" en
la barra lateral (al lado de "Actualizar").

### Qué incluye el dashboard

| Sección | Qué muestra |
|---------|-------------|
| **KPI cards** | Total de tickets, abiertos, en progreso, resueltos, cerrados y promedio de resolución (minutos) |
| **Gráfico de área** | Tickets creados vs resueltos en las últimas 24 h, con auto-refresco cada 30 s |
| **Gráfico de barras** | Cantidad de tickets por prioridad (baja/media/alta/urgente) |
| **Últimos tickets** | Los 8 tickets más recientes con estado, prioridad y fecha |

### Filtros y deep linking

Los filtros de **proyecto**, **estado** y **prioridad** se escriben en la URL sin
recargar la página, así que se puede copiar y pegar la dirección para compartir una
vista filtrada:

```
https://ticket-panel-seven.vercel.app/?project=gesope&status=abierto&priority=alta
```

### Accesibilidad

- Contraste WCAG AA (≥4.5:1 texto, ≥3:1 UI no textual) sobre fondo gris carbón `#0a0a0a`
- Touch targets ≥44px en botones, chips y proyectos del sidebar
- Focus visible con outline en color acento (`var(--accent)`)
- `role="alert"` en mensajes de error; los lectores de pantalla los anuncian sin mover el foco
- `prefers-reduced-motion: reduce` desactiva animaciones de skeleton, spinner y transiciones
- Gráficos SVG con `role="img"`, `aria-label`, `<title>` y `<desc>` para lectores de pantalla
- Estados de carga (skeleton), empty state con acción ("Limpiar filtros") y error con botón "Reintentar"

### Stack del dashboard

Solo **React + TypeScript + CSS nativo**. Los gráficos son SVG escritos a mano en
componentes React (`src/dashboard/components/`). No hay Chart.js, Recharts, D3 ni
librerías de animación. Todo el color vive en tokens CSS de `src/index.css`.

## Variables de entorno (Vercel)

| Variable | Descripción |
|----------|-------------|
| `PANEL_USER` | Usuario del panel (ej. `franco`) |
| `PANEL_PASSWORD` | Contraseña del panel |
| `PANEL_SECRET` | Secreto para firmar los tokens de sesión |
| `PROJECTS` | JSON con la lista de apps conectadas |

`PROJECTS` tiene esta forma:

```json
[
  {
    "id": "gesope",
    "name": "gesope",
    "baseUrl": "https://gesope.vercel.app",
    "devKey": "<DEV_API_KEY de esa app>"
  }
]
```

## Agregar una app nueva

1. En la app, definir `DEV_API_KEY` en el entorno y crear el usuario `soporte@...`
   (rol admin, nombre "Soporte"). La app debe exponer `/api/dev/tickets*` validando
   el header `X-Dev-Key` contra esa clave.
2. Agregar una entrada a `PROJECTS` en Vercel con `id`, `name`, `baseUrl` y `devKey`.
3. Redeployar el panel. El selector de proyecto aparece solo.

## Desarrollo local

```bash
npm install
vercel dev --listen 3010   # sirve Vite + las functions en el mismo puerto
npm run build              # tsc + vite build
npm run lint               # oxlint
```

`vercel dev` toma las variables del entorno del proyecto (o de `.env.local`).
Sin `vercel dev`, `npm run dev` solo levanta Vite y `/api/*` no existe.

> **Troubleshooting:** si el login responde `503 Panel sin configurar`, `vercel dev`
> no está leyendo `.env.local`. Exportalas al entorno antes de lanzarlo:
>
> ```bash
> node -e "
> const fs=require('fs'),cp=require('child_process');
> const env=Object.fromEntries(fs.readFileSync('.env.local','utf8')
>   .split('\n').filter(Boolean).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
> cp.spawn('vercel',['dev','--listen','3010','--yes'],{env:{...process.env,...env},stdio:'inherit'});
> "
> ```
>
> No usar `set -a; . ./.env.local`: `PROJECTS` es JSON con comillas dobles y el
> shell lo destroza (queda `[{id:gesope,...}]` y el panel arranca sin proyectos).

## Estilos

Tema único oscuro. **Todos los colores salen de tokens CSS** definidos en
`src/index.css` (`--accent`, `--prio-*`, `--estado-*`, `--surface-*`, `--border-*`,
`--text-*`). En `src/App.tsx` los estilos inline referencian esos tokens con
`var(--token)`: no hay hex sueltos en el JSX.

### Paleta actual

| Uso | Token | Valor | Contraste vs `#0a0a0a` |
|-----|-------|-------|------------------------|
| Fondo | `--bg` | `#0a0a0a` | — |
| Superficie | `--surface` | `#1a1a1a` | — |
| Texto primario | `--text` | `#f1f5f9` | ≈18:1 ✅ |
| Texto secundario | `--text-dim` | `#cbd5e1` | ≈7.7:1 ✅ |
| Texto mudo | `--text-muted` | `#94a3b8` | ≈7.2:1 ✅ |
| Marca / acento | `--accent` | `#a78bfa` (violeta pastel) | ≈6.7:1 ✅ |
| Éxito | `--success` | `#86efac` (verde pastel) | ≈13:1 ✅ |
| Destructivo | `--danger` | `#fca5a5` (rojo salmón) | ≈5.3:1 ✅ |
| Prioridad baja | `--prio-baja` | `#cbd5e1` | ≈7.7:1 ✅ |
| Prioridad media | `--prio-media` | `#fde047` | ≈14:1 ✅ |
| Prioridad alta | `--prio-alta` | `#fbbf24` | ≈10.7:1 ✅ |
| Prioridad urgente | `--prio-urgente` | `#f87171` | ≈6.5:1 ✅ |
| Estado abierto | `--estado-abierto` | `#a78bfa` | ≈6.7:1 ✅ |
| Estado en progreso | `--estado-en_progreso` | `#86efac` | ≈13:1 ✅ |
| Estado resuelto | `--estado-resuelto` | `#86efac` | ≈13:1 ✅ |
| Estado cerrado | `--estado-cerrado` | `#94a3b8` | ≈7.2:1 ✅ |

Las escalas de **prioridad** y de **estado** son deliberadamente distintas —
mismo color, misma idea:

| | baja / cerrado | media | alta | urgente |
|---|---|---|---|---|
| **Prioridad** | gris claro | ámbar pastel | naranja pastel | rojo salmón |
| **Estado** | violeta (abierto) | verde (en progreso) | verde (resuelto) | gris (cerrado) |

Los estilos viven en `src/index.css` como clases (`.ticket-card`, `.modal`,
`.btn`, …); el JSX solo lleva estilos dinámicos, como el borde de color de la
prioridad. Layout de **escritorio**: no hay breakpoints (la app se usa desde la
computadora de desarrollo).

## Seguridad

- La sesión va en cookie `HttpOnly` firmada (HMAC-SHA256, 7 días).
- El login bloquea tras **8 intentos fallidos** en 15 minutos. El contador viaja
  en una cookie firmada (stateless), así que funciona igual en Vercel que en
  `vercel dev` — en `vercel dev` el módulo de la función se re-evalúa en cada
  request, por lo que un contador en memoria no sobreviviría.
  **Límite:** el cliente puede borrar esa cookie y reiniciar el contador. Contra
  fuerza bruta automatizada hace falta una regla de rate limiting en Vercel Firewall.
- El token es stateless: `POST /api/logout` borra la cookie, pero un token que ya
  se haya copiado sigue siendo válido hasta que expire.
- El proxy solo reenvía rutas bajo `/tickets` y solo a proyectos de `PROJECTS`.

## Deploy

```bash
vercel --prod --yes
```

## Estructura del proyecto

```
/src
  App.tsx           # Componente raíz: login, sesión, lista de tickets, modal, dashboard
  index.css         # Tokens CSS y estilos globales (tema oscuro, paleta pastel)
  main.tsx          # Punto de entrada de React
  dashboard/
    types.ts        # Tipos compartidos (KPI, AreaSeries, BarItem, ChartPoint)
    dashboard.css   # Estilos específicos del dashboard (sin hex sueltos)
    utils/
      chartHelpers.ts  # Escalas y paths SVG nativos (sin librerías de gráficos)
    components/
      DashboardView.tsx  # Vista del dashboard con datos reales como props
      KPICard.tsx        # Tarjetas métricas con tendencia ▲/▼
      AreaChart.tsx      # Gráfico de área streaming (creados vs resueltos)
      BarChart.tsx       # Gráfico de barras por prioridad
/api
  _lib.ts           # Helpers: proyectos, tokens, cookies, bloqueo de login
  login.ts          # POST /api/login
  logout.ts         # POST /api/logout
  projects.ts       # GET /api/projects
  proxy.ts          # Proxy server-side a /api/dev/tickets de cada app
```

## ¿Qué necesita un bot (o IA) para entender este proyecto y hacer un resumen?

Si querés que un agente de IA (incluido este mismo) entienda el proyecto y te haga
un diagnóstico o resumen confiable, necesita estos insumos **en este orden**:

1. **`PRODUCT.md`** — Qué es el producto, quién lo usa, desde dónde, urgencia, qué
   funciona bien y qué es lo más molesto. (Ya existe en este repo.)
2. **`README.md`** — Cómo se despliega, variables de entorno, arquitectura y cómo
   probarlo. (Actualizado arriba.)
3. **Estructura del código** — Ver la sección "Estructura del proyecto" de este
   README. Especialmente `src/App.tsx` (850+ líneas, monolítico) y `src/index.css`
   (todos los tokens).
4. **Datos de ejemplo y estados** — Cómo se ven los tickets, comentarios, proyectos
   y el flujo de login. Ver `api/_lib.ts` y los tipos en `src/App.tsx`.
5. **Variables de entorno necesarias** — `PANEL_USER`, `PANEL_PASSWORD`,
   `PANEL_SECRET`, `PROJECTS`. Sin ellas el login responde 503.
6. **Cómo correr localmente** — `vercel dev --listen 3010` (no `npm run dev` solo,
   que no levanta las funciones `/api/*`).
7. **Limitaciones conocidas** —
   - No hay endpoint de métricas agregadas en el proxy (solo `/tickets` crudo).
   - El dashboard calcula métricas en el cliente; si la lista de tickets crece
     mucho, hace falta un endpoint de stats en la app cliente o en el proxy.
   - No hay router: todo vive en un solo `App.tsx`.
   - `.env.local` tiene secretos y no debe commitearse.

Con esos insumos, un bot puede:
- Hacer un diagnóstico honesto de qué falta y qué está roto.
- Proponer cambios concretos con archivos exactos a editar.
- Estimar esfuerzo y riesgos antes de tocar código.

## Deploy

```bash
vercel --prod --yes
```
