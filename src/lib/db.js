import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;
export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export async function dbHealth() {
  if (!config.databaseUrl) return { configured: false, ok: false };
  try {
    await pool.query('select 1');
    return { configured: true, ok: true };
  } catch {
    return { configured: true, ok: false };
  }
}
