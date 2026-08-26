import 'dotenv/config';
import pg from 'pg';

const {Pool} = pg;

const pool = new Pool({
  user: process.env.DB_USER || 'ryan',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'verify_cdp',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

async function main() {
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('TABLES', JSON.stringify(tables.rows, null, 2));

  for (const row of tables.rows) {
    const columns = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
      [row.table_name],
    );
    const count = await pool.query(`SELECT COUNT(*)::int AS count FROM "${row.table_name}"`);

    console.log(`COLUMNS ${row.table_name}`, JSON.stringify(columns.rows, null, 2));
    console.log(`COUNT ${row.table_name}`, JSON.stringify(count.rows[0], null, 2));
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {}
  process.exitCode = 1;
});
