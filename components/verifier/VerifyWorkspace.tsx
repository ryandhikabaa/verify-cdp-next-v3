'use client';

import Link from 'next/link';
import {RefreshCw, ShieldCheck} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {PublicShell} from '@/components/PublicShell';
import {Card} from '@/components/ui/Card';
import {CameraPanel} from '@/components/verifier/CameraPanel';
import {ScanResultModal} from '@/components/verifier/ScanResultModal';
import {useVerifyScanner} from '@/hooks/useVerifyScanner';

/** Provides the camera verifier surface connected to the Next.js API. */
export function VerifyWorkspace({variant = 'app'}: {variant?: 'app' | 'public'}) {
  const showScannerDebug: boolean = true;
  const {
    videoRef,
    scanMode,
    isScanning,
    isFlashOn,
    hasFlash,
    cameraZoom,
    zoomRange,
    cameraStarting,
    matchResult,
    setMatchResult,
    errorMsg,
    scannerMessage,
    scannerDebug,
    focusBox,
    isCropModalOpen,
    setIsCropModalOpen,
    startCamera,
    toggleFlash,
    setCameraZoomLevel,
    triggerFocus,
  } = useVerifyScanner();

  const content = (
    <section className={variant === 'public' ? 'px-0 py-0' : 'px-4 py-4'}>
      {variant === 'public' && (
        <div className="mb-4 overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(243,248,252,0.9))] shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur">
          <div className="flex flex-col gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <h1 className="max-w-2xl text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-3xl lg:text-[2rem]">
                Verify protected documents directly without signing in.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                Gunakan pemindai untuk memverifikasi pola dokumen dan meninjau hasil verifikasi melalui antarmuka publik.
              </p>
            </div>

            <div className="flex shrink-0">
              <Link
                href="/"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white/92 px-4 text-sm font-semibold text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-white"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      )}

      <div id="verify-scanner" className={variant === 'public' ? 'rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,248,251,0.95))] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.05)] sm:p-6 lg:p-7' : ''}>
        <Card title={variant === 'public' ? undefined : 'Scanner Verifikasi'} variant={variant}>
          <CameraPanel
            videoRef={videoRef}
            onFocus={triggerFocus}
            focusBox={focusBox}
            hasFlash={hasFlash}
            isFlashOn={isFlashOn}
            onToggleFlash={() => void toggleFlash()}
            cameraZoom={cameraZoom}
            zoomRange={zoomRange}
            onZoomChange={(zoom) => void setCameraZoomLevel(zoom)}
            cameraStarting={cameraStarting}
            errorMsg={errorMsg}
            onRetry={() => void startCamera()}
            variant={variant}
          />

          <div className={`mt-4 text-center ${variant === 'public' ? 'text-xs text-slate-600' : 'text-[10px] text-slate-400'}`}>
            Posisikan seluruh kode V3 (QR di kiri, satu pattern di kanan) di dalam kotak. <br />
            (Ketuk layar video untuk fokus ulang).
          </div>

          <div className={`mt-3 rounded-xl px-3 py-3 text-center ${variant === 'public' ? 'border border-slate-200 bg-slate-50 text-xs text-slate-600' : 'border border-white/10 bg-black/25 text-[10px] text-slate-400'}`}>
            {scannerMessage}
          </div>

          {showScannerDebug && scannerDebug && (
            <details className={`mt-3 rounded-2xl px-4 py-3 text-xs ${variant === 'public' ? 'border border-cyan-100 bg-cyan-50/70 text-slate-700' : 'border border-cyan-400/20 bg-cyan-400/10 text-slate-300'}`} open>
              <summary className="cursor-pointer font-black uppercase tracking-wider text-cyan-600">Debug Deteksi</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div><b>Tahap:</b> {scannerDebug.stage}</div>
                <div><b>Waktu:</b> {scannerDebug.time}</div>
                <div><b>Video:</b> {scannerDebug.videoSize}</div>
                <div><b>Crop/ROI:</b> {scannerDebug.roiSize}</div>
                <div><b>QR:</b> {scannerDebug.qrDetected ? 'terdeteksi' : 'belum'}</div>
                <div><b>QR value:</b> {scannerDebug.qrValue || '-'}</div>
                <div><b>Pattern V3 kanan:</b> {scannerDebug.rightDetected ? (scannerDebug.rightValid ? 'valid' : 'terbaca, belum valid') : 'belum'}</div>
                <div className="sm:col-span-2"><b>Payload V3:</b> <span className="font-mono">{scannerDebug.rightPayload || scannerDebug.combinedPayload || '-'}</span></div>
                <div><b>Confidence:</b> {scannerDebug.confidence === null ? '-' : scannerDebug.confidence.toFixed(3)}</div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                {scannerDebug.captureDataUrl && (
                  <div>
                    <div className="mb-1 font-bold uppercase text-slate-500">ROI kamera</div>
                    <img src={scannerDebug.captureDataUrl} alt="Debug ROI Kamera" className="w-full rounded-lg border border-white/30 bg-white object-contain [image-rendering:pixelated]" />
                  </div>
                )}
                {scannerDebug.qrCropDataUrl && (
                  <div>
                    <div className="mb-1 font-bold uppercase text-slate-500">Crop QR</div>
                    <img src={scannerDebug.qrCropDataUrl} alt="Debug Crop QR" className="w-full rounded-lg border border-white/30 bg-white object-contain [image-rendering:pixelated]" />
                  </div>
                )}
                {scannerDebug.leftCropDataUrl && (
                  <div>
                    <div className="mb-1 font-bold uppercase text-slate-500">Crop kiri</div>
                    <img src={scannerDebug.leftCropDataUrl} alt="Debug Crop CDP Kiri" className="w-full rounded-lg border border-white/30 bg-white object-contain [image-rendering:pixelated]" />
                  </div>
                )}
                {scannerDebug.rightCropDataUrl && (
                  <div>
                    <div className="mb-1 font-bold uppercase text-slate-500">Crop kanan</div>
                    <img src={scannerDebug.rightCropDataUrl} alt="Debug Crop Pattern V3 Kanan" className="w-full rounded-lg border border-white/30 bg-white object-contain [image-rendering:pixelated]" />
                  </div>
                )}
              </div>
            </details>
          )}

          {scanMode === 'auto' && isScanning && !matchResult && (
            <div
              className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black tracking-wider ${
                variant === 'public'
                  ? 'border border-cyan-200 bg-cyan-50 text-cyan-700'
                  : 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
              }`}
            >
              <RefreshCw className="h-4 w-4 animate-spin" />
              MEMPROSES PEMINDAIAN...
            </div>
          )}
        </Card>

        {matchResult && (
          <div className="mt-5">
            <Card title={variant === 'public' ? undefined : 'Hasil Analisis'} variant={variant}>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-xs font-black uppercase text-slate-500">Status Verifikasi</div>
                  {matchResult.status === 'AUTHENTIC' && <div className="mt-1 text-2xl font-black text-emerald-400">AUTHENTIC</div>}
                  {matchResult.status === 'COUNTERFEIT' && <div className="mt-1 text-2xl font-black text-amber-400">COUNTERFEIT</div>}

                  <div className="mt-4 text-xs font-black uppercase text-slate-500">ID Terbaca</div>
                  <div className={`mt-1 font-mono text-sm font-bold ${variant === 'public' ? 'text-slate-900' : 'text-slate-100'}`}>
                    {matchResult.doc.id}
                  </div>

                  <div className="mt-4 text-xs font-black uppercase text-slate-500">Keterangan</div>
                  <div className={`mt-1 text-sm font-medium leading-6 ${variant === 'public' ? 'text-slate-700' : 'text-slate-300'}`}>
                    {matchResult.notes || matchResult.responseMessage || 'Hasil verifikasi berhasil diproses.'}
                  </div>
                </div>

                <div className="w-24 shrink-0 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500">Hasil Pindai</div>
                  <button
                    type="button"
                    onClick={() => setIsCropModalOpen(true)}
                    className={`block w-full overflow-hidden rounded-xl transition hover:ring-2 ${variant === 'public' ? 'border border-slate-200 bg-white hover:ring-cyan-300' : 'border border-white/10 bg-white hover:ring-emerald-400'}`}
                  >
                    <img src={matchResult.scanDataUrl} alt="Scan Capture" className="w-full object-contain [image-rendering:pixelated]" />
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMatchResult(null)}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black uppercase tracking-wider transition active:scale-[0.99] ${
                  variant === 'public' ? 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100' : 'bg-white/10 text-white'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Pindai Ulang
              </button>
            </Card>
          </div>
        )}

        {isCropModalOpen && matchResult && <ScanResultModal matchResult={matchResult} onClose={() => setIsCropModalOpen(false)} />}
      </div>
    </section>
  );

  if (variant === 'public') {
    return <PublicShell>{content}</PublicShell>;
  }

  return <AppShell activeTab="verify">{content}</AppShell>;
}
