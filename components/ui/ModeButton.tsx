/** Renders a local mode toggle option for auto/manual or single/mass modes. */
export function ModeButton({active, label, onClick, variant = 'app'}: {active: boolean; label: string; onClick: () => void; variant?: 'app' | 'public'}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-sm font-black transition active:scale-95 ${
        active
          ? variant === 'public'
            ? 'bg-cyan-700 text-white shadow-[0_10px_24px_rgba(8,145,178,0.18)]'
            : 'bg-white text-slate-950'
          : variant === 'public'
            ? 'text-slate-500 hover:text-slate-700'
            : 'text-slate-400'
      }`}
    >
      {label}
    </button>
  );
}
