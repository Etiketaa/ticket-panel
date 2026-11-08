# PRODUCT.md — Dev Ticket Panel

## Qué es
Panel externo de soporte para leer y responder los tickets de una o varias apps internas. Es independiente de la app que genera los tickets: tiene su propio login y no usa credenciales de clientes.

## Producto
- **Nombre:** Dev Ticket Panel
- **Repo:** `ticket-panel`
- **Producción:** https://ticket-panel-seven.vercel.app
- **Stack:** Vite + React + TypeScript (frontend) + Vercel Functions (backend)
- **Pantalla principal:** login → selector de proyecto → lista de tickets → modal de detalle con cambio de estado, eliminación y comentarios

## Quién lo usa
- **Usuario único:** dev fullstack (Franco), desde su computadora de desarrollo (desktop)
- **Dispositivos:** solo desktop (su máquina de trabajo). No móvil, no tablet.
- **Contexto de uso:** entrando a la app interna para operar tickets; si no puede entrar y operar, es urgente

## Proyectos
- Por ahora solo uno: `system-intern-de-gestión` (gesope)
- Posibles más en el futuro, vía variable de entorno `PROJECTS` en Vercel

## Urgencia
- **Depende:** si no funciona el acceso y la operación, es urgente.
- Pregunta abierta del usuario: ¿conviene desplegar un bot (ej. WhatsApp/Telegram) para tickets?

## Lo que funciona bien (no romper)
- Login propio con token firmado (7 días), cookie `HttpOnly` en producción
- Proxy server-side: el navegador nunca ve la `devKey` de cada app
- Lectura y respuesta de tickets en tiempo real (auto-refresco 5s con ticket abierto / 15s en lista)
- Cambio de estado, eliminación y comentarios con optimización optimista
- Despliegue en Vercel ya funcionando

## Lo más molesto (scope de este cambio)
- **El color azul** (`#2563eb`) se siente "horrible"; es el primer cambio a hacer
- Se quiere **paleta pastel** y **menos azul**
- **Más interactividad**: feedback visual al guardar cambios (hoy no hay indicador de que se está guardando), botón deshabilitado mientras se opera, estados claros

## Restricciones
- Tema único oscuro (la app es dark-only)
- Sin nuevas librerías de animación; CSS nativo
- Build y lint deben pasar (oxlint, tsc, vite build)
- No commitear `.env`
