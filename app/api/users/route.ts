import {NextRequest, NextResponse} from 'next/server';
import {ensureDotveraSchema, getDotveraPool, hashPassword} from '@/lib/db/dotvera';
import {APP_ROLES} from '@/lib/auth/roles';
import {apiError, apiSuccess} from '@/lib/api-response';

type UserRow = {
  id: string;
  nama: string;
  username: string;
  role: string;
  create_at: Date | string;
  update_at: Date | string;
  last_login: Date | string | null;
};

function mapUser(row: UserRow) {
  return {
    id: row.id,
    nama: row.nama,
    username: row.username,
    role: row.role,
    created_at: row.create_at,
    updated_at: row.update_at,
    last_login: row.last_login,
  };
}

/** Returns the full user catalog ordered by newest first. */
export async function GET() {
  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query<UserRow>(
      'SELECT id, nama, username, role, create_at, update_at, last_login FROM "user" ORDER BY create_at DESC',
    );
    return apiSuccess(result.rows.map(mapUser), {message: 'Users retrieved successfully'});
  } catch (error) {
    console.error('Error fetching users:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}

/** Creates a new internal user. */
export async function POST(request: NextRequest) {
  const {nama, username, password} = await request.json();

  if (!nama || !username || !password) {
    return apiError({status: 400, message: `Field wajib diisi. Tipe akun yang tersedia: ${APP_ROLES.join(', ')}.`});
  }

  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query<UserRow>(
      `INSERT INTO "user" (nama, username, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, nama, username, role, create_at, update_at, last_login`,
      [String(nama).trim(), String(username).trim(), hashPassword(String(password)), 'admin'],
    );

    return apiSuccess(mapUser(result.rows[0]), {status: 201, message: 'User created successfully'});
  } catch (error) {
    console.error('Error creating user:', error);
    const message = error instanceof Error && 'code' in error && error.code === '23505' ? 'Username sudah digunakan.' : 'Internal Server Error';
    return apiError({status: message === 'Internal Server Error' ? 500 : 409, message});
  }
}
