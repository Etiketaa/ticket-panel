import { publicProjects, requireAuth } from './_lib.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }
  if (!requireAuth(req, res)) return;
  res.status(200).json({ projects: publicProjects() });
}
