import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {prisma} from '@/lib/db/prisma';
import {writeDebugLog} from '@/lib/debug-log';
import {BatchPatternRequestSchema} from '@/lib/schemas';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError({status: 400, message: 'Body JSON tidak valid.'});
    }

    // Support both {docs: [...]} and {items: [...]} formats
    const rawDocs = (body as Record<string, unknown>)?.docs || (body as Record<string, unknown>)?.items;
    if (!Array.isArray(rawDocs) || rawDocs.length === 0) {
      return apiError({status: 400, message: 'Docs batch wajib diisi.'});
    }

    const validation = BatchPatternRequestSchema.safeParse({items: rawDocs});
    if (!validation.success) {
      return apiError({status: 400, message: validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')});
    }

    const docs = validation.data.items.map((doc) => ({
      qrPayload: doc.qr_payload, qrHvalue: doc.qr_hvalue,
      qrSecret1: doc.qr_secret1, qrSecret2: doc.qr_secret2, qrImage: doc.qr_image,
      patternPayload: doc.pattern_payload, imageData: doc.image_data ?? null,
      density: Number(doc.density ?? 0), size: doc.size == null ? null : Number(doc.size), style: doc.style ?? null,
      layoutVersion: doc.layout_version ?? 'v3-qr-pattern', qrWidthPx: doc.qr_width_px ?? null,
      qrHeightPx: doc.qr_height_px ?? null, patternWidthPx: doc.pattern_width_px ?? null,
      patternHeightPx: doc.pattern_height_px ?? null, gapPx: doc.gap_px ?? null,
      canvasWidthPx: doc.canvas_width_px ?? null, canvasHeightPx: doc.canvas_height_px ?? null,
    }));
    await writeDebugLog({
      event: 'batch-save',
      count: docs.length,
      docs: docs.map((doc: Record<string, unknown>) => ({
        qr_hvalue: doc.qrHvalue,
        qr_payload: doc.qrPayload,
        qr_secret1: doc.qrSecret1,
        qr_secret2: doc.qrSecret2,
        pattern_payload: doc.patternPayload,
      })),
    });
    // skipDuplicates keeps one already-stored pattern_payload from aborting the
    // whole batch (pattern_payload is unique); the client dedups seeds first, so
    // a dropped row means a genuine race with another save, not a silent bug.
    const inserted = await prisma.patternGenerated.createMany({data: docs, skipDuplicates: true});
    const skipped = docs.length - inserted.count;
    return apiSuccess(
      {count: inserted.count, skipped},
      {message: skipped > 0 ? `${inserted.count} pattern tersimpan, ${skipped} dilewati (sudah ada)` : 'Patterns saved'},
    );
  } catch (error) {
    console.error('Error saving batch:', error);
    return apiError({status: 500, message: 'Gagal menyimpan pattern batch.'});
  }
}
