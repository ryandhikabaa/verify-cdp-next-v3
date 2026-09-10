import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {
  buildPatternListWhere,
  loadPatternListPage,
  mapPatternGeneratedToListDoc,
  querySeedLengthPayloads,
} from '@/lib/db/patterns';
import {prisma} from '@/lib/db/prisma';
import {PatternListQuerySchema, CreatePatternSchema} from '@/lib/schemas';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;
const SORT_DIRECTIONS = new Set(['asc', 'desc']);

/** Server-side paginated pattern catalog. Images stay out of the list payload. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const validation = PatternListQuerySchema.safeParse({
      page: params.get('page') ?? undefined,
      pageSize: params.get('pageSize') ?? undefined,
      sort: params.get('sort') ?? undefined,
      search: params.get('search') ?? undefined,
      day: params.get('day') ?? undefined,
      seedLength: params.get('seedLength') ?? undefined,
      mode: params.get('mode') ?? undefined,
    });

    if (!validation.success) {
      return apiError({status: 400, message: validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')});
    }

    const {page, pageSize, sort, search, day, seedLength, mode} = validation.data;
    const pageSizeClamped = Math.min(pageSize, MAX_PAGE_SIZE);
    const sortDirection = sort === 'newest' ? 'desc' : sort === 'oldest' ? 'asc' : sort;
    const safeSearch = search || '';
    const safeDay = day || '';
    const safeSeedLength = seedLength || 0;

    if (mode === 'ids') {
      if (safeSeedLength > 0) {
        const {payloads, total} = await querySeedLengthPayloads({seedLength: safeSeedLength, search: safeSearch, day: safeDay, sort: sortDirection});
        const totalAll = await prisma.patternGenerated.count();
        return apiSuccess(
          {ids: payloads, total, totalAll},
          {message: 'Pattern ids retrieved successfully'},
        );
      }

      const where = buildPatternListWhere({search: safeSearch, day: safeDay});
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

    const {rows, total, totalAll} = await loadPatternListPage({seedLength: safeSeedLength, search: safeSearch, day: safeDay, sort: sortDirection, page, pageSize});

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
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError({status: 400, message: 'Body JSON tidak valid.'});
    }

    const validation = CreatePatternSchema.safeParse(body);
    if (!validation.success) {
      return apiError({status: 400, message: validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')});
    }

    const data = validation.data;
    const row = await prisma.patternGenerated.create({data: {
      qrPayload: data.qr_payload,
      qrHvalue: data.qr_hvalue,
      qrSecret1: data.qr_secret1,
      qrSecret2: data.qr_secret2,
      qrImage: data.qr_image,
      patternPayload: data.pattern_payload,
      imageData: data.image_data ?? null,
      density: Number(data.density ?? 0),
      size: data.size == null ? null : Number(data.size),
      style: data.style ?? null,
      layoutVersion: data.layout_version ?? 'v3-qr-pattern',
      qrWidthPx: data.qr_width_px ?? null,
      qrHeightPx: data.qr_height_px ?? null,
      patternWidthPx: data.pattern_width_px ?? null,
      patternHeightPx: data.pattern_height_px ?? null,
      gapPx: data.gap_px ?? null,
      canvasWidthPx: data.canvas_width_px ?? null,
      canvasHeightPx: data.canvas_height_px ?? null,
    }});
    return apiSuccess(mapPatternGeneratedToListDoc(row), {message: 'Pattern saved'});
  } catch (error) {
    console.error('Error saving pattern:', error);
    return apiError({status: 500, message: 'Gagal menyimpan pattern.'});
  }
}
