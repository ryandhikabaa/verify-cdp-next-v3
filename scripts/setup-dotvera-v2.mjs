import 'dotenv/config';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import pg from 'pg';

const {Pool} = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(projectRoot, 'database', 'dotvera_v2.sql');

const adminConfig = {
  user: process.env.DOTVERA_DB_USER || process.env.DB_USER || 'ryan',
  host: process.env.DOTVERA_DB_HOST || process.env.DB_HOST || 'localhost',
  password: process.env.DOTVERA_DB_PASSWORD || process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DOTVERA_DB_PORT || process.env.DB_PORT || '5432', 10),
  database: process.env.DOTVERA_ADMIN_DB || 'postgres',
};

const targetDatabase = process.env.DOTVERA_DB_NAME || 'dotvera_v2';

function normalizeSchemaSql(sql) {
  return sql
    .replace(/^CREATE DATABASE\s+.*?;\s*/im, '')
    .replace(/^\\connect\s+.*?(?:\r?\n|$)/im, '')
    .trim();
}

async function ensureDatabaseExists() {
  const adminPool = new Pool(adminConfig);
  try {
    const existing = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [targetDatabase]);
    if (existing.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${targetDatabase}"`);
      console.log(`Database '${targetDatabase}' created.`);
    } else {
      console.log(`Database '${targetDatabase}' already exists.`);
    }
  } finally {
    await adminPool.end();
  }
}

async function applySchema() {
  const sql = await readFile(schemaPath, 'utf8');
  const normalizedSql = normalizeSchemaSql(sql);
  const appPool = new Pool({...adminConfig, database: targetDatabase});

  try {
    await appPool.query(normalizedSql);
    console.log(`Schema applied to '${targetDatabase}'.`);
  } finally {
    await appPool.end();
  }
}

async function main() {
  await ensureDatabaseExists();
  await applySchema();
  console.log('Dotvera v2 setup completed.');
}

main().catch((error) => {
  console.error('Failed to set up Dotvera v2 database:', error);
  process.exitCode = 1;
});