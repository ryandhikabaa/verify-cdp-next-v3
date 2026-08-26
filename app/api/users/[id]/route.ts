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

/** Updates a single user. */
export async function PATCH(request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  const {nama, username, password} = await request.json();

  if (!nama || !username) {
    return apiError({status: 400, message: `Nama dan username wajib diisi. Tipe akun yang tersedia: ${APP_ROLES.join(', ')}.`});
  }

  try {
    await ensureDotveraSchema();

    const fields = ['nama = $1', 'username = $2', 'role = $3'];
    const values: Array<string> = [String(nama).trim(), String(username).trim(), 'admin'];

    if (password) {
      fields.push(`password_hash = $${fields.length + 1}`);
      values.push(hashPassword(String(password)));
    }

    values.push(id);
    const result = await getDotveraPool().query<UserRow>(
      `UPDATE "user"
       SET ${fields.join(', ')}, update_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING id, nama, username, role, create_at, update_at, last_login`,
      values,
    );

    if (result.rowCount === 0) {
      return apiError({status: 404, message: 'User not found'});
    }

    return apiSuccess(mapUser(result.rows[0]), {message: 'User updated successfully'});
  } catch (error) {
    console.error('Error updating user:', error);
    const message = error instanceof Error && 'code' in error && error.code === '23505' ? 'Username sudah digunakan.' : 'Internal Server Error';
    return apiError({status: message === 'Internal Server Error' ? 500 : 409, message});
  }
}

/** Deletes a single internal user. */
export async function DELETE(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;

  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query<UserRow>(
      'DELETE FROM "user" WHERE id = $1 RETURNING id, nama, username, role, create_at, update_at, last_login',
      [id],
    );

    if (result.rowCount === 0) {
      return apiError({status: 404, message: 'User not found'});
    }

    return apiSuccess({deleted: mapUser(result.rows[0])}, {message: 'User deleted'});
  } catch (error) {
    console.error('Error deleting user:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
