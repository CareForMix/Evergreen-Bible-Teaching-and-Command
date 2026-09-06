import fs from 'node:fs/promises';
import { pool } from './lib/db.js';

const migrations = [
  '../sql/001_init.sql',
  '../sql/002_media_content.sql',
  '../sql/003_news.sql'
];

for (const file of migrations) {
  const sql = await fs.readFile(
    new URL(file, import.meta.url),
    'utf8'
  );

  await pool.query(sql);
  console.log(`Applied: ${file}`);
}

console.log(
  'Evergreen database initialized and migrations applied.'
);

await pool.end();
