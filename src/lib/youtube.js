import { Router } from 'express';
import {
  latestVideos,
  liveVideo
} from '../lib/youtube.js';

const router = Router();

router.get('/latest', async (req, res, next) => {
  try {
    const limit = Math.min(
      Math.max(
        Number(req.query.limit) || 8,
        1
      ),
      100
    );

    const category = String(
      req.query.category || 'latest'
    ).toLowerCase();

    const result = await latestVideos(
      limit,
      category
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/live', async (req, res, next) => {
  try {
    const result = await liveVideo();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
