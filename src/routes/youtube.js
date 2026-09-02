import { Router } from 'express';
import { latestVideos, liveVideo } from '../lib/youtube.js';

export const youtubeRouter = Router();

youtubeRouter.get('/latest', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 8), 1), 20);
    res.json(await latestVideos(limit));
  } catch (e) { next(e); }
});

youtubeRouter.get('/live', async (_req, res, next) => {
  try { res.json(await liveVideo()); } catch (e) { next(e); }
});
