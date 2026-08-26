import {NextRequest, NextResponse} from 'next/server';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError} from '@/lib/api-response';

/** Returns a stored pattern image as a PNG binary response. */
export async function GET(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query('SELECT image_blob, image_data FROM pattern_generated_v21 WHERE serial = $1', [id]);
    if (result.rowCount === 0) {
      return apiError({status: 404, message: 'Pattern not found'});
    }

    const row = result.rows[0];
    let imageBuffer = row.image_blob as Buffer | null;
    if (!imageBuffer && typeof row.image_data === 'string' && row.image_data.startsWith('data:image/png;base64,')) {
      imageBuffer = Buffer.from(row.image_data.replace('data:image/png;base64,', ''), 'base64');
    }

    if (!imageBuffer) {
      return apiError({status: 404, message: 'Pattern image not found'});
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error fetching pattern image:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
