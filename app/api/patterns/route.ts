import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {mapPatternGeneratedToListDoc} from '@/lib/db/patterns';
import {prisma} from '@/lib/db/prisma';


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

/** Stores a generated V3.1 pattern and its QR metadata in dotvera_v3. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ['qr_payload', 'qr_hvalue', 'qr_secret1', 'qr_secret2', 'qr_image', 'pattern_payload'];
    if (required.some((key) => typeof body?.[key] !== 'string' || !body[key].trim())) {
      return apiError({status: 400, message: 'Metadata QR dan payload pattern wajib diisi.'});
    }
    const row = await prisma.patternGenerated.create({data: {
      qrPayload: body.qr_payload,
      qrHvalue: body.qr_hvalue,
      qrSecret1: body.qr_secret1,
      qrSecret2: body.qr_secret2,
      qrImage: body.qr_image,
      patternPayload: body.pattern_payload,
      imageData: body.image_data ?? null,
      density: Number(body.density ?? 0),
      size: body.size == null ? null : Number(body.size),
      style: body.style ?? null,
      layoutVersion: body.layout_version ?? 'v3-qr-pattern',
      qrWidthPx: body.qr_width_px ?? null,
      qrHeightPx: body.qr_height_px ?? null,
      patternWidthPx: body.pattern_width_px ?? null,
      patternHeightPx: body.pattern_height_px ?? null,
      gapPx: body.gap_px ?? null,
      canvasWidthPx: body.canvas_width_px ?? null,
      canvasHeightPx: body.canvas_height_px ?? null,
    }});
    return apiSuccess(mapPatternGeneratedToListDoc(row), {message: 'Pattern saved'});
  } catch (error) {
    console.error('Error saving pattern:', error);
    return apiError({status: 500, message: 'Gagal menyimpan pattern.'});
  }
}
