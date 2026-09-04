import {NextRequest} from 'next/server';
import {APP_ROLES} from '@/lib/auth/roles';
import {apiError, apiSuccess} from '@/lib/api-response';
import {hashPassword} from '@/lib/db/dotvera';
import {isPrismaUniqueViolation} from '@/lib/db/prisma-errors';
import {prisma} from '@/lib/db/prisma';
import {mapPublicUser} from '@/lib/db/users';

/** Returns the full user catalog ordered by newest first. */
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: {createAt: 'desc'},
    });
    return apiSuccess(users.map(mapPublicUser), {message: 'Users retrieved successfully'});
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
    const user = await prisma.user.create({
      data: {
        nama: String(nama).trim(),
        username: String(username).trim(),
        passwordHash: hashPassword(String(password)),
        role: 'admin',
      },
    });

    return apiSuccess(mapPublicUser(user), {status: 201, message: 'User created successfully'});
  } catch (error) {
    console.error('Error creating user:', error);
    const message = isPrismaUniqueViolation(error) ? 'Username sudah digunakan.' : 'Internal Server Error';
    return apiError({status: message === 'Internal Server Error' ? 500 : 409, message});
  }
}
