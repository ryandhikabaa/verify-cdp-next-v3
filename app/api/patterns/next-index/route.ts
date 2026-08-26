import {NextRequest, NextResponse} from 'next/server';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError, apiSuccess} from '@/lib/api-response';

/** Returns the next numeric suffix for a given pattern prefix. */
export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix') || 'VERIFY';
  const digits = 4;
  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query('SELECT serial FROM pattern_generated_v21 WHERE serial LIKE $1', [`${prefix}%`]);
    let maxIndex = 0;
    for (const row of result.rows) {
      const match = row.serial.match(new RegExp(`^${prefix}(\\d{${digits}})$`, 'i'));
      if (!match) continue;
      const index = parseInt(match[1], 10);
      if (index > maxIndex) maxIndex = index;
    }
    return apiSuccess({nextIndex: maxIndex + 1}, {message: 'Next pattern index retrieved'});
  } catch (error) {
    console.error('Error fetching next index:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
