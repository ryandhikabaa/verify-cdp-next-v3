import {NextResponse, type NextRequest} from 'next/server';
import {getRequiredRolesForApiPath, getRequiredRolesForAppPath, hasRoleAccess} from '@/lib/auth/roles';
import {verifySessionToken} from '@/lib/auth/session';
import {apiError} from '@/lib/api-response';
import {rateLimit} from '@/lib/rate-limiter';
import {generateRequestId, logRequest, logResponse, logAuthFailure, logRateLimit} from '@/lib/logger';

function isProtectedApiPath(pathname: string) {
  return (
    pathname === '/api/qr/generate' ||
    pathname === '/api/patterns/batch' ||
    pathname.startsWith('/api/patterns/') ||
    pathname === '/api/settings' ||
    pathname === '/api/users' ||
    pathname.startsWith('/api/users/')
  );
}

export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;
  const reqId = generateRequestId();

  // Rate limiting: 100 requests per minute per IP for API routes
  if (pathname.startsWith('/api/')) {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = rateLimit(`api:${ip}`, {
      max: 100,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.success) {
      logRateLimit(ip, pathname, rateLimitResult.limit, rateLimitResult.remaining, rateLimitResult.reset, reqId);
      return apiError({
        status: 429,
        message: 'Too many requests. Please try again later.',
        data: {
          limit: rateLimitResult.limit,
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
      });
    }
  }

  logRequest(request, reqId);

  if (pathname.startsWith('/app')) {
    const token = request.cookies.get('dotvera_session')?.value;
    const session = await verifySessionToken(token);
    if (!session) {
      logAuthFailure(
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        pathname,
        'No session token',
        reqId,
      );
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const requiredRoles = getRequiredRolesForAppPath(pathname);
    if (requiredRoles && !hasRoleAccess(session.role, requiredRoles)) {
      logAuthFailure(
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        pathname,
        'Insufficient permissions',
        reqId,
      );
      const dashboardUrl = new URL('/app/dashboard', request.url);
      dashboardUrl.searchParams.set('denied', '1');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (isProtectedApiPath(pathname)) {
    const requiredRoles = getRequiredRolesForApiPath(pathname, request.method);

    if (requiredRoles) {
      const token = request.cookies.get('dotvera_session')?.value;
      const session = await verifySessionToken(token);
      if (!session) {
        logAuthFailure(
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          pathname,
          'No session token',
          reqId,
        );
        return apiError({status: 401, message: 'Unauthorized'});
      }

      if (!hasRoleAccess(session.role, requiredRoles)) {
        logAuthFailure(
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          pathname,
          'Insufficient permissions',
          reqId,
        );
        return apiError({status: 403, message: 'Forbidden'});
      }
    }
  }

  const response = NextResponse.next();
  logResponse(response, 0, reqId);
  return response;
}

export const config = {
  matcher: [
    '/app/:path*',
    '/api/:path*',
  ],
};