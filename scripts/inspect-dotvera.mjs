import 'dotenv/config';
import pg from 'pg';

const {Pool} = pg;

const pool = new Pool({
  user: process.env.DOTVERA_DB_USER || process.env.DB_USER || 'ryan',
  host: process.env.DOTVERA_DB_HOST || process.env.DB_HOST || 'localhost',
  password: process.env.DOTVERA_DB_PASSWORD || process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DOTVERA_DB_PORT || process.env.DB_PORT || '5432', 10),
  database: process.env.DOTVERA_DB_NAME || 'dotvera',
});

async function main() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log(JSON.stringify(tables.rows, null, 2));
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {}
  process.exitCode = 1;
});
