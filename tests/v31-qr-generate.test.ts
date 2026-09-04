import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FAKE_QR_IMAGE_DATA_URL,
  FAKE_QR_IMG_OUTPUT,
  QR_GENERATE_ERROR_MESSAGES,
  QR_GENERATE_LOCKED_URL,
  QrGenerateError,
  parseQrGenerateRequestBody,
  parseQrGenerateUpstreamBody,
  requestQrGenerateFromUpstream,
} from '../lib/cdp/qr-generate';

const SUCCESS_BODY = {
  status: 'success',
  message: 'QR Code successfully generated',
  data: [
    {
      secret1: 'A8C2D3E0AECE',
      secret2: '1CE6',
      qrcode: 'b0df621A',
      hvalue: 'TELKOM',
      imgOutput: FAKE_QR_IMG_OUTPUT,
    },
  ],
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'content-type': 'application/json'},
  });
}

test('rejects empty, too-long, and non-alphanumeric hvalues before any upstream call', () => {
  let fetchCalls = 0;
  const fetchImpl: typeof fetch = async () => {
    fetchCalls += 1;
    return jsonResponse(200, SUCCESS_BODY);
  };

  for (const hvalue of ['', '   ', 'TELKOM12', 'TEL-KOM', 'TEL KOM']) {
    assert.throws(
      () => parseQrGenerateRequestBody({hvalue}),
      (error: unknown) => error instanceof QrGenerateError && error.code === 'validation' && error.status === 400,
    );
  }

  assert.throws(
    () => parseQrGenerateRequestBody({}),
    (error: unknown) => error instanceof QrGenerateError && error.code === 'validation',
  );
  assert.equal(fetchCalls, 0);
});

test('accepts trimmed case-sensitive hvalue without silent truncate', () => {
  assert.deepEqual(parseQrGenerateRequestBody({hvalue: ' Telkom '}), {hvalue: 'Telkom'});
  assert.deepEqual(parseQrGenerateRequestBody({hvalue: 'TELKOM'}), {hvalue: 'TELKOM'});
});

test('maps HTTP 200 + valid imgOutput to normalized QR metadata', async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(String(input), QR_GENERATE_LOCKED_URL);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, JSON.stringify({hvalue: 'TELKOM'}));
    return jsonResponse(200, SUCCESS_BODY);
  };

  const result = await requestQrGenerateFromUpstream({
    hvalue: 'TELKOM',
    url: QR_GENERATE_LOCKED_URL,
    fetchImpl,
  });

  assert.deepEqual(result, {
    qr_payload: 'b0df621A',
    qr_hvalue: 'TELKOM',
    qr_secret1: 'A8C2D3E0AECE',
    qr_secret2: '1CE6',
    qr_image: FAKE_QR_IMAGE_DATA_URL,
  });
});

test('normalizes raw base64 imgOutput to a data URL', () => {
  const mapped = parseQrGenerateUpstreamBody(SUCCESS_BODY);
  assert.equal(mapped.qr_image, FAKE_QR_IMAGE_DATA_URL);
});

test('stops on non-200 without returning partial data', async () => {
  const fetchImpl: typeof fetch = async () => jsonResponse(500, {status: 'error'});

  await assert.rejects(
    () => requestQrGenerateFromUpstream({
      hvalue: 'TELKOM',
      url: QR_GENERATE_LOCKED_URL,
      fetchImpl,
    }),
    (error: unknown) => (
      error instanceof QrGenerateError
      && error.code === 'upstream_http'
      && error.upstreamStatus === 500
      && error.message === 'Gagal generate QR (HTTP 500). Proses dihentikan.'
    ),
  );
});

test('stops on malformed 200 even when HTTP status is success', async () => {
  const fetchImpl: typeof fetch = async () => jsonResponse(200, {status: 'success', data: []});

  await assert.rejects(
    () => requestQrGenerateFromUpstream({
      hvalue: 'TELKOM',
      url: QR_GENERATE_LOCKED_URL,
      fetchImpl,
    }),
    (error: unknown) => error instanceof QrGenerateError && error.code === 'malformed' && error.message === QR_GENERATE_ERROR_MESSAGES.malformed,
  );
});

test('classifies timeout as an explicit 504 without retry', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const signal = init?.signal;
    return await new Promise((_resolve, reject) => {
      const abort = () => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        reject(error);
      };
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener('abort', abort, {once: true});
    });
  };

  await assert.rejects(
    () => requestQrGenerateFromUpstream({
      hvalue: 'TELKOM',
      url: QR_GENERATE_LOCKED_URL,
      fetchImpl,
      timeoutMs: 10,
    }),
    (error: unknown) => error instanceof QrGenerateError && error.code === 'timeout' && error.status === 504,
  );
});

test('classifies network failure without calling a different host', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError('fetch failed');
  };

  await assert.rejects(
    () => requestQrGenerateFromUpstream({
      hvalue: 'TELKOM',
      url: QR_GENERATE_LOCKED_URL,
      fetchImpl,
    }),
    (error: unknown) => error instanceof QrGenerateError && error.code === 'network' && error.status === 502,
  );
});

test('refuses to retarget a different QR host', async () => {
  let fetchCalls = 0;
  const fetchImpl: typeof fetch = async () => {
    fetchCalls += 1;
    return jsonResponse(200, SUCCESS_BODY);
  };

  await assert.rejects(
    () => requestQrGenerateFromUpstream({
      hvalue: 'TELKOM',
      url: 'https://example.invalid/qr',
      fetchImpl,
    }),
    (error: unknown) => error instanceof QrGenerateError && error.status === 500,
  );
  assert.equal(fetchCalls, 0);
});
