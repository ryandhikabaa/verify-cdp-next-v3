import 'dotenv/config';
import {randomUUID, scryptSync} from 'node:crypto';
import {Pool} from 'pg';

const pool = new Pool({
  user: process.env.DOTVERA_DB_USER || process.env.DB_USER || 'ryan',
  host: process.env.DOTVERA_DB_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.DOTVERA_DB_NAME || 'dotvera',
  password: process.env.DOTVERA_DB_PASSWORD || process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DOTVERA_DB_PORT || process.env.DB_PORT || '5432', 10),
});

function hashPassword(password) {
  const salt = randomUUID();
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

const username = process.env.DOTVERA_ADMIN_USERNAME || 'admin';
const password = process.env.DOTVERA_ADMIN_PASSWORD || 'admin12345';
const name = process.env.DOTVERA_ADMIN_NAME || 'Dotvera Admin';
const role = process.env.DOTVERA_ADMIN_ROLE || 'admin';

await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
await pool.query(`
  CREATE TABLE IF NOT EXISTS "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    create_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ
  );
`);

const passwordHash = hashPassword(password);
await pool.query(
  `INSERT INTO "user" (nama, username, password_hash, role)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (username) DO UPDATE SET
     nama = EXCLUDED.nama,
     password_hash = EXCLUDED.password_hash,
     role = EXCLUDED.role,
     update_at = CURRENT_TIMESTAMP`,
  [name, username, passwordHash, role],
);

console.log(`Admin seeded: ${username}`);
await pool.end();