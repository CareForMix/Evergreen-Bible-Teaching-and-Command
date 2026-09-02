import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
