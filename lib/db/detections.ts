import type {PatternDetection, Prisma} from '@prisma/client';
import {detectVerificationSource} from '@/lib/cdp/verification-source';

export function buildDetectionListWhere(input: {
  search?: string;
  status?: string;
  source?: string;
}): Prisma.PatternDetectionWhereInput {
  const and: Prisma.PatternDetectionWhereInput[] = [];
  const search = input.search?.trim() ?? '';
  const status = input.status?.trim().toUpperCase() ?? 'ALL';
  const source = input.source?.trim().toUpperCase() ?? 'ALL';

  if (search) {
    and.push({
      OR: [
        {label: {contains: search, mode: 'insensitive'}},
        {deviceID: {contains: search, mode: 'insensitive'}},
      ],
    });
  }

  if (status && status !== 'ALL') {
    and.push({status});
  }

  if (source === 'WEB') {
    and.push({deviceID: {startsWith: 'WEB-', mode: 'insensitive'}});
  } else if (source === 'MOBILE') {
    and.push({NOT: {deviceID: {startsWith: 'WEB-', mode: 'insensitive'}}});
  }

  return and.length > 0 ? {AND: and} : {};
}

export function mapDetectionSource(deviceID: string) {
  return detectVerificationSource(deviceID);
}

export function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapHistoryRow(row: PatternDetection) {
  return {
    id: row.id,
    label: row.label,
    deviceID: row.deviceID,
    source: mapDetectionSource(row.deviceID),
    status: row.status,
    notes: row.notes,
    imageData: row.imageData,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    patternDecodePayload: row.patternDecodePayload,
  };
}

/** Public verify-history JSON. QR secrets stay off this payload. */
export function mapDetectionToPublicHistoryItem(row: PatternDetection) {
  return {
    id: row.id,
    label: row.label,
    deviceID: row.deviceID,
    source: mapDetectionSource(row.deviceID),
    status_result: row.status,
    notes: row.notes,
    image_data: row.imageData,
    latitude: row.latitude,
    longitude: row.longitude,
    qr_value: row.qrValue,
    qr_format: row.qrFormat,
    qr_detected: row.qrDetected,
    qr_bounds: row.qrBounds,
    pattern_crop_bounds: row.patternCropBounds,
    pattern_decode_payload: row.patternDecodePayload,
    payload_mode: row.payloadMode,
    decrypt_succeeded: row.decryptSucceeded,
    checksum_valid: row.checksumValid,
    created_at: toIso(row.createdAt) ?? new Date(0).toISOString(),
    updated_at: toIso(row.updatedAt) ?? new Date(0).toISOString(),
  };
}
