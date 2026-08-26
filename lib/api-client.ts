export type ApiEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

export class ApiClientError extends Error {
  statusCode: number;
  payload?: unknown;

  constructor(message: string, statusCode: number, payload?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

export async function parseApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiClientError('Unexpected non-JSON response.', response.status);
    }

    throw new ApiClientError('Response parser expected JSON.', response.status);
  }

  let payload: Partial<ApiEnvelope<T>> & Record<string, unknown> = {};

  try {
    payload = (await response.json()) as Partial<ApiEnvelope<T>> & Record<string, unknown>;
  } catch {
    if (!response.ok) {
      throw new ApiClientError('Request failed.', response.status);
    }

    throw new ApiClientError('Response parser expected JSON.', response.status);
  }

  const message = typeof payload.message === 'string' ? payload.message : response.ok ? 'Request successful' : 'Request failed';
  const status = typeof payload.status === 'boolean' ? payload.status : response.ok;
  const data = (payload.data ?? null) as T;

  if (!response.ok || !status) {
    throw new ApiClientError(message, response.status, payload);
  }

  return {
    status,
    message,
    data,
  };
}

export async function fetchApi<T>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init);
  return parseApiResponse<T>(response);
}
