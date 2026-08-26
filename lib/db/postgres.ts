import 'dotenv/config';
import {Pool} from 'pg';

let pool: Pool | null = null;

/** Returns a shared PostgreSQL pool for Next.js route handlers. */
export function getPool() {
  if (!pool) {
    pool = new Pool({
      user: process.env.DB_USER || 'ryan',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'verify_cdp',
      password: process.env.DB_PASSWORD || '',
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });
  }

  return pool;
}

/** Ensures the patterns table and image columns exist before route access. */
export async function ensurePatternsTable() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patterns (
      id VARCHAR(255) PRIMARY KEY,
      label VARCHAR(255) NOT NULL,
      density FLOAT NOT NULL,
      size INTEGER,
      style VARCHAR(50),
      payload TEXT,
      image_data TEXT,
      image_blob BYTEA,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await pool.query('ALTER TABLE patterns ADD COLUMN IF NOT EXISTS image_data TEXT;');
  await pool.query('ALTER TABLE patterns ADD COLUMN IF NOT EXISTS image_blob BYTEA;');
  await pool.query(`
    UPDATE patterns
    SET image_blob = decode(replace(image_data, 'data:image/png;base64,', ''), 'base64')
    WHERE image_blob IS NULL
      AND image_data LIKE 'data:image/png;base64,%';
  `);
}

/** Converts a stored PNG data URL into a binary buffer when available. */
export function imageDataToBuffer(imageData: unknown) {
  if (typeof imageData !== 'string') return null;
  const prefix = 'data:image/png;base64,';
  if (!imageData.startsWith(prefix)) return null;
  return Buffer.from(imageData.slice(prefix.length), 'base64');
}
