import 'dotenv/config';
import {Pool} from 'pg';
import {buildPostgresUrl, getDotveraDatabaseConfig, getDotveraDatabaseName} from '../lib/db/env';

const targetDatabase = getDotveraDatabaseName();
const adminConfig = {
  ...getDotveraDatabaseConfig(process.env.DOTVERA_ADMIN_DB || 'postgres'),
  database: process.env.DOTVERA_ADMIN_DB || 'postgres',
};

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

async function main() {
  if (targetDatabase !== 'dotvera_v3') {
    throw new Error(`Refusing to create '${targetDatabase}'. V3.1 setup only creates dotvera_v3.`);
  }

  await ensureDatabaseExists();
  console.log(`Target DATABASE_URL=${buildPostgresUrl(getDotveraDatabaseConfig(targetDatabase)).replace(/:[^:@/]+@/, ':***@')}`);
  console.log('Dotvera v3 database is ready. Run prisma migrate deploy next. Do not apply v1/v2 SQL here.');
}

main().catch((error) => {
  console.error('Failed to set up Dotvera v3 database:', error);
  process.exitCode = 1;
});
