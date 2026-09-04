import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {mapPatternGeneratedToListDoc} from '@/lib/db/patterns';
import {prisma} from '@/lib/db/prisma';

const PATTERN_SAVE_UNAVAILABLE_MESSAGE = 'Penyimpanan pattern V3.1 membutuhkan metadata QR dari API generate. Endpoint ini aktif setelah Phase 4.';

/** Returns the full pattern catalog ordered by pattern_payload. Secrets stay off the list. */
export async function GET() {
  try {
    const rows = await prisma.patternGenerated.findMany({
      orderBy: {patternPayload: 'asc'},
    });
    return apiSuccess(
      rows.map(mapPatternGeneratedToListDoc),
      {message: 'Patterns retrieved successfully'},
    );
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}

/** Pattern POST waits for Phase 4 QR metadata. Do not insert into v21. */
export async function POST(_request: NextRequest) {
  return apiError({status: 400, message: PATTERN_SAVE_UNAVAILABLE_MESSAGE});
}
