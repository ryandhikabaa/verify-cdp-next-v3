import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {isPrismaNotFound} from '@/lib/db/prisma-errors';
import {mapPatternGeneratedToListDoc} from '@/lib/db/patterns';
import {prisma} from '@/lib/db/prisma';

/** Deletes a single stored pattern by pattern_payload. */
export async function DELETE(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  try {
    const row = await prisma.patternGenerated.delete({
      where: {patternPayload: id},
    });
    return apiSuccess({
      deleted: mapPatternGeneratedToListDoc(row),
    }, {message: 'Pattern deleted'});
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return apiError({status: 404, message: 'Pattern not found'});
    }
    console.error('Error deleting pattern:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
