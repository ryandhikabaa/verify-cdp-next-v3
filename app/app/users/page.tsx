import {Users} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {UsersManagementClient} from '@/components/users/UsersManagementClient';
import {getCurrentSession} from '@/lib/auth/session';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';

type UserRecord = {
  id: string;
  nama: string;
  username: string;
  role: string;
  create_at: string;
  update_at: string;
  last_login: string | null;
};

export default async function UsersPage() {
  await ensureDotveraSchema();
  const session = await getCurrentSession();
  const result = await getDotveraPool().query<UserRecord>(
    'SELECT id, nama, username, role, create_at, update_at, last_login FROM "user" ORDER BY create_at DESC',
  );

  const initialUsers = result.rows.map((row) => ({
    id: row.id,
    nama: row.nama,
    username: row.username,
    role: row.role,
    created_at: String(row.create_at),
    updated_at: String(row.update_at),
    last_login: row.last_login ? String(row.last_login) : null,
  }));

  return (
    <AppShell activeTab="users">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.05)] lg:p-8">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">
          <Users className="h-4 w-4" />
          Users
        </div>

        <UsersManagementClient initialUsers={initialUsers} currentUserId={session?.userId ?? null} />
      </section>
    </AppShell>
  );
}