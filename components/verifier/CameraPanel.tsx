import {Flashlight, Minus, Plus, RefreshCw} from 'lucide-react';

/** Renders the live camera view, overlay, focus feedback, and torch control. */
export function CameraPanel({
  videoRef,
  onFocus,
  focusBox,
  hasFlash,
  isFlashOn,
  onToggleFlash,
  cameraZoom,
  zoomRange,
  onZoomChange,
  cameraStarting,
  errorMsg,
  onRetry,
  variant = 'app',
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onFocus: (event: React.MouseEvent<HTMLVideoElement>) => void;
  focusBox: {x: number; y: number} | null;
  hasFlash: boolean;
  isFlashOn: boolean;
  onToggleFlash: () => void;
  cameraZoom: number;
  zoomRange: {min: number; max: number; step: number} | null;
  onZoomChange: (zoom: number) => void;
  cameraStarting: boolean;
  errorMsg: string;
  onRetry: () => void;
  variant?: 'app' | 'public';
}) {
  if (errorMsg) {
    return (
      <div className={`rounded-2xl p-4 text-center text-xs ${variant === 'public' ? 'border border-rose-200 bg-rose-50 text-rose-600' : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'}`}>
        <div>{errorMsg}</div>
        <button
          type="button"
          onClick={onRetry}
          disabled={cameraStarting}
          className={`mt-3 rounded-xl px-4 py-2 font-black uppercase tracking-wider disabled:opacity-50 ${variant === 'public' ? 'bg-slate-900 text-white' : 'bg-white/10 text-white'}`}
        >
          {cameraStarting ? 'Mengaktifkan...' : 'Coba Lagi'}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full">
      <div className={`relative mx-auto aspect-[4/3] w-full overflow-hidden ${variant === 'public' ? 'max-w-[440px] rounded-[2rem] border border-slate-200 bg-slate-950 shadow-[0_30px_70px_rgba(15,23,42,0.18)]' : 'max-w-[380px] rounded-[1.5rem] bg-black'}`}>
        <video ref={videoRef} playsInline muted onClick={onFocus} className="absolute inset-0 h-full w-full cursor-pointer object-cover" />

      {focusBox && (
        <div
          className="absolute z-20 h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border-2 border-emerald-400 opacity-0"
          style={{left: focusBox.x, top: focusBox.y}}
        />
      )}

      <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${variant === 'public' ? 'bg-slate-950/35' : 'bg-black/40'}`}>
        <div className={`aspect-[4/3] w-[82%] bg-transparent shadow-[0_0_0_999px_rgba(0,0,0,0.5)] ${variant === 'public' ? 'rounded-[1.25rem] border-2 border-dashed border-cyan-300' : 'rounded-xl border-2 border-dashed border-emerald-400'}`} />
      </div>

      {hasFlash && (
        <button
          type="button"
          onClick={onToggleFlash}
          className={`absolute bottom-4 right-4 z-20 rounded-full p-3 transition ${isFlashOn ? 'bg-yellow-400 text-black' : variant === 'public' ? 'border border-white/20 bg-white/15 text-white backdrop-blur-md' : 'bg-black/50 text-white backdrop-blur-md'}`}
          aria-label="Toggle Flashlight"
        >
          <Flashlight className="h-5 w-5" />
        </button>
      )}

      {cameraStarting && (
        <div className={`pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center ${variant === 'public' ? 'bg-slate-950/75 text-cyan-200' : 'bg-black/70 text-emerald-300'}`}>
          <RefreshCw className="h-7 w-7 animate-spin" />
          <div className="mt-3 text-[10px] font-black uppercase tracking-widest">Mengaktifkan Kamera</div>
        </div>
      )}
      </div>

      {zoomRange && (
        <div className={`mx-auto mt-3 max-w-[440px] rounded-2xl px-3 py-2 ${variant === 'public' ? 'border border-slate-200 bg-white/90 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.05)]' : 'border border-white/10 bg-white/5 text-white'}`}>
          <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
            <span>Zoom kamera</span>
            <span>{cameraZoom.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onZoomChange(cameraZoom - zoomRange.step)} aria-label="Zoom out" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
              <Minus className="h-4 w-4" />
            </button>
            <input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={cameraZoom} onChange={(event) => onZoomChange(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-cyan-400" aria-label="Camera zoom" />
            <button type="button" onClick={() => onZoomChange(cameraZoom + zoomRange.step)} aria-label="Zoom in" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
