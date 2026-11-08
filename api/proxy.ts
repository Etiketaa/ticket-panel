import { projects, requireAuth } from './_lib.js';

// Proxy server-side hacia el /api/dev/* de cada app.
// El navegador nunca ve la devKey: la agrega esta función.
export default async function handler(req: any, res: any) {
  if (!requireAuth(req, res)) return;
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const projectId = String(req.query.project || '');
  const path = String(req.query.path || '');
  // Solo se permite el módulo de tickets (evita un proxy abierto).
  if (!/^\/tickets(\/|$)/.test(path)) {
    res.status(400).json({ error: 'Ruta no permitida' });
    return;
  }

  const project = projects().find((p) => p.id === projectId);
  if (!project) {
    res.status(404).json({ error: 'Proyecto no encontrado' });
    return;
  }

  const target = `${project.baseUrl.replace(/\/$/, '')}/api/dev${path}`;
  try {
    const init: any = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Key': project.devKey,
      },
    };
    if (req.method !== 'GET' && req.method !== 'DELETE' && req.body !== undefined) {
      init.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(target, init);
    const text = await upstream.text();
    res.status(upstream.status);
    if ((upstream.headers.get('content-type') || '').includes('application/json')) {
      res.setHeader('Content-Type', 'application/json');
      res.send(text || '{}');
    } else {
      res.send(text);
    }
  } catch (err: any) {
    res.status(502).json({ error: 'No se pudo contactar la app', detail: err?.message });
  }
}
