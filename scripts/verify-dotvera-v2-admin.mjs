import 'dotenv/config';
import {scryptSync, timingSafeEqual} from 'node:crypto';
import pg from 'pg';

const {Client} = pg;

const client = new Client({
  user: process.env.DOTVERA_DB_USER || process.env.DB_USER || 'ryan',
  host: process.env.DOTVERA_DB_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.DOTVERA_DB_NAME || 'dotvera_v2',
  password: process.env.DOTVERA_DB_PASSWORD || process.env.DB_PASSWORD || '',
  port: Number(process.env.DOTVERA_DB_PORT || process.env.DB_PORT || 5432),
});

try {
  await client.connect();
  const username = process.env.DOTVERA_ADMIN_USERNAME || 'admin';
  const password = process.env.DOTVERA_ADMIN_PASSWORD || 'admin12345';
  const result = await client.query('SELECT username, password_hash, role FROM "user" WHERE username = $1 LIMIT 1', [username]);
  const row = result.rows[0];

  if (!row) {
    throw new Error('Admin user not found');
  }

  const [salt, hash] = String(row.password_hash).split(':');
  const incoming = scryptSync(password, salt, 64);
  const existing = Buffer.from(hash, 'hex');
  const passwordValid = existing.length === incoming.length && timingSafeEqual(existing, incoming);

  console.log(
    JSON.stringify(
      {
        username: row.username,
        role: row.role,
        passwordValid,
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
