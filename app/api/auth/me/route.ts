import {NextResponse} from 'next/server';
import {getCurrentSession} from '@/lib/auth/session';
import {apiError, apiSuccess} from '@/lib/api-response';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return apiError({status: 401, message: 'Session tidak ditemukan.'});
  }

  return apiSuccess(session, {message: 'Current session retrieved'});
}