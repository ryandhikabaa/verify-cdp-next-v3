import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {randomUUID, scryptSync} from 'node:crypto';
import {Pool} from 'pg';
import {buildPostgresUrl, getDotveraDatabaseConfig, getDotveraSourceDatabaseName} from '../lib/db/env';

type SourceUserRow = {
  id: string;
  nama: string;
  username: string;
  password_hash: string;
  role: string;
  create_at: Date;
  update_at: Date;
  last_login: Date | null;
};

const prisma = new PrismaClient();

function hashPassword(password: string) {
  const salt = randomUUID();
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

async function copyUsersFromSource() {
  const sourceName = getDotveraSourceDatabaseName();
  const sourcePool = new Pool(getDotveraDatabaseConfig(sourceName));

  try {
    const result = await sourcePool.query<SourceUserRow>(
      `SELECT id, nama, username, password_hash, role, create_at, update_at, last_login
       FROM "user"
       ORDER BY create_at ASC`,
    );
    return {sourceName, rows: result.rows};
  } finally {
    await sourcePool.end();
  }
}

async function copyUsersPreservingHashes(rows: SourceUserRow[]) {
  if (rows.length === 0) return 0;

  const result = await prisma.user.createMany({
    data: rows.map((row) => ({
      id: row.id,
      nama: row.nama,
      username: row.username,
      passwordHash: row.password_hash,
      role: row.role,
      createAt: row.create_at,
      updateAt: row.update_at,
      lastLogin: row.last_login,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

async function seedFallbackAdmin() {
  const username = process.env.DOTVERA_ADMIN_USERNAME || 'admin';
  const password = process.env.DOTVERA_ADMIN_PASSWORD || 'admin12345';
  const nama = process.env.DOTVERA_ADMIN_NAME || 'Dotvera Admin';
  const role = process.env.DOTVERA_ADMIN_ROLE || 'admin';

  await prisma.user.upsert({
    where: {username},
    create: {
      nama,
      username,
      passwordHash: hashPassword(password),
      role,
    },
    update: {},
  });

  return username;
}

async function main() {
  const targetUrl = process.env.DATABASE_URL || buildPostgresUrl(getDotveraDatabaseConfig());
  console.log(`Seeding users into ${targetUrl.replace(/:[^:@/]+@/, ':***@')}`);

  let copied = 0;
  let sourceName = getDotveraSourceDatabaseName();
  let usedFallback = false;

  try {
    const source = await copyUsersFromSource();
    sourceName = source.sourceName;
    copied = await copyUsersPreservingHashes(source.rows);
    console.log(`Copied ${copied} new user row(s) from ${sourceName} (${source.rows.length} source row(s)). Password hashes were not re-hashed.`);
  } catch (error) {
    console.warn(`Could not copy users from ${sourceName}:`, error instanceof Error ? error.message : error);
  }

  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const username = await seedFallbackAdmin();
    usedFallback = true;
    console.warn(`No users present after copy. Seeded fallback admin '${username}' from DOTVERA_ADMIN_*.`);
  }

  const generatedCount = await prisma.patternGenerated.count();
  const detectionCount = await prisma.patternDetection.count();
  if (generatedCount !== 0 || detectionCount !== 0) {
    throw new Error(`dotvera_v3 must stay clean except user. Found pattern_generated=${generatedCount}, pattern_detection=${detectionCount}.`);
  }

  console.log(JSON.stringify({
    source: sourceName,
    copiedUsers: copied,
    totalUsers: await prisma.user.count(),
    usedFallback,
    patternGenerated: generatedCount,
    patternDetection: detectionCount,
  }));
}

main()
  .catch((error) => {
    console.error('Failed to seed dotvera_v3 users:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
