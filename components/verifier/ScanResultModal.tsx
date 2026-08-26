import {X} from 'lucide-react';
import type {PatternDoc, VerifyStatus} from '@/lib/types';

/** Shows the enlarged aligned scan result in a modal view. */
export function ScanResultModal({
  matchResult,
  onClose,
}: {
  matchResult: {doc: PatternDoc; score: number; status: VerifyStatus; scanDataUrl: string};
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0a0d15] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-mono text-sm font-black uppercase tracking-wider text-emerald-300">Crop Verifikasi</h3>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-slate-300 transition hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
          <img src={matchResult.scanDataUrl} alt="Crop Verifikasi" className="w-full max-w-[340px] [image-rendering:pixelated]" />
        </div>

        <div className="mt-4 text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">ID Terdeteksi</div>
          <div className="mt-1 font-mono text-base font-black text-white">{matchResult.doc.id}</div>
        </div>
      </div>
    </div>
  );
}
