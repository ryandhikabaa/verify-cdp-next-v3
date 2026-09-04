import {LOCKED_QR_GENERATE_API_URL} from '@/lib/db/env';
import {HvalueValidationError, validateHvalue} from '@/lib/cdp/hvalue';

export const QR_GENERATE_TIMEOUT_MS = 15_000;
export const QR_GENERATE_LOCKED_URL = LOCKED_QR_GENERATE_API_URL;

export const QR_GENERATE_ERROR_MESSAGES = {
  invalidJson: 'Request body harus berupa JSON yang valid.',
  malformed: 'Respon QR tidak valid. Proses dihentikan.',
  network: 'Gagal menghubungi layanan QR. Proses dihentikan.',
  timeout: 'Gagal menghubungi layanan QR. Proses dihentikan.',
} as const;

export type QrGenerateSuccess = {
  qr_payload: string;
  qr_hvalue: string;
  qr_secret1: string;
  qr_secret2: string;
  qr_image: string;
};

export class QrGenerateError extends Error {
  readonly status: number;
  readonly code: 'validation' | 'upstream_http' | 'timeout' | 'malformed' | 'network';
  readonly upstreamStatus?: number;

  constructor(options: {
    message: string;
    status: number;
    code: QrGenerateError['code'];
    upstreamStatus?: number;
  }) {
    super(options.message);
    this.name = 'QrGenerateError';
    this.status = options.status;
    this.code = options.code;
    this.upstreamStatus = options.upstreamStatus;
  }
}

export function qrGenerateHttpErrorMessage(status: number) {
  return `Gagal generate QR (HTTP ${status}). Proses dihentikan.`;
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  return name === 'AbortError';
}

function readNonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeQrImage(imgOutput: string) {
  const trimmed = imgOutput.trim();
  if (trimmed.startsWith('data:image/') && trimmed.includes(';base64,')) {
    return trimmed;
  }
  return `data:image/png;base64,${trimmed}`;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function parseQrGenerateRequestBody(body: unknown) {
  const record = readRecord(body);
  try {
    return {hvalue: validateHvalue(record?.hvalue)};
  } catch (error) {
    if (error instanceof HvalueValidationError) {
      throw new QrGenerateError({
        message: error.message,
        status: 400,
        code: 'validation',
      });
    }
    throw error;
  }
}

export function parseQrGenerateUpstreamBody(payload: unknown): QrGenerateSuccess {
  const root = readRecord(payload);
  if (!root) {
    throw new QrGenerateError({
      message: QR_GENERATE_ERROR_MESSAGES.malformed,
      status: 502,
      code: 'malformed',
    });
  }

  if ('status' in root && root.status !== 'success') {
    throw new QrGenerateError({
      message: QR_GENERATE_ERROR_MESSAGES.malformed,
      status: 502,
      code: 'malformed',
    });
  }

  const data = Array.isArray(root.data) ? root.data : null;
  const first = data && data.length > 0 ? readRecord(data[0]) : null;
  const qrcode = readNonEmptyString(first?.qrcode);
  const hvalue = readNonEmptyString(first?.hvalue);
  const secret1 = readNonEmptyString(first?.secret1);
  const secret2 = readNonEmptyString(first?.secret2);
  const imgOutput = readNonEmptyString(first?.imgOutput);

  if (!first || !qrcode || !hvalue || !secret1 || !secret2 || !imgOutput) {
    throw new QrGenerateError({
      message: QR_GENERATE_ERROR_MESSAGES.malformed,
      status: 502,
      code: 'malformed',
    });
  }

  return {
    qr_payload: qrcode,
    qr_hvalue: hvalue,
    qr_secret1: secret1,
    qr_secret2: secret2,
    qr_image: normalizeQrImage(imgOutput),
  };
}

export function resolveLockedQrGenerateApiUrl(configuredUrl: string) {
  if (configuredUrl !== QR_GENERATE_LOCKED_URL) {
    throw new QrGenerateError({
      message: QR_GENERATE_ERROR_MESSAGES.network,
      status: 500,
      code: 'network',
    });
  }
  return configuredUrl;
}

export async function requestQrGenerateFromUpstream(options: {
  hvalue: string;
  url: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<QrGenerateSuccess> {
  const url = resolveLockedQrGenerateApiUrl(options.url);
  const timeoutMs = options.timeoutMs ?? QR_GENERATE_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {'content-type': 'application/json', accept: 'application/json'},
      body: JSON.stringify({hvalue: options.hvalue}),
      signal: controller.signal,
      cache: 'no-store',
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (!response.ok) {
        throw new QrGenerateError({
          message: qrGenerateHttpErrorMessage(response.status),
          status: 502,
          code: 'upstream_http',
          upstreamStatus: response.status,
        });
      }
      throw new QrGenerateError({
        message: QR_GENERATE_ERROR_MESSAGES.malformed,
        status: 502,
        code: 'malformed',
      });
    }

    if (response.status !== 200) {
      throw new QrGenerateError({
        message: qrGenerateHttpErrorMessage(response.status),
        status: 502,
        code: 'upstream_http',
        upstreamStatus: response.status,
      });
    }

    return parseQrGenerateUpstreamBody(payload);
  } catch (error) {
    if (error instanceof QrGenerateError) throw error;
    if (isAbortError(error)) {
      throw new QrGenerateError({
        message: QR_GENERATE_ERROR_MESSAGES.timeout,
        status: 504,
        code: 'timeout',
      });
    }
    throw new QrGenerateError({
      message: QR_GENERATE_ERROR_MESSAGES.network,
      status: 502,
      code: 'network',
    });
  } finally {
    clearTimeout(timeout);
  }
}

export const FAKE_QR_IMG_OUTPUT = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
export const FAKE_QR_IMAGE_DATA_URL = `data:image/png;base64,${FAKE_QR_IMG_OUTPUT}`;
