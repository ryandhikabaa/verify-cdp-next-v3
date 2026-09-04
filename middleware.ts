import {NextResponse, type NextRequest} from 'next/server';
import {getRequiredRolesForApiPath, getRequiredRolesForAppPath, hasRoleAccess} from '@/lib/auth/roles';
import {verifySessionToken} from '@/lib/auth/session';
import {apiError} from '@/lib/api-response';

function isProtectedApiPath(pathname: string) {
  return (
    pathname === '/api/qr/generate' ||
    pathname === '/api/patterns/batch' ||
    pathname.startsWith('/api/patterns/') ||
    pathname === '/api/users' ||
    pathname.startsWith('/api/users/')
  );
}

export async function middleware(request: NextRequest) {
  const {pathname} = request.nextUrl;

  if (pathname.startsWith('/app')) {
    const token = request.cookies.get('dotvera_session')?.value;
    const session = await verifySessionToken(token);
    if (!session) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const requiredRoles = getRequiredRolesForAppPath(pathname);
    if (requiredRoles && !hasRoleAccess(session.role, requiredRoles)) {
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
        return apiError({status: 401, message: 'Unauthorized'});
      }

      if (!hasRoleAccess(session.role, requiredRoles)) {
        return apiError({status: 403, message: 'Forbidden'});
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/api/qr/:path*', '/api/patterns/:path*', '/api/users/:path*'],
};