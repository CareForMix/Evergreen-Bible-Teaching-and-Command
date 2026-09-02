import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import { config } from './config.js';
import { dbHealth } from './lib/db.js';
import { youtubeRouter } from './routes/youtube.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(pinoHttp());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.frontendOrigin, methods: ['GET','POST','PUT','PATCH','DELETE'], credentials: false }));
app.use(express.json({ limit: '256kb' }));

app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/admin/login', rateLimit({ windowMs: 15*60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/prayer-requests', rateLimit({ windowMs: 15*60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/contact', rateLimit({ windowMs: 15*60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/', (_req,res)=>res.json({
  name:'Evergreen Bible Teaching and Command Global Believers Ministry API',
  version:'2.0.0',
  status:'running',
  endpoints:{
    health:'/api/health',
    youtubeLatest:'/api/youtube/latest',
    youtubeLive:'/api/youtube/live'
  }
}));

app.get('/api/health', async (_req,res)=>{
  const database = await dbHealth();
  res.status(database.configured && !database.ok ? 503 : 200).json({
    ok: !database.configured || database.ok,
    service:'evergreen-api',
    version:'2.0.0',
    database
  });
});

app.use('/api/youtube', youtubeRouter);
app.use('/api', publicRouter);
app.use('/api/admin', adminRouter);

app.use((_req,res)=>res.status(404).json({ error:'Route not found.' }));
app.use((err,req,res,_next)=>{
  req.log?.error(err);
  if (err instanceof ZodError) return res.status(400).json({ error:'Validation failed.', details:err.issues });
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Internal server error.' });
});

app.listen(config.port, ()=>console.log(`Evergreen Strong API listening on http://localhost:${config.port}`));
