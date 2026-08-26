"use client";

import {X} from 'lucide-react';

type UnderDevelopmentModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
};

/** Reusable modal for unfinished public actions. */
export function UnderDevelopmentModal({open, title, onClose}: UnderDevelopmentModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Under development</div>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{title}</h3>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-500">
          {title} is still under development. The experience is being refined before it is connected to the final workflow.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-cyan-700 px-5 text-sm font-semibold text-white transition hover:bg-cyan-800"
          >
            Got it
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
