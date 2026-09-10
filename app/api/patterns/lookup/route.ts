import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {mapPatternGeneratedToListDoc, PATTERN_LIST_SELECT} from '@/lib/db/patterns';
import {prisma} from '@/lib/db/prisma';

const MAX_LOOKUP_IDS = 200;

/** Returns list docs for explicit pattern_payload IDs (selection preview, detail). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIds = Array.isArray(body?.ids) ? (body.ids as unknown[]) : [];
    const ids: string[] = Array.from(
      new Set(
        rawIds
          .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
          .map((id) => id.trim()),
      ),
    ).slice(0, MAX_LOOKUP_IDS);

    if (ids.length === 0) {
      return apiSuccess([], {message: 'No ids provided'});
    }

    const rows = await prisma.patternGenerated.findMany({
      where: {patternPayload: {in: ids}},
      select: PATTERN_LIST_SELECT,
    });

    const byPayload = new Map(rows.map((row) => [row.patternPayload, row]));
    const ordered = ids
      .map((id) => byPayload.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => mapPatternGeneratedToListDoc(row));

    return apiSuccess(ordered, {message: 'Patterns retrieved successfully'});
  } catch (error) {
    console.error('Error looking up patterns:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
