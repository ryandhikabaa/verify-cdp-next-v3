import {Users} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {UsersManagementClient} from '@/components/users/UsersManagementClient';
import {getCurrentSession} from '@/lib/auth/session';
import {prisma} from '@/lib/db/prisma';
import {mapPublicUser} from '@/lib/db/users';

export default async function UsersPage() {
  const session = await getCurrentSession();
  const users = await prisma.user.findMany({
    orderBy: {createAt: 'desc'},
  });

  const initialUsers = users.map((user) => {
    const mapped = mapPublicUser(user);
    return {
      ...mapped,
      created_at: mapped.created_at.toISOString(),
      updated_at: mapped.updated_at.toISOString(),
      last_login: mapped.last_login ? mapped.last_login.toISOString() : null,
    };
  });

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