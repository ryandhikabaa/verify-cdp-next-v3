import {NextRequest, NextResponse} from 'next/server';
import {apiError} from '@/lib/api-response';
import {prisma} from '@/lib/db/prisma';

/** Returns a stored pattern image as a PNG binary response. */
export async function GET(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  try {
    const row = await prisma.patternGenerated.findUnique({
      where: {patternPayload: id},
      select: {imageBlob: true, imageData: true},
    });
    if (!row) {
      return apiError({status: 404, message: 'Pattern not found'});
    }

    let imageBuffer = row.imageBlob ? Buffer.from(row.imageBlob) : null;
    if (!imageBuffer && typeof row.imageData === 'string' && row.imageData.startsWith('data:image/png;base64,')) {
      imageBuffer = Buffer.from(row.imageData.replace('data:image/png;base64,', ''), 'base64');
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
