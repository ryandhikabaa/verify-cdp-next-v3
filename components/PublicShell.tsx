'use client';

import {useState, type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Menu, X} from 'lucide-react';

/** Provides a lightweight shell for public-facing routes like login and landing. */
export function PublicShell({children}: {children: ReactNode}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const withHomeAnchor = (anchor: string) => (pathname === '/' ? anchor : `/${anchor}`);

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-slate-900">
      <div className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f2f6fa_48%,#eef3f8_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.08),transparent_32%),radial-gradient(circle_at_90%_18%,rgba(59,130,246,0.08),transparent_22%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/80" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1180px] flex-col px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="rounded-[2rem] border border-slate-200/70 bg-white/88 px-5 py-4 shadow-[0_16px_50px_rgba(15,23,42,0.05)] backdrop-blur sm:px-6">
            <div className="flex items-center justify-between gap-4 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center">
              <div className="min-w-0">
                <Link href="/" className="inline-flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b3141] text-xs font-bold text-white">
                    DV
                  </span>
                  <span className="text-lg font-semibold tracking-[-0.02em] text-slate-900">Dotvera</span>
                </Link>
              </div>

              <button
                type="button"
                aria-label="Toggle navigation"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 sm:hidden"
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>

              <div className="hidden sm:flex sm:items-center sm:justify-center">
                <nav className="flex flex-col gap-3 text-sm font-medium text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-5 sm:text-xs">
                  <a href={withHomeAnchor('#products')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                    Products
                  </a>
                  <a href={withHomeAnchor('#customers')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                    Customers
                  </a>
                  <a href={withHomeAnchor('#pricing')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                    Workflow
                  </a>
                  <a href={withHomeAnchor('#learn')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                    Overview
                  </a>
                </nav>
              </div>

              <div className="hidden sm:flex sm:justify-end">
                <Link
                  href="/login"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Login
                </Link>
              </div>
            </div>

            <div className={`mt-4 flex-col gap-4 sm:hidden ${mobileMenuOpen ? 'flex' : 'hidden'}`}>
              <nav className="flex flex-col gap-3 text-sm font-medium text-slate-600">
                <a href={withHomeAnchor('#products')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                  Products
                </a>
                <a href={withHomeAnchor('#customers')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                  Customers
                </a>
                <a href={withHomeAnchor('#pricing')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                  Workflow
                </a>
                <a href={withHomeAnchor('#learn')} onClick={() => setMobileMenuOpen(false)} className="transition hover:text-slate-950">
                  Overview
                </a>
              </nav>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Login
                </Link>
              </div>
            </div>
          </header>

          <div className="flex-1 py-6 sm:py-8 lg:py-10">{children}</div>
        </div>
      </div>
    </main>
  );
}
