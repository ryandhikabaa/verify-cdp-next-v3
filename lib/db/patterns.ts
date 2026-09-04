import type {PatternGenerated} from '@prisma/client';
import type {PatternDoc} from '@/lib/types';

export type PatternListDoc = PatternDoc & {
  record_id: string;
};

export function mapPatternGeneratedToListDoc(row: PatternGenerated): PatternListDoc {
  return {
    id: row.patternPayload,
    record_id: row.id,
    label: row.patternPayload,
    density: row.density,
    size: row.size ?? undefined,
    style: row.style ?? undefined,
    payload: row.patternPayload,
    payload_1: row.patternPayload,
    payload_qr: row.qrPayload,
    qr_payload: row.qrPayload,
    pattern_payload: row.patternPayload,
    layout_version: row.layoutVersion,
    qr_width_px: row.qrWidthPx ?? undefined,
    qr_height_px: row.qrHeightPx ?? undefined,
    pattern_width_px: row.patternWidthPx ?? undefined,
    pattern_height_px: row.patternHeightPx ?? undefined,
    gap_px: row.gapPx ?? undefined,
    canvas_width_px: row.canvasWidthPx ?? undefined,
    canvas_height_px: row.canvasHeightPx ?? undefined,
    scanned_count: row.scannedCount,
    authentic_count: row.authenticCount,
    counterfeit_count: row.counterfeitCount,
    image_data: row.imageData ?? undefined,
    created_at: row.createAt.toISOString(),
    updated_at: row.updateAt.toISOString(),
  };
}

export function mapPatternGeneratedToDetailDoc(row: PatternGenerated): PatternListDoc & {
  qr_hvalue: string;
  qr_secret1: string;
  qr_secret2: string;
  qr_image: string;
} {
  return {
    ...mapPatternGeneratedToListDoc(row),
    qr_hvalue: row.qrHvalue,
    qr_secret1: row.qrSecret1,
    qr_secret2: row.qrSecret2,
    qr_image: row.qrImage,
  };
}
