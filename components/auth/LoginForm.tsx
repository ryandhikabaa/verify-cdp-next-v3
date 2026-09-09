'use client';

import {useState} from 'react';
import type {Route} from 'next';
import {Eye, EyeOff, LockKeyhole, User2} from 'lucide-react';
import {useRouter, useSearchParams} from 'next/navigation';
import {ApiClientError, fetchApi} from '@/lib/api-client';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const nextPath = searchParams.get('next');
    const redirectTarget = nextPath && nextPath.startsWith('/app') ? nextPath : '/app/dashboard';

    try {
      await fetchApi('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password}),
      });

      router.replace(redirectTarget as Route);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        setError(error.message || 'Username atau password salah. Silakan periksa kembali.');
        return;
      }

      setError('Koneksi ke server gagal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Username</label>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
          <User2 className="h-4 w-4 text-slate-400" />
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Masukkan username"
            autoComplete="username"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-500">Password</label>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
          <LockKeyhole className="h-4 w-4 text-slate-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="Masukkan password"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          <div className="font-bold">Login gagal</div>
          <div>{error}</div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[#0b3141] px-4 py-4 text-sm font-black uppercase tracking-wider text-white shadow-[0_16px_30px_rgba(11,49,65,0.22)] transition hover:bg-[#11465d] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? 'Memproses...' : 'Login'}
      </button>
    </form>
  );
}