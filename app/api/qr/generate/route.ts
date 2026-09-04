import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {
  QR_GENERATE_ERROR_MESSAGES,
  QrGenerateError,
  parseQrGenerateRequestBody,
  requestQrGenerateFromUpstream,
} from '@/lib/cdp/qr-generate';
import {getQrGenerateApiUrl} from '@/lib/db/env';

function qrGenerateErrorResponse(error: unknown) {
  if (error instanceof QrGenerateError) {
    return apiError({
      status: error.status,
      message: error.message,
      data: error.upstreamStatus == null ? null : {upstream_status: error.upstreamStatus},
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
    const data = await requestQrGenerateFromUpstream({
      hvalue,
      url: getQrGenerateApiUrl(),
    });
    return apiSuccess(data, {message: 'QR berhasil diperoleh dari QR API.'});
  } catch (error) {
    return qrGenerateErrorResponse(error);
  }
}