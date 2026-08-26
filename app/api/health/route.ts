import {NextResponse} from 'next/server';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError, apiSuccess} from '@/lib/api-response';

/** Returns database connectivity status for the migration API. */
export async function GET() {
  try {
    await ensureDotveraSchema();
    await getDotveraPool().query('SELECT 1');
    return apiSuccess({healthy: true}, {message: 'Health check successful'});
  } catch (error) {
    return apiError({status: 500, message: error instanceof Error ? error.message : 'Unknown error'});
  }
}
