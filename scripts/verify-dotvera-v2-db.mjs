import 'dotenv/config';
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
  const db = await client.query('SELECT current_database() AS name');
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  );

  console.log(
    JSON.stringify(
      {
        database: db.rows[0]?.name,
        tables: tables.rows.map((row) => row.table_name),
      },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
