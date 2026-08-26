import 'dotenv/config';
import pg from 'pg';

const {Pool} = pg;

const legacyPool = new Pool({
  user: process.env.DB_USER || 'ryan',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'verify_cdp',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

const dotveraPool = new Pool({
  user: process.env.DOTVERA_DB_USER || process.env.DB_USER || 'ryan',
  host: process.env.DOTVERA_DB_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.DOTVERA_DB_NAME || 'dotvera',
  password: process.env.DOTVERA_DB_PASSWORD || process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DOTVERA_DB_PORT || process.env.DB_PORT || '5432', 10),
});

async function ensureTargetSchema() {
  await dotveraPool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
  await dotveraPool.query(`
    CREATE TABLE IF NOT EXISTS pattern_generated (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      serial VARCHAR(255) NOT NULL UNIQUE,
      density DOUBLE PRECISION NOT NULL,
      size INTEGER,
      style VARCHAR(100),
      payload TEXT,
      image_data TEXT,
      image_blob BYTEA,
      create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function migrate() {
  await ensureTargetSchema();

  const legacyRows = await legacyPool.query(`
    SELECT id, label, density, size, style, payload, image_data, image_blob, created_at, updated_at
    FROM patterns
    ORDER BY id ASC
  `);

  if (legacyRows.rowCount === 0) {
    console.log('No legacy patterns found.');
    return;
  }

  const client = await dotveraPool.connect();
  try {
    await client.query('BEGIN');

    for (const row of legacyRows.rows) {
      await client.query(
        `INSERT INTO pattern_generated (serial, density, size, style, payload, image_data, image_blob, create_at, update_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (serial) DO UPDATE SET
           density = EXCLUDED.density,
           size = EXCLUDED.size,
           style = EXCLUDED.style,
           payload = EXCLUDED.payload,
           image_data = EXCLUDED.image_data,
           image_blob = EXCLUDED.image_blob,
           update_at = EXCLUDED.update_at`,
        [
          row.id,
          row.density,
          row.size,
          row.style,
          row.payload ?? row.label ?? row.id,
          row.image_data,
          row.image_blob,
          row.created_at ?? new Date(),
          row.updated_at ?? new Date(),
        ],
      );
    }

    await client.query('COMMIT');
    console.log(`Migrated ${legacyRows.rowCount} pattern(s) from verify_cdp.patterns to dotvera.pattern_generated.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await migrate();
  } finally {
    await legacyPool.end();
    await dotveraPool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});