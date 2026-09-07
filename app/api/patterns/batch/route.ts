import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {prisma} from '@/lib/db/prisma';
import {writeDebugLog} from '@/lib/debug-log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!Array.isArray(body?.docs) || body.docs.length === 0) return apiError({status: 400, message: 'Docs batch wajib diisi.'});
    const docs = body.docs.map((doc: Record<string, unknown>) => ({
      qrPayload: String(doc.qr_payload ?? ''), qrHvalue: String(doc.qr_hvalue ?? ''),
      qrSecret1: String(doc.qr_secret1 ?? ''), qrSecret2: String(doc.qr_secret2 ?? ''), qrImage: String(doc.qr_image ?? ''),
      patternPayload: String(doc.pattern_payload ?? ''), imageData: (doc.image_data as string) ?? null,
      density: Number(doc.density ?? 0), size: doc.size == null ? null : Number(doc.size), style: (doc.style as string) ?? null,
      layoutVersion: String(doc.layout_version ?? 'v3-qr-pattern'), qrWidthPx: (doc.qr_width_px as number) ?? null,
      qrHeightPx: (doc.qr_height_px as number) ?? null, patternWidthPx: (doc.pattern_width_px as number) ?? null,
      patternHeightPx: (doc.pattern_height_px as number) ?? null, gapPx: (doc.gap_px as number) ?? null,
      canvasWidthPx: (doc.canvas_width_px as number) ?? null, canvasHeightPx: (doc.canvas_height_px as number) ?? null,
    }));
    if (docs.some((doc: Record<string, unknown>) => Object.values(doc).slice(0, 7).some((value) => value === ''))) return apiError({status: 400, message: 'Metadata QR dan payload pattern wajib diisi.'});
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
    await prisma.patternGenerated.createMany({data: docs});
    return apiSuccess({count: docs.length}, {message: 'Patterns saved'});
  } catch (error) {
    console.error('Error saving batch:', error);
    return apiError({status: 500, message: 'Gagal menyimpan pattern batch.'});
  }
}
