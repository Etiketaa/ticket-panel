# Dashboard de tickets — recomendaciones de implementación

Stack: **solo React + TypeScript + CSS nativo**. Sin Chart.js, Recharts, D3, Framer Motion ni librerías de gráficos/animación. Los gráficos son SVG escrito a mano en componentes React.

Fondo único: **gris carbón #0a0a0a** (dark-only). Paleta pastel ya definida en `src/index.css` (tokens CSS, no hex sueltos en el JSX).

---

## 1. Gráfico de streaming/área (SVG nativo)

Ver `src/dashboard/components/AreaChart.tsx`.

### Path de área
Para cada serie se calculan puntos `{x, y}` con dos escalas lineales propias (sin librerías):

- `xScale`: índice del punto (0 … n-1) → ancho del área de plot.
- `yScale`: valor del ticket → altura invertida (0 queda en el eje X, `yMax` en el tope).

El path del área se construye con SVG:

```
M x0 y0 L x1 y1 … L xLast yLast   ← contorno superior
L xLast bottomY                    ← bajada al eje X
L x0 bottomY                       ← vuelta al inicio
Z                                  ← cierra el polígono
```

Relleno con gradiente de opacidad (violeta para creados, verde para resueltos) y trazo de 2 px. La segunda serie se dibuja como línea fina sobre el área.

### Ejes y grid
- Eje Y: 5 ticks "redondos" (`niceTicks`), línea horizontal ligera por tick (`stroke-opacity: 0.3`) y etiqueta alineada a la derecha.
- Eje X: etiquetas de hora espaciadas (máximo 8) para que no se apretujen en pantallas chicas.
- Líneas de eje: `path` con `stroke="var(--border)"`.

### Auto-refresh
`AreaChart` acepta `refreshIntervalMs` + `onRefresh`. Arma un `setInterval` que le pide al padre que vuelva a fetchear. **No hay animación**: solo se re-renderizan los datos nuevos. Se limpia el intervalo en el `return` del `useEffect`.

### Tooltip simple
En `onMouseMove` del SVG se busca el punto más cercano al cursor (umbral 30 px) y se muestra un `<div className="tooltip">` absoluto con `left`/`top` en px. Aparece/desaparece sin transición cuando `prefers-reduced-motion: reduce`.

### Accesibilidad SVG
```tsx
<svg role="img" aria-label="Tickets creados vs resueltos en las últimas 24 horas">
  <title id="area-title">…</title>
  <desc id="area-desc">Eje X: hora del día. Eje Y: cantidad de tickets. Área violeta: creados. Línea verde: resueltos.</desc>
  …
</svg>
```
- `role="img` + `aria-label` da nombre al gráfico entero.
- `<title>` y `<desc>` dan contexto navegable por lectores de pantalla.
- Cada `<path>` y `<rect>` lleva un `<title>` hijo (tooltip nativo del navegador al pasar el mouse).
- No hay colores sueltos: `fill="var(--accent)"`, `stroke="var(--border)"`, etc.

---

## 2. Gráfico de barras (SVG nativo)

Ver `src/dashboard/components/BarChart.tsx`.

### Alturas proporcionales
`yScale = scaleLinear([0, maxValor], [plotHeight, 0])`. La altura de cada barra es `yScale(valor)`; se dibuja desde `bottomY - h` hasta `bottomY`. Si `maxValor === 0` se usa `1` para evitar división por cero.

### Etiquetas de valor
Un `<text>` centrado sobre cada barra (`x + barW/2`, `y - 8`) con el número. Solo se pinta si `valor > 0`.

### Accesibilidad
Mismo esquema: `role="img"`, `aria-label`, `<title>`, `<desc>`, y un `<title>` dentro de cada `<rect>` para tooltip nativo. Los colores de barra vienen de tokens (`var(--prio-baja)`, etc.).

---

## 3. KPI cards

Ver `src/dashboard/components/KPICard.tsx` y `.kpi-card` en `src/dashboard/dashboard.css`.

- Valor grande (`var(--font-xl)`, 20 px), etiqueta en mayúscula chica (`var(--font-xs)`), color del valor acorde a la métrica (violeta para abiertos, verde para resueltos, etc.).
- Tendencia opcional con flecha ▲/▼ y color éxito/advertencia.
- Todo dentro de `article.card` con borde y fondo de superficie.

---

## 4. Mejores prácticas de UX

Ver `src/dashboard/components/Dashboard.tsx` (demo completo) y `src/dashboard/dashboard.css`.

### Estados de carga
Skeleton CSS (`.skeleton`) con gradiente desplazado. Bajo `prefers-reduced-motion: reduce` la animación se desactiva y el skeleton queda opaco estático. Spinner 100% SVG (`.spinner circle` con `stroke-dasharray`) para momentos puntuales.

