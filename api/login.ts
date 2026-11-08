import {
  loginBlockedUntil,
  loginGuardCleared,
  loginGuardValue,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  readLoginGuard,
  sessionCookieValue,
  signToken,
  timingSafeStr,
} from './_lib.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  const user = process.env.PANEL_USER || '';
  const pass = process.env.PANEL_PASSWORD || '';
  if (!user || !pass || !process.env.PANEL_SECRET) {
    res.status(503).json({ error: 'Panel sin configurar (faltan variables de entorno)' });
    return;
  }

  const now = Date.now();
  const guard = readLoginGuard(req);
  const blockedUntil = loginBlockedUntil(guard, now);
  if (blockedUntil > now) {
    res.setHeader('Retry-After', String(Math.ceil((blockedUntil - now) / 1000)));
    res.status(429).json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' });
    return;
  }

  let body: any = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.status(400).json({ error: 'Body inválido' });
    return;
  }
  const u = String(body.username || '');
  const p = String(body.password || '');

  if (!timingSafeStr(u, user) || !timingSafeStr(p, pass)) {
    const count = guard && guard.until > now ? guard.count + 1 : 1;
    const until = guard && guard.until > now ? guard.until : now + LOGIN_WINDOW_MS;
    res.setHeader('Set-Cookie', loginGuardValue(count, until));
    if (count >= LOGIN_MAX_FAILURES) {
      res.setHeader('Retry-After', String(Math.ceil((until - now) / 1000)));
      res.status(429).json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' });
      return;
    }
    res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    return;
  }

  // Login correcto: abrir la sesión y limpiar el contador de fallos.
  const token = signToken(user);
  res.setHeader('Set-Cookie', [sessionCookieValue(token), loginGuardCleared()]);
  res.status(200).json({ ok: true, user });
}
