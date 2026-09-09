import Link from 'next/link';
import type {Route} from 'next';
import type {ReactNode} from 'react';

/** Renders a top-level workspace tab trigger with active styling. */
export function TabButton({active, icon, label, href, variant = 'dark'}: {active: boolean; icon: ReactNode; label: string; href: Route; variant?: 'dark' | 'light'}) {
  const classes =
    variant === 'light'
      ? active
        ? 'border border-cyan-100 bg-cyan-50 text-cyan-800 shadow-[0_10px_30px_rgba(8,145,178,0.08)]'
        : 'border border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950'
      : active
        ? 'bg-emerald-400 text-slate-950 shadow-[0_12px_30px_rgba(52,211,153,0.25)]'
        : 'text-slate-400 hover:bg-white/5 hover:text-white';

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-95 ${classes}`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
