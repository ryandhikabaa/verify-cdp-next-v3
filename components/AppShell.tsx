"use client";

import type {ReactNode} from 'react';
import {useState} from 'react';
import {BarChart3, BookOpenText, Grid2X2, History, Menu, ShieldCheck, Users} from 'lucide-react';
import {LogoutButton} from '@/components/auth/LogoutButton';
import {TabButton} from '@/components/ui/TabButton';

type AppSection = 'dashboard' | 'generator' | 'history' | 'users' | 'settings' | 'verify';

function pageTitle(activeTab: AppSection) {
  switch (activeTab) {
    case 'dashboard':
      return 'Operations Dashboard';
    case 'generator':
      return 'Generator Workspace';
    case 'history':
      return 'Verification History';
    case 'users':
      return 'User Management';
    case 'settings':
      return 'API Docs';
    case 'verify':
      return 'Verification Workspace';
    default:
      return 'Admin Workspace';
  }
}

/** Provides the shared visual shell for the migrated admin pages. */
export function AppShell({activeTab, children}: {activeTab: AppSection; children: ReactNode}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const mobileNavItems = [
    {key: 'dashboard', label: 'Dashboard', href: '/app/dashboard', icon: <BarChart3 className="h-4 w-4" />},
    {key: 'generator', label: 'Generator', href: '/app/generator', icon: <Grid2X2 className="h-4 w-4" />},
    {key: 'history', label: 'History Verifikasi', href: '/app/history', icon: <History className="h-4 w-4" />},
    {key: 'users', label: 'User', href: '/app/users', icon: <Users className="h-4 w-4" />},
    {key: 'settings', label: 'API Docs', href: '/app/settings', icon: <BookOpenText className="h-4 w-4" />},
  ] as const;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(8,145,178,0.08),transparent_32%),linear-gradient(180deg,#f4f8fb_0%,#eef4f8_100%)] text-slate-900">
      {mobileMenuOpen && <button type="button" aria-label="Close menu overlay" className="fixed inset-0 z-40 bg-slate-950/35 xl:hidden" onClick={() => setMobileMenuOpen(false)} />}
      <div className="mx-auto flex min-h-screen w-full max-w-[1680px] gap-6 px-4 py-4 md:px-6 lg:px-8 xl:gap-8 xl:px-10 xl:py-6">
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-[290px] shrink-0 rounded-[2rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] backdrop-blur xl:flex xl:flex-col xl:self-start xl:overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-[0_10px_30px_rgba(8,145,178,0.22)]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-950">Dotvera</div>
              <div className="text-xs text-slate-500">Secure admin workspace</div>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Main Menu</div>
            <nav className="space-y-1.5">
              <TabButton active={activeTab === 'dashboard'} icon={<BarChart3 className="h-4 w-4" />} label="Dashboard" href="/app/dashboard" variant="light" />
              <TabButton active={activeTab === 'generator'} icon={<Grid2X2 className="h-4 w-4" />} label="Generator" href="/app/generator" variant="light" />
              <TabButton active={activeTab === 'history'} icon={<History className="h-4 w-4" />} label="History Verifikasi" href="/app/history" variant="light" />
              <TabButton active={activeTab === 'users'} icon={<Users className="h-4 w-4" />} label="User" href="/app/users" variant="light" />
              <TabButton active={activeTab === 'settings'} icon={<BookOpenText className="h-4 w-4" />} label="API Docs" href="/app/settings" variant="light" />
            </nav>
          </div>

          <div className="mt-auto pt-6">
            <LogoutButton variant="light" />
          </div>
        </aside>

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[320px] border-r border-slate-200/80 bg-white/96 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur transition-transform duration-300 xl:hidden ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-[0_10px_30px_rgba(8,145,178,0.22)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-950">Dotvera</div>
                  <div className="text-xs text-slate-500">Secure admin workspace</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600"
                aria-label="Close menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Main Menu</div>
              <nav className="space-y-1.5">
                {mobileNavItems.map((item) => (
                  <div key={item.key} onClick={() => setMobileMenuOpen(false)}>
                    <TabButton active={activeTab === item.key} icon={item.icon} label={item.label} href={item.href} variant="light" />
                  </div>
                ))}
              </nav>
            </div>

            <div className="mt-auto pt-6">
              <LogoutButton variant="light" />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="rounded-[2rem] border border-slate-200/80 bg-white/88 px-5 py-4 shadow-[0_24px_70px_rgba(15,23,42,0.05)] backdrop-blur md:px-6 xl:px-8 xl:py-5">
            <div className="flex items-start gap-3">
                <button type="button" onClick={() => setMobileMenuOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 xl:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Dotvera Workspace
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{pageTitle(activeTab)}</h2>
                  <p className="mt-1 text-sm text-slate-500">Akses terproteksi untuk admin.</p>
                </div>
            </div>

          </header>

          <div className="pt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
