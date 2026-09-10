import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {
  buildPatternListWhere,
  loadPatternListPage,
  mapPatternGeneratedToListDoc,
  querySeedLengthPayloads,
} from '@/lib/db/patterns';
import {prisma} from '@/lib/db/prisma';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;
const SORT_DIRECTIONS = new Set(['asc', 'desc']);

/** Server-side paginated pattern catalog. Images stay out of the list payload. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const pageSizeRaw = Number(params.get('pageSize'));
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.floor(pageSizeRaw), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
    const pageRaw = Number(params.get('page'));
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const sortDirection = SORT_DIRECTIONS.has(params.get('sort') ?? '') ? params.get('sort') as 'asc' | 'desc' : 'desc';
    const search = params.get('search') ?? '';
    const day = params.get('day') ?? '';
    const seedLength = Number(params.get('seedLength')) || 0;

    if (params.get('mode') === 'ids') {
      if (seedLength > 0) {
        const {payloads, total} = await querySeedLengthPayloads({seedLength, search, day, sort: sortDirection});
        const totalAll = await prisma.patternGenerated.count();
        return apiSuccess(
          {ids: payloads, total, totalAll},
          {message: 'Pattern ids retrieved successfully'},
        );
      }

      const where = buildPatternListWhere({search, day});
      const [idRows, idCount] = await prisma.$transaction([
        prisma.patternGenerated.findMany({
          where,
          select: {patternPayload: true},
          orderBy: [{createAt: sortDirection}, {patternPayload: 'asc'}],
        }),
        prisma.patternGenerated.count(),
      ]);
      return apiSuccess(
        {ids: idRows.map((row) => row.patternPayload), total: idRows.length, totalAll: idCount},
        {message: 'Pattern ids retrieved successfully'},
      );
    }

    const {rows, total, totalAll} = await loadPatternListPage({seedLength, search, day, sort: sortDirection, page, pageSize});

    return apiSuccess(
      {
        items: rows.map((row) => mapPatternGeneratedToListDoc(row)),
        total,
        totalAll,
        page,
        pageSize,
      },
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
