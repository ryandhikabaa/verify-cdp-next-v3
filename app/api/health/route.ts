import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {prisma} from '@/lib/db/prisma';
import {getQrGenerateApiUrl} from '@/lib/db/env';

/** Returns database connectivity status for the V3.1 Prisma database. */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const readiness = searchParams.get('readiness') === 'true';

  // Basic health check (liveness probe)
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    return apiError({status: 500, message: error instanceof Error ? error.message : 'Unknown error'});
  }

  // If readiness check requested, also verify external dependencies
  if (readiness) {
    const checks = {
      database: true,
      qrApi: false,
    };

    // Check QR API
    try {
      const qrUrl = getQrGenerateApiUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(qrUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      if (response.ok) {
        checks.qrApi = true;
      }
    } catch (error) {
      console.error('[HEALTH] QR API check failed:', error);
    }

    const allHealthy = Object.values(checks).every(Boolean);
    
    if (allHealthy) {
      return apiSuccess({healthy: true, checks}, {message: 'All systems healthy'});
    } else {
      return apiError({status: 503, message: 'Some dependencies unhealthy', data: {checks}});
    }
  }

  return apiSuccess({healthy: true, database: 'dotvera_v3'}, {message: 'Health check successful'});
}
