import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {decryptPayloadToSeed} from '@/lib/cdp';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {buildSharedTrackingNotes, resolveSharedVerifyStatus} from '@/lib/verifier-core';
import type {VerifyStatus} from '@/lib/types';

type VerificationInsertRow = {
  id: string;
  label: string;
  deviceID: string;
  status: VerifyStatus;
  notes: string | null;
  image_data: string | null;
  latitude: number | null;
  longitude: number | null;
  qr_value: string | null;
  qr_format: string | null;
  qr_detected: boolean;
  qr_bounds: Record<string, unknown> | null;
  pattern_crop_bounds: Record<string, unknown> | null;
  pattern_decode_payload: string | null;
  payload_mode: 'legacy' | 'encrypted' | 'three-part' | 'unknown' | null;
  decrypt_succeeded: boolean | null;
  checksum_valid: boolean | null;
  created_at: Date | string;
  updated_at: Date | string;
};

const MAX_IMAGE_DATA_LENGTH = 5_000_000;
const DEVICE_ID_MAX_LENGTH = 255;
const LABEL_MAX_LENGTH = 255;
const THREE_PART_V21_LAYOUT = 'three-part-v2.1';
const V3_QR_PATTERN_LAYOUT = 'v3-qr-pattern';
const CDP_PAYLOAD_CHUNK_PATTERN = /^[A-Z0-9]{12}$/;
function normalizeTimestamp(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function isValidImageData(value: string) {
  return value.startsWith('data:image/') && value.length <= MAX_IMAGE_DATA_LENGTH;
}

function isValidCoordinate(value: number | null, min: number, max: number) {
  return value == null || (Number.isFinite(value) && value >= min && value <= max);
}

function sanitizeJsonObject(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Accepts public verification submissions from mobile clients and stores the resulting verification log. */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return apiError({status: 400, message: 'Request body harus berupa JSON yang valid.'});
  }

  const submittedId = sanitizeText(body.id, LABEL_MAX_LENGTH);
  const deviceID = sanitizeText(body.deviceID, DEVICE_ID_MAX_LENGTH);
  const imageData = typeof body.image_data === 'string' ? body.image_data.trim() : null;
  const latitude = typeof body.latitude === 'number' && Number.isFinite(body.latitude) ? body.latitude : null;
  const longitude = typeof body.longitude === 'number' && Number.isFinite(body.longitude) ? body.longitude : null;
  const checksumValid = body.checksum_valid !== false;
  const submittedPayloadMode = body.payload_mode === 'encrypted' || body.payload_mode === 'legacy' || body.payload_mode === 'three-part' ? body.payload_mode : 'unknown';
  const layoutVersion = sanitizeText(body.layout_version, 50);
  const leftPatternDecodePayload = sanitizeText(body.left_pattern_decode_payload, 12).toUpperCase();
  const rightPatternDecodePayload = sanitizeText(body.right_pattern_decode_payload, 12).toUpperCase();
  const rawPayloadText = sanitizeText(body.raw_payload_text, LABEL_MAX_LENGTH);
  const qrValue = sanitizeText(body.qr_value, LABEL_MAX_LENGTH);
  const qrFormat = sanitizeText(body.qr_format, 50);
  const qrDetected = body.qr_detected === true;
  const qrBounds = sanitizeJsonObject(body.qr_bounds);
  const patternCropBounds = sanitizeJsonObject(body.pattern_crop_bounds);
  const patternDecodePayload = sanitizeText(body.pattern_decode_payload, LABEL_MAX_LENGTH);
  const createdAt = normalizeTimestamp(body.created_at);
  const updatedAt = normalizeTimestamp(body.updated_at);

  if (!deviceID) {
    return apiError({
      status: 400,
      message: 'Field deviceID wajib diisi.',
    });
  }

  if (!patternDecodePayload || !checksumValid) {
    return apiError({status: 400, message: 'Payload hasil decode pattern dan checksum valid wajib tersedia.'});
  }

  const isThreePartV21 = layoutVersion === THREE_PART_V21_LAYOUT;
  const isV3QrPattern = layoutVersion === V3_QR_PATTERN_LAYOUT;
  let incomingId: string;
  let decryptSucceeded: boolean;
  let payloadMode: 'legacy' | 'encrypted' | 'three-part' | 'unknown';

  if (isV3QrPattern) {
    // V3 payload validation already happened end-to-end on the client through
    // the matrix codec (version byte, alphabet, length, CRC-16, Reed–Solomon).
    // The server only performs consistent structural checks before lookup.
    const v3Payload = patternDecodePayload;
    if (!v3Payload || v3Payload.length > 24 || !/^[A-Za-z0-9_-]{1,24}$/.test(v3Payload)) {
      return apiError({status: 400, message: 'Payload V3 harus 1-24 karakter A-Z, a-z, 0-9, tanda hubung, atau garis bawah.'});
    }
    incomingId = v3Payload;
    decryptSucceeded = false;
    payloadMode = 'three-part';
  } else if (isThreePartV21) {
    if (!CDP_PAYLOAD_CHUNK_PATTERN.test(leftPatternDecodePayload) || !CDP_PAYLOAD_CHUNK_PATTERN.test(rightPatternDecodePayload)) {
      return apiError({status: 400, message: 'Payload CDP kiri dan kanan harus masing-masing 12 karakter A-Z atau 0-9.'});
    }

    incomingId = `${leftPatternDecodePayload}${rightPatternDecodePayload}`;
    if (patternDecodePayload !== incomingId) {
      return apiError({status: 400, message: 'Payload gabungan tidak sesuai dengan payload CDP kiri dan kanan.'});
    }
    decryptSucceeded = false;
    payloadMode = 'three-part';
  } else {
    try {
      incomingId = await decryptPayloadToSeed(patternDecodePayload);
    } catch {
      return apiError({status: 400, message: 'Payload pattern tidak valid atau gagal didekripsi oleh server.'});
    }
    decryptSucceeded = true;
    payloadMode = 'encrypted';
  }

  const label = incomingId;

  if (typeof body.image_data !== 'undefined' && imageData === null) {
    return apiError({status: 400, message: 'Field image_data harus berupa string base64.'});
  }

  if (imageData && !isValidImageData(imageData)) {
    return apiError({status: 413, message: 'Field image_data tidak valid atau ukurannya melebihi batas maksimum.'});
  }

  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    return apiError({status: 400, message: 'Koordinat latitude atau longitude tidak valid.'});
  }

  console.info('[api/verify] Incoming request', {
    incomingId,
    submittedId,
    label,
    deviceID,
    hasImageData: Boolean(imageData),
    imageDataLength: imageData?.length ?? 0,
    latitude,
    longitude,
    decryptSucceeded,
    checksumValid,
    payloadMode,
    submittedPayloadMode,
    layoutVersion,
    leftPatternDecodePayload: leftPatternDecodePayload || null,
    rightPatternDecodePayload: rightPatternDecodePayload || null,
    rawPayloadText,
    qrValue,
    qrFormat,
    qrDetected,
    qrBounds,
    patternCropBounds,
    patternDecodePayload,
    createdAt,
    updatedAt,
  });

  try {
    await ensureDotveraSchema();

    const patternResult = await getDotveraPool().query<{id: string; serial: string}>(
      'SELECT id, serial FROM pattern_generated_v21 WHERE serial = $1 LIMIT 1',
      [incomingId],
    );

    const pattern = patternResult.rows[0] ?? null;
    // V3 and v2.1 resolve status directly from the serial lookup; the shared
    // helper's payloadMode type only covers the legacy/encrypted tracking path.
    const isStructuredLayout = isThreePartV21 || isV3QrPattern;
    const finalStatus = isStructuredLayout
      ? (pattern ? 'AUTHENTIC' : 'COUNTERFEIT')
      : resolveSharedVerifyStatus({
          patternFound: Boolean(pattern),
          payloadMode: payloadMode === 'three-part' ? 'unknown' : payloadMode,
          decryptSucceeded,
          checksumValid,
          rawPayloadText,
        });
    const notes = isStructuredLayout
      ? pattern
        ? 'Produk berhasil diverifikasi dan dinyatakan autentik.'
        : 'Keaslian produk tidak dapat dikonfirmasi.'
      : buildSharedTrackingNotes({
          patternFound: Boolean(pattern),
          decryptSucceeded,
          checksumValid,
          payloadMode: payloadMode === 'three-part' ? 'unknown' : payloadMode,
          rawPayloadText,
        });

    console.info('[api/verify] Pattern lookup result', {
      incomingId,
      patternFound: Boolean(pattern),
      matchedPatternId: pattern?.id ?? null,
      matchedSerial: pattern?.serial ?? null,
      finalStatus,
      decryptSucceeded,
      checksumValid,
      payloadMode,
      submittedPayloadMode,
      layoutVersion,
      rawPayloadText,
      notes,
    });

    const insertResult = await getDotveraPool().query<VerificationInsertRow>(
      `INSERT INTO pattern_detection (
         label, "deviceID", status, notes, image_data, latitude, longitude,
         qr_value, qr_format, qr_detected, qr_bounds, pattern_crop_bounds,
         pattern_decode_payload, payload_mode, decrypt_succeeded, checksum_valid,
         created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10, $11::jsonb, $12::jsonb,
         $13, $14, $15, $16,
         COALESCE($17::timestamptz, CURRENT_TIMESTAMP), COALESCE($18::timestamptz, CURRENT_TIMESTAMP)
       )
       RETURNING id, label, "deviceID", status, notes, image_data, latitude, longitude,
                 qr_value, qr_format, qr_detected, qr_bounds, pattern_crop_bounds,
                 pattern_decode_payload, payload_mode, decrypt_succeeded, checksum_valid,
                 created_at, updated_at`,
      [
        label || incomingId,
        deviceID,
        finalStatus,
        notes,
        imageData,
        latitude,
        longitude,
        qrValue || null,
        qrFormat || null,
        qrDetected,
        qrBounds ? JSON.stringify(qrBounds) : null,
        patternCropBounds ? JSON.stringify(patternCropBounds) : null,
        patternDecodePayload || rawPayloadText || null,
        payloadMode,
        decryptSucceeded,
        checksumValid,
        createdAt,
        updatedAt,
      ],
    );

    const verification = insertResult.rows[0];

    console.info('[api/verify] Verification saved', {
      verificationId: verification.id,
      label: verification.label,
      deviceID: verification.deviceID,
      status: verification.status,
      notes: verification.notes,
      storedImageDataLength: verification.image_data?.length ?? 0,
      latitude: verification.latitude,
      longitude: verification.longitude,
      createdAt: verification.created_at,
      updatedAt: verification.updated_at,
    });

    return apiSuccess(
      {
        status_result: verification.status,
        notes: verification.notes,
      },
      {
        status: 201,
        message: pattern ? 'Hasil verifikasi berhasil diproses.' : 'Hasil verifikasi belum dapat dikonfirmasi sebagai terdaftar.',
      },
    );
  } catch (error) {
    console.error('[api/verify] Error recording verification', {
      incomingId,
      label,
      deviceID,
      hasImageData: Boolean(imageData),
      imageDataLength: imageData?.length ?? 0,
      latitude,
      longitude,
      createdAt,
      updatedAt,
      error,
    });
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}