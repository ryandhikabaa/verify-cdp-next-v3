import type {User} from '@prisma/client';

export type PublicUser = {
  id: string;
  nama: string;
  username: string;
  role: string;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
};

export function mapPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    nama: user.nama,
    username: user.username,
    role: user.role,
    created_at: user.createAt,
    updated_at: user.updateAt,
    last_login: user.lastLogin,
  };
}
