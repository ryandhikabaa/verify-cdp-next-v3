'use client';

import {useEffect, useState} from 'react';
import {LoaderCircle, LogOut, TriangleAlert} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {createPortal} from 'react-dom';
import {fetchApi} from '@/lib/api-client';

export function LogoutButton({variant = 'dark'}: {variant?: 'dark' | 'light'}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeModal = () => {
    if (loading) return;
    setVisible(false);
    window.setTimeout(() => setConfirmOpen(false), 220);
  };

  useEffect(() => {
    if (!confirmOpen) {
      setVisible(false);
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frameId = window.requestAnimationFrame(() => setVisible(true));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmOpen, loading]);

  const handleLogout = async () => {
    setLoading(true);

    try {
      await fetchApi('/api/auth/logout', {method: 'POST'});
      closeModal();
      router.push('/login');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className={
          variant === 'light'
            ? 'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100'
            : 'inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-rose-100'
        }
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>

      {mounted && confirmOpen
        ? createPortal(
            <div className={`fixed inset-0 z-[220] flex min-h-screen items-center justify-center p-4 transition-all duration-200 ease-out sm:p-6 ${visible ? 'bg-slate-950/55 opacity-100' : 'bg-slate-950/0 opacity-0'}`}>
              <button
                type="button"
                aria-label="Tutup modal logout"
                disabled={loading}
                onClick={closeModal}
                className="absolute inset-0"
              />

              <div className={`relative w-full max-w-lg rounded-[1.9rem] border border-slate-200/90 bg-white p-6 shadow-[0_32px_90px_rgba(15,23,42,0.24)] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-7 ${visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.965] opacity-0'}`}>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-inner">
                    <TriangleAlert className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-[-0.03em] text-slate-950">Konfirmasi logout</h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">Apakah Anda yakin ingin keluar dari workspace admin ini? Sesi aktif akan diakhiri dan Anda akan diarahkan ke halaman login.</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition duration-150 hover:-translate-y-0.5 hover:bg-slate-100 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loading}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition duration-150 hover:-translate-y-0.5 hover:bg-rose-700 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    {loading ? 'Logging out...' : 'Ya, logout'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}