import 'dotenv/config';
import {PrismaClient} from '@prisma/client';
import {getDotveraDatabaseUrl} from '@/lib/db/env';

const globalForPrisma = globalThis as unknown as {prisma?: PrismaClient};

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = getDotveraDatabaseUrl();
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
