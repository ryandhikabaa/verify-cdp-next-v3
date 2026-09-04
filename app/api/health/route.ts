import {apiError, apiSuccess} from '@/lib/api-response';
import {prisma} from '@/lib/db/prisma';

/** Returns database connectivity status for the V3.1 Prisma database. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return apiSuccess({healthy: true, database: 'dotvera_v3'}, {message: 'Health check successful'});
  } catch (error) {
    return apiError({status: 500, message: error instanceof Error ? error.message : 'Unknown error'});
  }
}
