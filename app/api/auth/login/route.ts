import {NextRequest, NextResponse} from 'next/server';
import {createSessionToken, getSessionCookieName, getSessionMaxAge} from '@/lib/auth/session';
import {ensureDotveraSchema, getDotveraPool, verifyPassword} from '@/lib/db/dotvera';
import {normalizeRole} from '@/lib/auth/roles';
import {apiError, apiSuccess} from '@/lib/api-response';

export async function POST(request: NextRequest) {
  const {username, password} = await request.json();

  if (!username || !password) {
    return apiError({status: 400, message: 'Username dan password wajib diisi.'});
  }

  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query('SELECT id, username, password_hash, role FROM "user" WHERE username = $1 LIMIT 1', [String(username).trim()]);
    const user = result.rows[0];

    if (!user || !verifyPassword(String(password), user.password_hash)) {
      return apiError({status: 401, message: 'Username atau password tidak valid.'});
    }

    if (normalizeRole(user.role) !== 'admin') {
      return apiError({status: 403, message: 'Akses login hanya tersedia untuk admin.'});
    }

    await getDotveraPool().query('UPDATE "user" SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

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