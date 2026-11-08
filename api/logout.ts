import { sessionCookieCleared } from './_lib.js';

// Cierra la sesión del panel borrando la cookie httpOnly.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  res.setHeader('Set-Cookie', sessionCookieCleared());
  res.status(200).json({ ok: true });
}
