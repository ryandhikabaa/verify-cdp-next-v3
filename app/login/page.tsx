import Link from 'next/link';
import {redirect} from 'next/navigation';
import {LoginForm} from '@/components/auth/LoginForm';
import {PublicShell} from '@/components/PublicShell';
import {getCurrentSession} from '@/lib/auth/session';

/** Renders the initial login placeholder for the public area. */
export default async function LoginPage({searchParams}: {searchParams: Promise<{next?: string}>}) {
  const session = await getCurrentSession();
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith('/app') ? params.next : '/app/dashboard';
  if (session) redirect(nextPath);

  return (
    <PublicShell>
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(160deg,#0b3141_0%,#103f54_42%,#0f172a_100%)] p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] lg:p-10">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">
            Secure Admin Access
          </div>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">Masuk ke workspace internal Dotvera.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-cyan-50/80">
            Halaman ini digunakan oleh admin internal untuk mengakses dashboard, generator pattern, riwayat, dan endpoint pengelolaan data yang sudah dilindungi session.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/80">Protected Access</div>
              <div className="mt-2 text-sm leading-6 text-white/80">Route internal dan endpoint manajemen pattern tidak dapat diakses tanpa autentikasi.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/80">Session Based</div>
              <div className="mt-2 text-sm leading-6 text-white/80">Setelah berhasil login, pengguna akan diarahkan otomatis ke area kerja yang diminta.</div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200/70 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)] lg:p-10">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Login</div>
          <h2 className="mt-3 text-3xl font-black text-slate-900">Admin Access</h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Masukkan username dan password admin untuk melanjutkan ke area internal yang dilindungi.
          </p>

          <LoginForm />

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            Setelah login berhasil, akses seperti `app/dashboard`, `app/generator`, `app/verify`, dan endpoint pengelolaan pattern akan tersedia sesuai session aktif.
          </div>

          <div className="mt-6">
            <Link href="/" className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center text-sm font-black uppercase tracking-wider text-slate-700">
              Kembali ke Home
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
