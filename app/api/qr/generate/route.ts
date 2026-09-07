import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {
  QR_GENERATE_ERROR_MESSAGES,
  QrGenerateError,
  parseQrGenerateRequestBody,
  requestQrGenerateFromUpstream,
} from '@/lib/cdp/qr-generate';
import {getQrGenerateApiUrl} from '@/lib/db/env';
import {prisma} from '@/lib/db/prisma';
import {writeDebugLog} from '@/lib/debug-log';

/** Max re-fetches when the upstream returns a QR that already exists in the DB. */
const QR_DEDUP_MAX_RETRIES = 5;

/** A QR is considered a duplicate when any of its identity fields already exists. */
async function qrAlreadyExists(data: {
  qr_payload: string;
  qr_secret1: string;
  qr_secret2: string;
}): Promise<boolean> {
  const existing = await prisma.patternGenerated.findFirst({
    where: {
      OR: [
        {qrPayload: data.qr_payload},
        {qrSecret1: data.qr_secret1},
        {qrSecret2: data.qr_secret2},
      ],
    },
    select: {id: true},
  });
  return existing != null;
}

function qrGenerateErrorResponse(error: unknown) {
  if (error instanceof QrGenerateError) {
    console.error('[qr/generate]', {
      code: error.code,
      status: error.status,
      upstreamStatus: error.upstreamStatus,
      cause: error.causeMessage,
    });
    return apiError({
      status: error.status,
      message: error.message,
      data: {
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && error.causeMessage ? {cause: error.causeMessage} : {}),
        ...(error.upstreamStatus == null ? {} : {upstream_status: error.upstreamStatus}),
      },
    });
  }
  return apiError({status: 502, message: QR_GENERATE_ERROR_MESSAGES.network});
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError({status: 400, message: QR_GENERATE_ERROR_MESSAGES.invalidJson});
  }

  try {
    const {hvalue} = parseQrGenerateRequestBody(body);
    const requestId = crypto.randomUUID();
    await writeDebugLog({event: 'qr-generate-request', requestId, sent: {hvalue}, url: getQrGenerateApiUrl()});

    // Fetch the QR and, when the upstream returns an identity that already exists
    // in the database, re-fetch (up to QR_DEDUP_MAX_RETRIES) until a fresh one is
    // returned. Duplicates never fail the request; they only trigger a retry.
    let data;
    let duplicate = false;
    let attempts = 0;
    do {
      attempts += 1;
      data = await requestQrGenerateFromUpstream({
        hvalue,
        url: getQrGenerateApiUrl(),
        onRawResponse: async (raw) => {
          await writeDebugLog({
            event: 'qr-generate-upstream-raw',
            requestId,
            url: getQrGenerateApiUrl(),
            sent: {hvalue},
            httpStatus: raw.httpStatus,
            rawBody: raw.rawBody,
          });
        },
      });
      duplicate = await qrAlreadyExists({
        qr_payload: data.qr_payload,
        qr_secret1: data.qr_secret1,
        qr_secret2: data.qr_secret2,
      });
      if (duplicate) {
        await writeDebugLog({
          event: 'qr-generate-duplicate',
          requestId,
          attempt: attempts,
          duplicateOf: {
            qr_payload: data.qr_payload,
            qr_secret1: data.qr_secret1,
            qr_secret2: data.qr_secret2,
          },
        });
      }
    } while (duplicate && attempts < QR_DEDUP_MAX_RETRIES);

    await writeDebugLog({
      event: 'qr-generate-response',
      requestId,
      attempts,
      resolvedDuplicateAfterRetries: attempts > 1,
      received: {
        qr_payload: data.qr_payload,
        qr_hvalue: data.qr_hvalue,
        qr_secret1: data.qr_secret1,
        qr_secret2: data.qr_secret2,
        qr_image_bytes: data.qr_image?.length ?? 0,
      },
    });
    return apiSuccess(data, {message: 'QR berhasil diperoleh dari QR API.'});
  } catch (error) {
    await writeDebugLog({event: 'qr-generate-error', sent: (body as Record<string, unknown>)?.hvalue, error: error instanceof Error ? error.message : String(error)});
    return qrGenerateErrorResponse(error);
  }
}