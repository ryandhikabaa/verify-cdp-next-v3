import type {ReactNode} from 'react';

/** Renders a reusable panel shell for the migration workspace UI. */
export function Card({title, children, variant = 'app'}: {title?: string; children: ReactNode; variant?: 'app' | 'public'}) {
  return (
    <section
      className={
        variant === 'public'
          ? 'rounded-[1.75rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.95))] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]'
          : 'rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20'
      }
    >
      {title ? (
        <div className={`mb-4 pb-3 text-sm font-black uppercase tracking-wider ${variant === 'public' ? 'border-b border-slate-200 text-slate-800' : 'border-b border-white/10 text-slate-200'}`}>
          {title}
        </div>
      ) : null}
      {children}
    </section>
  );
}
