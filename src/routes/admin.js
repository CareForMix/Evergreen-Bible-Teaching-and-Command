import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { pool } from '../lib/db.js';
import { requireAdmin } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.post('/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const body = schema.parse(req.body);
  if (!config.adminEmail || !config.adminPassword ||
      body.email !== config.adminEmail || body.password !== config.adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }
  const token = jwt.sign({ role: 'admin', email: body.email }, config.jwtSecret, { expiresIn: '8h' });
  res.json({ token, expiresIn: '8h' });
});

adminRouter.use(requireAdmin);

adminRouter.get('/submissions', async (req, res, next) => {
  try {
    const type = req.query.type;
    const values = [];
    let where = '';
    if (type) { values.push(type); where = 'where type=$1'; }
    const q = await pool.query(
      `select id,type,name,email,message,created_at from submissions ${where} order by created_at desc limit 200`,
      values
    );
    res.json({ items: q.rows });
  } catch(e){ next(e); }
});

adminRouter.post('/teachings', async (req,res,next)=>{
  try{
    const s=z.object({
      slug:z.string().min(2).max(160),
      title:z.string().min(2).max(240),
      summary:z.string().max(2000).optional().default(''),
      scripture:z.string().max(500).optional().default(''),
      published:z.boolean().optional().default(false)
    });
    const d=s.parse(req.body);
    const q=await pool.query(
      `insert into teachings(slug,title,summary,scripture,published,published_at)
       values($1,$2,$3,$4,$5,case when $5 then now() else null end)
       returning *`,[d.slug,d.title,d.summary,d.scripture,d.published]);
    res.status(201).json(q.rows[0]);
  }catch(e){next(e)}
});

adminRouter.post('/events', async (req,res,next)=>{
  try{
    const s=z.object({
      title:z.string().min(2).max(240),
      description:z.string().max(5000).optional().default(''),
      startsAt:z.string().datetime(),
      location:z.string().max(300).optional().default('Online'),
      registrationUrl:z.string().url().optional().or(z.literal(''))
    });
    const d=s.parse(req.body);
    const q=await pool.query(
      `insert into events(title,description,starts_at,location,registration_url)
       values($1,$2,$3,$4,$5) returning *`,
      [d.title,d.description,d.startsAt,d.location,d.registrationUrl||null]);
    res.status(201).json(q.rows[0]);
  }catch(e){next(e)}
});