### Empty states
Cuando no hay resultados: mensaje claro + acción principal ("Crear ticket"). Nunca dejar una pantalla en blanco sin camino adelante.

### Errores
`<div role="alert">` con título, mensaje y botón "Reintentar". El `role="alert" anuncia el error a lectores de pantalla sin mover el foco.

### Deep linking con query params
Los filtros (proyecto, estado) se leen de `window.location.search` al montar y se escriben con `history.replaceState` al cambiar, sin recargar:

```
?project=gesope&status=abierto
```

La URL refleja siempre los filtros activos, y se muestra una pista `URL: ?project=…&status=…` para que se pueda copiar/pegar.

### Estado activo visual
El proyecto seleccionado en el sidebar se resalta con borde violeta (`var(--accent)`), fondo de superficie-hover y punto de color. Las chips de filtro activo usan `var(--accent-soft)` de fondo y `var(--accent)` de borde.

### Touch targets >= 44px
Botones (`.btn`), chips (`.chip`) y elementos del sidebar (`.project-item`) tienen `min-height: 44px`.

### Focus visible
`:focus-visible` con outline de 2 px en `var(--accent)` y `outline-offset: 2px` (ya en `index.css`, reforzado en `dashboard.css`). Nunca se quita el outline sin reemplazarlo por algo equivalente.

### Reducir movimiento
```css
@media (prefers-reduced-motion: reduce) {
  .skeleton::after { animation: none !important; opacity: 0.6 !important; }
  .spinner { animation: none !important; }
  .tooltip { transition: none !important; }
  .project-item { transition: none !important; }
}
```
Las transiciones de hover (`filter: brightness`, `transform: translateY`) se anulan bajo esta media query.

---

## 5. Paleta recomendada sobre fondo #0a0a0a

Todos los colores ya están como tokens en `src/index.css`. Los contrastes son **estimados** por la fórmula WCAG (luminancia relativa); verificar con DevTools / Lighthouse antes de publicar.

| Uso | Color | Contraste vs #0a0a0a | WCAG AA | Notas |
|---|---|---:|---|---|
| Texto primario | `#f8fafc` (blanco roto) | ≈17.5:1 | ✅ AAA | Títulos, valores KPI, etiquetas principales |
| Texto secundario | `#cbd5e1` | ≈12.4:1 | ✅ AAA | Subtítulos, fechas |
| Texto terciario/mudo | `#94a3b8` | ≈7.2:1 | ✅ AA | Etiquetas de eje, textos de ayuda, placeholder |
| Bordes de componentes | `#64748b` | ≈3.9:1 | ✅ 3:1 UI | Cards, inputs, líneas de grid (pasa "no textual") |
| Acento principal | `#a78bfa` (violeta) | ≈6.7:1 | ✅ AA | Líneas de área, proyectos activos, focus. **No poner texto blanco encima** |
| Éxito | `#86efac` (verde claro) | ≈13:1 | ✅ AAA | Resueltos, tendencias positivas, barras de éxito |
| Advertencia | `#fde047` (ámbar pastel) | ≈14:1 | ✅ AAA | Texto oscuro (`#1a1a1a` o negro) encima del chip |
| Error | `#fca5a5` (rojo salmón) | ≈9.7:1 | ✅ AA/AAA | Texto oscuro encima del chip, bordes de alerta |

### Reglas de uso
1. **Texto sobre fondo #0a0a0a**: usar blanco roto (`#f8fafc`) o gris claro (`#cbd5e1`). Los pastel sí pasan como texto normal sobre este fondo (violeta ≈6.7:1), pero vibran visualmente; mejor reservarlos para gráficos, líneas y chips.
2. **Texto sobre pastel**: nunca blanco. Usar texto oscuro (`#1a1a1a` / negro o `#0a0a0a`) sobre chips de éxito/advertencia/error para mantener contraste.
3. **Bordes que transmiten información** (input activo, proyecto seleccionado, alerta): mínimo 3:1 contra el fondo. `#334155` da solo ≈1.8:1 → **no usar** para bordes significativos.
4. **Superficies**: `--surface: #1a1a1a` sobre `--bg: #0a0a0a` da ≈2.1:1, suficiente para separación sutil decorativa (no requiere 3:1 si no transmite información).

---

## Cómo probar el ejemplo

```bash
cd /home/franco/Proyectos/ticket-panel
npm install   # si aún no están los node_modules
npm run dev   # http://localhost:5173
```

El dashboard se monta en `src/dashboard/components/Dashboard.tsx`. Para integrarlo, renderizar `<DashboardPage />` desde cualquier ruta o desde `App.tsx`. No se modifica ningún archivo existente: todo vive bajo `src/dashboard/`.
