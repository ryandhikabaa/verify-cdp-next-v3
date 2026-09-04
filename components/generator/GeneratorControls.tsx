import type {ReactNode} from 'react';
import {Database, Download, LoaderCircle} from 'lucide-react';
import {NumberField} from '@/components/ui/NumberField';
import {HVALUE_MAX_LENGTH, RECT_PATTERN_DOT_DENSITY, V3_PAYLOAD_CONSTANTS, hvalueErrorMessage, validateHvalue} from '@/lib/cdp';
import {HvalueValidationError} from '@/lib/cdp/hvalue';
import type {GeneratorSettings, GreyTextureVersion} from '@/lib/types';

function getHvalueHelp(hvalue: string) {
  if (!hvalue.trim()) return 'Hidden value wajib diisi sebelum Random data, Update preview, Simpan, Download, atau Generate batch.';
  try {
    validateHvalue(hvalue);
    return `Maksimal ${HVALUE_MAX_LENGTH} karakter. Huruf besar/kecil dipertahankan.`;
  } catch (error) {
    return error instanceof HvalueValidationError ? hvalueErrorMessage(error.code) : 'Hidden value hanya boleh huruf atau angka.';
  }
}

function isHvalueInvalid(hvalue: string) {
  if (!hvalue.trim()) return false;
  try {
    validateHvalue(hvalue);
    return false;
  } catch {
    return true;
  }
}

const CDP_PAYLOAD_MAX_LENGTH = V3_PAYLOAD_CONSTANTS.MAX_PAYLOAD_LENGTH;

function normalizePayloadInput(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, CDP_PAYLOAD_MAX_LENGTH);
}

const GREY_VERSION_OPTIONS: {value: GreyTextureVersion; label: string}[] = [
  {value: 'grey-v1', label: 'v1'},
  {value: 'grey-v2', label: 'v2'},
  {value: 'grey-v3', label: 'v3'},
];

/** Renders the full left-column generator controls and actions. */
export function GeneratorControls({
  batchCount,
  setBatchCount,
  seedLength,
  setSeedLength,
  generationError,
  isSaving,
  qrLoading,
  qrError,
  greyTextureVersion,
  setGreyTextureVersion,
  settings,
  payloadDraft,
  setPayloadDraft,
  onApplyPayloadDraft,
  onRandomPayloadDraft,
  onSave,
  onDownload,
  onGenerateBatch,
  previewCanvas,
}: {
  batchCount: number;
  setBatchCount: (value: number) => void;
  seedLength: number;
  setSeedLength: (value: number) => void;
  generationError: string | null;
  isSaving: boolean;
  qrLoading: boolean;
  qrError: string | null;
  greyTextureVersion: GreyTextureVersion;
  setGreyTextureVersion: (value: GreyTextureVersion) => void;
  settings: GeneratorSettings;
  payloadDraft: {payload: string; hvalue: string};
  setPayloadDraft: (updater: (current: {payload: string; hvalue: string}) => {payload: string; hvalue: string}) => void;
  onApplyPayloadDraft: () => void;
  onRandomPayloadDraft: () => void;
  onSave: () => void;
  onDownload: () => void;
  onGenerateBatch: () => void;
  previewCanvas: ReactNode;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,760px)_minmax(230px,300px)] xl:items-start xl:justify-between">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">Generator</div>
            <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-slate-950">Generate pattern</h2>
          </div>
          <div className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500 sm:inline-flex">
            Dot Density {(RECT_PATTERN_DOT_DENSITY * 100).toFixed(0)}% • Stochastic • Marker OFF
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <NumberField label="Jumlah" value={batchCount} min={1} max={100} onChange={setBatchCount} />
          <NumberField label="Panjang Seed" value={seedLength} min={1} max={24} onChange={setSeedLength} />
        </div>
        <div className="grid grid-cols-[86px_minmax(0,1fr)] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Grey version</div>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Grey texture version">
            {GREY_VERSION_OPTIONS.map((option) => {
              const isActive = greyTextureVersion === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => setGreyTextureVersion(option.value)}
                  className={`rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wide transition ${
                    isActive
                      ? 'border-slate-500 bg-slate-700 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-lg border border-cyan-100 bg-cyan-50/20 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-700">Payload layout V3</div>
              <div className="text-[9px] font-bold text-cyan-700">QR anchor</div>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1fr)] lg:items-start">
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-500">Hidden value</span>
              <input
                value={payloadDraft.hvalue}
                onChange={(event) => setPayloadDraft((current) => ({
                  ...current,
                  hvalue: event.target.value.slice(0, HVALUE_MAX_LENGTH),
                }))}
                maxLength={HVALUE_MAX_LENGTH}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={isHvalueInvalid(payloadDraft.hvalue)}
                aria-label="Hidden value"
                className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-cyan-300"
                aria-describedby="hvalue-help"
              />
              <span id="hvalue-help" className="mt-1 block text-[9px] font-semibold text-slate-500">
                {getHvalueHelp(payloadDraft.hvalue)}
              </span>
            </label>
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-500">payload · V3 pattern kanan QR</span>
              <input value={payloadDraft.payload} onChange={(event) => setPayloadDraft((current) => ({...current, payload: normalizePayloadInput(event.target.value)}))} maxLength={CDP_PAYLOAD_MAX_LENGTH} inputMode="text" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 outline-none focus:border-cyan-300" />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={onRandomPayloadDraft} className="rounded-md border border-cyan-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-cyan-700 transition hover:bg-cyan-50">
              Random data
            </button>
            <button type="button" onClick={onApplyPayloadDraft} className="rounded-md bg-cyan-700 px-2.5 py-1.5 text-[11px] font-black text-white transition hover:bg-cyan-800">
              Update preview
            </button>
            <span className="text-[9px] font-semibold text-slate-500">V3 maksimal 24 karakter · QR kiri · satu pattern kanan.</span>
          </div>
        </div>
        <div className={`text-[10px] font-semibold ${generationError ? 'text-rose-600' : 'text-slate-400'}`}>
          {generationError ?? 'Payload V3 menggunakan 1–24 karakter: A-Z, a-z, 0-9, - dan _.'}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || qrLoading || Boolean(generationError)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 text-xs font-bold text-white transition hover:bg-cyan-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </button>

          <button
            type="button"
            onClick={onGenerateBatch}
            disabled={isSaving || qrLoading || Boolean(generationError)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isSaving ? 'Memproses...' : 'Generate Batch'}
          </button>

          <button
            type="button"
            onClick={onDownload}
            disabled={isSaving || qrLoading || Boolean(generationError)}
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
        {qrLoading ? <div className="text-[10px] font-semibold text-cyan-700">Memuat QR custom...</div> : null}
        {qrError ? <div className="text-[10px] font-semibold text-rose-600">{qrError}</div> : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Preview</div>
        <div className="mt-1.5 flex min-h-[190px] items-center justify-center overflow-auto rounded-md border border-slate-200 bg-white p-2">
          {previewCanvas}
        </div>
      </div>
    </section>
  );
}
