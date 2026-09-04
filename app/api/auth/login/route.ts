import {NextRequest} from 'next/server';
import {createSessionToken, getSessionCookieName, getSessionMaxAge} from '@/lib/auth/session';
import {normalizeRole} from '@/lib/auth/roles';
import {apiError, apiSuccess} from '@/lib/api-response';
import {verifyPassword} from '@/lib/db/dotvera';
import {prisma} from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  const {username, password} = await request.json();

  if (!username || !password) {
    return apiError({status: 400, message: 'Username dan password wajib diisi.'});
  }

  try {
    const user = await prisma.user.findFirst({
      where: {username: String(username).trim()},
      select: {id: true, username: true, passwordHash: true, role: true},
    });

    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      return apiError({status: 401, message: 'Username atau password tidak valid.'});
    }

    if (normalizeRole(user.role) !== 'admin') {
      return apiError({status: 403, message: 'Akses login hanya tersedia untuk admin.'});
    }

    await prisma.user.update({
      where: {id: user.id},
      data: {lastLogin: new Date()},
    });

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const response = apiSuccess(
      {id: user.id, username: user.username, role: user.role},
      {message: 'Login successful'},
    );
    response.cookies.set({
      name: getSessionCookieName(),
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: getSessionMaxAge(),
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return apiError({status: 500, message: 'Gagal memproses login.'});
  }
}