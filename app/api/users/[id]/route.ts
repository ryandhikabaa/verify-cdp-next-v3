import {NextRequest} from 'next/server';
import {APP_ROLES} from '@/lib/auth/roles';
import {apiError, apiSuccess} from '@/lib/api-response';
import {hashPassword} from '@/lib/db/dotvera';
import {isPrismaNotFound, isPrismaUniqueViolation} from '@/lib/db/prisma-errors';
import {prisma} from '@/lib/db/prisma';
import {mapPublicUser} from '@/lib/db/users';

/** Updates a single user. */
export async function PATCH(request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  const {nama, username, password} = await request.json();

  if (!nama || !username) {
    return apiError({status: 400, message: `Nama dan username wajib diisi. Tipe akun yang tersedia: ${APP_ROLES.join(', ')}.`});
  }

  try {
    const user = await prisma.user.update({
      where: {id},
      data: {
        nama: String(nama).trim(),
        username: String(username).trim(),
        role: 'admin',
        ...(password ? {passwordHash: hashPassword(String(password))} : {}),
      },
    });

    return apiSuccess(mapPublicUser(user), {message: 'User updated successfully'});
  } catch (error) {
    console.error('Error updating user:', error);
    if (isPrismaUniqueViolation(error)) {
      return apiError({status: 409, message: 'Username sudah digunakan.'});
    }
    if (isPrismaNotFound(error)) {
      return apiError({status: 404, message: 'User not found'});
    }
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}

/** Deletes a single internal user. */
export async function DELETE(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;

  try {
    const user = await prisma.user.delete({where: {id}});
    return apiSuccess({deleted: mapPublicUser(user)}, {message: 'User deleted'});
  } catch (error) {
    console.error('Error deleting user:', error);
    if (isPrismaNotFound(error)) {
      return apiError({status: 404, message: 'User not found'});
    }
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
