'use client';

import {useEffect, useRef} from 'react';
import {AppShell} from '@/components/AppShell';
import {PreviewModal} from '@/components/generator/PreviewModal';
import {GeneratorControls} from '@/components/generator/GeneratorControls';
import {StoredPatternsPanel} from '@/components/generator/StoredPatternsPanel';
import {useGeneratorWorkspace} from '@/hooks/useGeneratorWorkspace';

/** Provides the migrated generator surface connected to the Next.js API. */
export function GeneratorWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    settings,
    setSettings,
    payloadDraft,
    setPayloadDraft,
    applyPayloadDraft,
    randomizePayloadDraft,
    batchCount,
    setBatchCount,
    seedLength,
    setSeedLength,
    generationError,
    isSaving,
    previewImageData,
    previewSettings,
    setPreviewSettings,
    previewDoc,
    setPreviewDoc,
    validationDialogMessage,
    setValidationDialogMessage,
    saveConfirmOpen,
    setSaveConfirmOpen,
    batchConfirmOpen,
    setBatchConfirmOpen,
    processingMessage,
    patternLibrary,
    requestSaveCurrentPattern,
    requestGenerateBatch,
    saveCurrentPattern,
    generateBatch,
    downloadBatch,
    downloadCurrentPng,
    downloadDoc,
    downloadSelectedDocs,
  } = useGeneratorWorkspace();

  useEffect(() => {
    if (!canvasRef.current || !previewImageData) return;

    const image = new Image();
    image.onload = () => {
      if (!canvasRef.current) return;
      canvasRef.current.width = image.naturalWidth;
      canvasRef.current.height = image.naturalHeight;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      ctx.drawImage(image, 0, 0);
    };
    image.src = previewImageData;
  }, [previewImageData]);

  return (
    <AppShell activeTab="generator">
      <section className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
          <GeneratorControls
            batchCount={batchCount}
            setBatchCount={setBatchCount}
            seedLength={seedLength}
            setSeedLength={setSeedLength}
            generationError={generationError}
            isSaving={isSaving}
            greyTextureVersion={settings.greyTextureVersion ?? 'grey-v3'}
            setGreyTextureVersion={(greyTextureVersion) => setSettings((current) => ({...current, greyTextureVersion}))}
            settings={settings}
            payloadDraft={payloadDraft}
            setPayloadDraft={setPayloadDraft}
            onApplyPayloadDraft={applyPayloadDraft}
            onRandomPayloadDraft={randomizePayloadDraft}
            onSave={requestSaveCurrentPattern}
            onDownload={downloadCurrentPng}
            onGenerateBatch={requestGenerateBatch}
            previewCanvas={<canvas ref={canvasRef} className="w-full max-w-[235px] [image-rendering:pixelated]" />}
          />
        </div>

        <div>
          <StoredPatternsPanel
            settings={settings}
            patternLibrary={patternLibrary}
            setPreviewSettings={setPreviewSettings}
            setPreviewDoc={setPreviewDoc}
            downloadDoc={downloadDoc}
            downloadSelectedDocs={downloadSelectedDocs}
          />
        </div>

        {(previewSettings || previewDoc) && <PreviewModal settings={previewSettings} preview={previewDoc} onClose={() => {
          setPreviewSettings(null);
          setPreviewDoc(null);
        }} />}
        {validationDialogMessage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => setValidationDialogMessage('')}>
            <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Data belum lengkap</div>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Lengkapi payload CDP</h3>
              <p className="mt-4 text-sm leading-7 text-slate-500">{validationDialogMessage}</p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setValidationDialogMessage('')}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-700 px-6 text-sm font-bold text-white transition hover:bg-cyan-800"
                >
                  Mengerti
                </button>
              </div>
            </div>
          </div>
        )}
        {saveConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => setSaveConfirmOpen(false)}>
            <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Konfirmasi simpan</div>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Simpan pattern ini?</h3>
              <p className="mt-4 text-sm leading-7 text-slate-500">
                Pattern V3 akan dirender dan disimpan ke database dengan satu payload, QR anchor, dan pattern di sisi kanan.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSaveConfirmOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void saveCurrentPattern()}
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-700 px-6 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Menyimpan...' : 'Ya, simpan'}
                </button>
              </div>
            </div>
          </div>
        )}
        {batchConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => setBatchConfirmOpen(false)}>
            <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Konfirmasi batch</div>
              <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Generate batch?</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">Jumlah data</div>
                  <div className="mt-2 font-mono text-2xl font-black text-cyan-950">{batchCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Panjang digit</div>
                  <div className="mt-2 font-mono text-2xl font-black text-slate-950">{seedLength}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-500">
                Sistem akan membuat dan menyimpan {batchCount} data pattern dengan panjang seed {seedLength} digit.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setBatchConfirmOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => void generateBatch()}
                  disabled={isSaving}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-700 px-6 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Memproses...' : 'Ya, generate'}
                </button>
              </div>
            </div>
          </div>
        )}
        {processingMessage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-6 text-center shadow-[0_30px_80px_rgba(15,23,42,0.24)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
                <div className="h-7 w-7 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-700" />
              </div>
              <div className="mt-5 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Processing</div>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">Mohon tunggu</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{processingMessage}</p>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
