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
    const contentType = upstream.headers.get('content-type') || '';
    res.status(upstream.status);
    if (contentType.includes('application/json')) {
      const text = await upstream.text();
      res.setHeader('Content-Type', 'application/json');
      res.send(text || '{}');
    } else {
      // Binario (capturas de tickets): hay que pasar los bytes tal cual. Leerlo
      // como texto los corrompe (el JPEG vuelve ilegible).
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      const disposition = upstream.headers.get('content-disposition');
      if (disposition) res.setHeader('Content-Disposition', disposition);
      res.send(buffer);
    }
  } catch (err: any) {
    res.status(502).json({ error: 'No se pudo contactar la app', detail: err?.message });
  }
}
