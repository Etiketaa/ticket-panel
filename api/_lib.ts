// Helpers compartidos por las funciones serverless del panel.
// Nada de esto se expone al navegador: los secretos viven en env de Vercel.
import crypto from 'node:crypto';

export type Project = {
  id: string;
  name: string;
  baseUrl: string;
  devKey: string;
};

/** Proyectos configurados en la env `PROJECTS` (JSON). Incluye la devKey. */
export function projects(): Project[] {
  const raw = process.env.PROJECTS || '';
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: any) =>
        p && typeof p.id === 'string' && typeof p.baseUrl === 'string' && typeof p.devKey === 'string',
    );
  } catch {
    return [];
  }
}

/** Versión sin secretos, para mandar al frontend. */
export function publicProjects() {
  return projects().map(({ id, name, baseUrl }) => ({ id, name, baseUrl }));
}

const SECRET = process.env.PANEL_SECRET || '';

export const SESSION_COOKIE = 'panel_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 días

export const LOGIN_GUARD_COOKIE = 'panel_login_guard';
export const LOGIN_MAX_FAILURES = 8;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/** `Secure` sólo en producción: en local el server corre por http. */
function secureAttr(): string {
  return process.env.NODE_ENV === 'production' ? '; Secure' : '';
}

/** Lee una cookie del request (parseo propio como fallback de req.cookies). */
export function readCookie(req: any, name: string): string {
  const fromParsed = req?.cookies?.[name];
  if (typeof fromParsed === 'string' && fromParsed) return fromParsed;
  const header = req?.headers?.cookie || '';
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return part.slice(idx + 1).trim();
      }
    }
  }
  return '';
}

/** Firma un token simple (payload + HMAC SHA-256), válido 7 días. */
export function signToken(user: string, ttlSeconds = SESSION_TTL_SECONDS): string {
  const payload = Buffer.from(
    JSON.stringify({ user, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): { user: string; exp: number } | null {
  if (!SECRET || !token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function bearer(req: any): string {
  const h = req.headers?.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : '';
}

/** Devuelve el usuario del token o responde 401. */
export function requireAuth(req: any, res: any): { user: string; exp: number } | null {
  const token = readCookie(req, SESSION_COOKIE) || bearer(req);
  const data = verifyToken(token);
  if (!data) {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
    return null;
  }
  return data;
}

export function timingSafeStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// Bloqueo por intentos fallidos de login
//
// El contador viaja en una cookie firmada con PANEL_SECRET: es stateless, así
// que funciona igual en Vercel (una instancia por lambda) que en `vercel dev`
// (donde el módulo se re-evalúa en cada request y un Map en memoria no
// persiste).
//
// Límite real: el cliente puede borrar la cookie y reiniciar el contador.
// Contra un atacante automatizado hace falta una regla de rate limiting en
// Vercel Firewall.
// ---------------------------------------------------------------------------

type Guard = { count: number; until: number };

function hmac(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

function guardCookie(value: string, maxAgeSeconds: number): string {
  return `${LOGIN_GUARD_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureAttr()}`;
}

/** Lee el contador de fallos, validando la firma. */
export function readLoginGuard(req: any): Guard | null {
  const raw = readCookie(req, LOGIN_GUARD_COOKIE);
  if (!raw) return null;
  const idx = raw.lastIndexOf('.');
  if (idx < 0) return null;
  const payload = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data.count !== 'number' || typeof data.until !== 'number') return null;
    return { count: data.count, until: data.until };
  } catch {
    return null;
  }
}

/** Valor de la cookie con el contador de fallos (firmado). */
export function loginGuardValue(count: number, until: number): string {
  const payload = Buffer.from(JSON.stringify({ count, until })).toString('base64url');
  return guardCookie(`${payload}.${hmac(payload)}`, Math.ceil(LOGIN_WINDOW_MS / 1000));
}

/** Valor de la cookie para limpiar el contador. */
export function loginGuardCleared(): string {
  return guardCookie('', 0);
}

/** Instante (ms epoch) hasta el que sigue bloqueado, o 0. */
export function loginBlockedUntil(guard: Guard | null, now: number): number {
  if (!guard || guard.count < LOGIN_MAX_FAILURES) return 0;
  return guard.until > now ? guard.until : 0;
}

/** Cookie de sesión (httpOnly). El token nunca pasa por el JS del navegador. */export function sessionCookieValue(token: string): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureAttr()}`;
}

/** Borra la cookie de sesión (logout). */
export function sessionCookieCleared(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureAttr()}`;
}
