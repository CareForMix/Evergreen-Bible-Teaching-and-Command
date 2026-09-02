import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db.js';

export const publicRouter = Router();

const submissionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180).optional().or(z.literal('')),
  message: z.string().trim().min(3).max(5000)
});

function submissionRoute(type) {
  return async (req, res, next) => {
    try {
      const data = submissionSchema.parse(req.body);
      const result = await pool.query(
        `insert into submissions(type,name,email,message)
         values($1,$2,$3,$4) returning id, created_at`,
        [type, data.name, data.email || null, data.message]
      );
      res.status(201).json({ ok: true, submission: result.rows[0] });
    } catch (e) { next(e); }
  };
}

publicRouter.get('/teachings', async (_req, res, next) => {
  try {
    const q = await pool.query(`select id,slug,title,summary,scripture,published_at
      from teachings where published=true order by published_at desc nulls last, id desc limit 50`);
    res.json({ items: q.rows });
  } catch(e){ next(e); }
});

publicRouter.get('/events', async (_req, res, next) => {
  try {
    const q = await pool.query(`select id,title,description,starts_at,location,registration_url
      from events where starts_at >= now() order by starts_at asc limit 50`);
    res.json({ items: q.rows });
  } catch(e){ next(e); }
});

publicRouter.get('/testimonies', async (_req, res, next) => {
  try {
    const q = await pool.query(`select id,name,title,body,published_at
      from testimonies where published=true order by published_at desc nulls last, id desc limit 50`);
    res.json({ items: q.rows });
  } catch(e){ next(e); }
});

publicRouter.post('/prayer-requests', submissionRoute('prayer'));
publicRouter.post('/contact', submissionRoute('contact'));
publicRouter.post('/volunteer-applications', submissionRoute('volunteer'));
