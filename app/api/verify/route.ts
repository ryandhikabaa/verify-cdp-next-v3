import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {decryptPayloadToSeed} from '@/lib/cdp';
import {prisma} from '@/lib/db/prisma';
import {resolveMaxScanLimit} from '@/lib/db/settings';
import {buildSharedTrackingNotes, resolveSharedVerifyStatus} from '@/lib/verifier-core';

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

/** Records a scan whose QR was read but the pattern could not be decoded within the window. */
async function recordTimeoutVerification(input: {
  deviceID: string;
  imageData: string | null;
  latitude: number | null;
  longitude: number | null;
  submittedQrPayload: string;
  submittedQrHvalue: string;
  submittedQrSecret1: string;
  submittedQrSecret2: string;
  createdAt: string | null;
  updatedAt: string | null;
}) {
  const {
    deviceID,
    imageData,
    latitude,
    longitude,
    submittedQrPayload,
    submittedQrHvalue,
    submittedQrSecret1,
    submittedQrSecret2,
    createdAt,
    updatedAt,
  } = input;

  console.info('[api/verify] Timeout / pattern-unreadable scan', {
    deviceID,
    hasImageData: Boolean(imageData),
    imageDataLength: imageData?.length ?? 0,
    latitude,
    longitude,
    submittedQrPayload,
    submittedQrHvalue,
    submittedQrSecret1,
    submittedQrSecret2,
    createdAt,
    updatedAt,
  });

  const notes = 'Pola tidak terbaca atau gagal dideteksi; produk tidak dapat dipastikan keasliannya.';

  try {
    const verification = await prisma.patternDetection.create({
      data: {
        deviceID,
        status: 'COUNTERFEIT',
        notes,
        imageData,
        latitude,
        longitude,
        qrPayload: submittedQrPayload || null,
        qrHvalue: submittedQrHvalue || null,
        qrSecret1: submittedQrSecret1 || null,
        qrSecret2: submittedQrSecret2 || null,
        patternPayload: null,
        patternDecodePayload: null,
        createdAt: createdAt ? new Date(createdAt) : undefined,
        updatedAt: updatedAt ? new Date(updatedAt) : undefined,
      },
    });

    console.info('[api/verify] Timeout verification saved', {
      verificationId: verification.id,
      deviceID: verification.deviceID,
      status: verification.status,
      notes: verification.notes,
    });

    return apiSuccess(
      {
        status_result: verification.status,
        notes: verification.notes,
      },
      {
        status: 201,
        message: 'Hasil verifikasi belum dapat dikonfirmasi sebagai terdaftar.',
      },
    );
  } catch (error) {
    console.error('[api/verify] Error recording timeout verification', {
      deviceID,
      error,
    });
    return apiError({status: 500, message: 'Internal Server Error'});
  }
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
  const layoutVersion = sanitizeText(body.layout_version, 50);
  const leftPatternDecodePayload = sanitizeText(body.left_pattern_decode_payload, 12).toUpperCase();
  const rightPatternDecodePayload = sanitizeText(body.right_pattern_decode_payload, 12).toUpperCase();
  const rawPayloadText = sanitizeText(body.raw_payload_text, LABEL_MAX_LENGTH);
  const submittedQrPayload = sanitizeText(body.qr_payload, LABEL_MAX_LENGTH);
  const submittedQrHvalue = sanitizeText(body.qr_hvalue, 7);
  const submittedQrSecret1 = sanitizeText(body.qr_secret1, LABEL_MAX_LENGTH);
  const submittedQrSecret2 = sanitizeText(body.qr_secret2, LABEL_MAX_LENGTH);
  const patternDecodePayload = sanitizeText(body.pattern_decode_payload, LABEL_MAX_LENGTH);
  const scanOutcome = sanitizeText(body.scan_outcome, 50).toLowerCase();
  const createdAt = normalizeTimestamp(body.created_at);
  const updatedAt = normalizeTimestamp(body.updated_at);

  if (!deviceID) {
    return apiError({
      status: 400,
      message: 'Field deviceID wajib diisi.',
    });
  }

  // Timeout / pattern-unreadable scan: QR was detected but the right-hand pattern
  // could not be decoded within the window. Recorded as COUNTERFEIT with a distinct
  // note; no pattern_generated row is resolved, so no per-product counters increment.
  const isPatternTimeout = scanOutcome === 'timeout' || scanOutcome === 'pattern_failed';

  if (!patternDecodePayload && !isPatternTimeout) {
    return apiError({status: 400, message: 'Payload hasil decode pattern wajib tersedia.'});
  }

  if (isPatternTimeout) {
    return await recordTimeoutVerification({
      deviceID,
      imageData,
      latitude,
      longitude,
      submittedQrPayload,
      submittedQrHvalue,
      submittedQrSecret1,
      submittedQrSecret2,
      createdAt,
      updatedAt,
    });
  }

  if (!checksumValid) {
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
    deviceID,
    hasImageData: Boolean(imageData),
    imageDataLength: imageData?.length ?? 0,
    latitude,
    longitude,
    decryptSucceeded,
    checksumValid,
    payloadMode,
    layoutVersion,
    leftPatternDecodePayload: leftPatternDecodePayload || null,
    rightPatternDecodePayload: rightPatternDecodePayload || null,
    rawPayloadText,
    submittedQrPayload,
    submittedQrHvalue,
    submittedQrSecret1,
    submittedQrSecret2,
    patternDecodePayload,
    createdAt,
    updatedAt,
  });

  try {
    const [pattern, maxScanLimit] = await Promise.all([
      prisma.patternGenerated.findUnique({
        where: {patternPayload: incomingId},
      }),
      resolveMaxScanLimit(),
    ]);
    // A matched payload that has already been scanned max_scan (or more) times is
    // treated as COUNTERFEIT: the scan exceeds the permitted limit.
    // A limit of `0` disables the cap entirely (unlimited scans).
    const exceedsMaxScan = Boolean(pattern) && maxScanLimit > 0 && pattern!.scannedCount >= maxScanLimit;
    // V3 and v2.1 resolve status directly from the pattern_payload lookup; the shared
    // helper's payloadMode type only covers the legacy/encrypted tracking path.
    const isStructuredLayout = isThreePartV21 || isV3QrPattern;
    const finalStatus = exceedsMaxScan
      ? 'COUNTERFEIT'
      : isStructuredLayout
        ? (pattern ? 'AUTHENTIC' : 'COUNTERFEIT')
        : resolveSharedVerifyStatus({
            patternFound: Boolean(pattern),
            payloadMode: payloadMode === 'three-part' ? 'unknown' : payloadMode,
            decryptSucceeded,
            checksumValid,
            rawPayloadText,
          });
    const notes = exceedsMaxScan
      ? 'Produk telah melewati batas maksimum scan yang diizinkan.'
      : isStructuredLayout
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
      matchedPatternPayload: pattern?.patternPayload ?? null,
      exceedsMaxScan,
      maxScanLimit,
      currentScannedCount: pattern?.scannedCount ?? null,
      finalStatus,
      decryptSucceeded,
      checksumValid,
      payloadMode,
      layoutVersion,
      rawPayloadText,
      notes,
    });

    const verification = await prisma.$transaction(async (tx) => {
      const created = await tx.patternDetection.create({
        data: {
          deviceID,
          status: finalStatus,
          notes,
          imageData,
          latitude,
          longitude,
          qrPayload: submittedQrPayload || (pattern?.qrPayload ?? null),
          qrHvalue: submittedQrHvalue || (pattern?.qrHvalue ?? null),
          qrSecret1: submittedQrSecret1 || (pattern?.qrSecret1 ?? null),
          qrSecret2: submittedQrSecret2 || (pattern?.qrSecret2 ?? null),
          patternPayload: incomingId.length <= 24 ? incomingId : null,
          patternDecodePayload: patternDecodePayload || rawPayloadText || null,
          createdAt: createdAt ? new Date(createdAt) : undefined,
          updatedAt: updatedAt ? new Date(updatedAt) : undefined,
        },
      });

      if (pattern) {
        await tx.patternGenerated.update({
          where: {id: pattern.id},
          data: {
            scannedCount: {increment: 1},
            ...(finalStatus === 'AUTHENTIC' ? {authenticCount: {increment: 1}} : {}),
            ...(finalStatus === 'COUNTERFEIT' ? {counterfeitCount: {increment: 1}} : {}),
            updateAt: new Date(),
          },
        });
      }

      return created;
    });

    console.info('[api/verify] Verification saved', {
      verificationId: verification.id,
      deviceID: verification.deviceID,
      status: verification.status,
      notes: verification.notes,
      storedImageDataLength: verification.imageData?.length ?? 0,
      latitude: verification.latitude,
      longitude: verification.longitude,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
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