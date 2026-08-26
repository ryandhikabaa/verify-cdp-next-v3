import {NextResponse} from 'next/server';

type ApiSuccessOptions = {
  status?: number;
  message?: string;
};

type ApiErrorOptions = {
  status: number;
  message: string;
  data?: unknown;
};

export function apiSuccess<T>(data: T, options: ApiSuccessOptions = {}) {
  return NextResponse.json(
    {
      status: true,
      message: options.message ?? 'Request successful',
      data,
    },
    {status: options.status ?? 200},
  );
}

export function apiError(options: ApiErrorOptions) {
  return NextResponse.json(
    {
      status: false,
      message: options.message,
      data: options.data ?? null,
    },
    {status: options.status},
  );
}

export function apiMessage(message: string, options: ApiSuccessOptions = {}) {
  return apiSuccess(null, {status: options.status, message});
}
