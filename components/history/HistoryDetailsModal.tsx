"use client";

import {useEffect, useState} from 'react';
import {Check, Copy, MapPin, Smartphone, X} from 'lucide-react';

type HistoryDetail = {
  id: string;
  label: string;
  deviceID: string;
  source: string;
  status: string;
  notes: string | null;
  validationPayloadBase64: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  imageData: string | null;
};

const statusStyles: Record<string, string> = {
  AUTHENTIC: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  COUNTERFEIT: 'border-amber-100 bg-amber-50 text-amber-800',
  MISMATCH: 'border-violet-100 bg-violet-50 text-violet-800',
};

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatLocation(latitude: number | null, longitude: number | null) {
  if (latitude == null || longitude == null) {
    return 'Lokasi tidak tersedia';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function HistoryDetailsModal({
  open,
  detail,
  onClose,
}: {
  open: boolean;
  detail: HistoryDetail | null;
  onClose: () => void;
}) {
  const [copiedPayload, setCopiedPayload] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open || !detail) {
    return null;
  }

  const handleCopyPayload = async () => {
    if (!detail.validationPayloadBase64) return;
    try {
      await navigator.clipboard.writeText(detail.validationPayloadBase64);
      setCopiedPayload(true);
      window.setTimeout(() => setCopiedPayload(false), 1800);
    } catch {
      setCopiedPayload(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-8" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center">
        <div
          className="w-full max-w-4xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.2)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef9ff_52%,#ffffff_100%)] px-5 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Verification detail</div>
                <h3 className="mt-1 truncate font-mono text-xl font-black tracking-[-0.04em] text-slate-950 sm:text-2xl">{detail.label}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-bold text-cyan-800">
                    {detail.source}
                  </span>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyles[detail.status] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                    {detail.status}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-600">
                    {dateTimeFormatter.format(new Date(detail.createdAt))}
                  </span>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close detail modal"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:bg-white hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <div className="border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Scan Preview</div>
                <div className="text-[11px] font-semibold text-slate-500">Captured image</div>
              </div>
              <div className="mt-3 overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white shadow-inner shadow-slate-100">
                {detail.imageData ? (
                  <img
                    src={detail.imageData}
                    alt={detail.label}
                    className="h-full max-h-[280px] w-full object-contain bg-[radial-gradient(circle_at_top,rgba(224,242,254,0.72),rgba(255,255,255,0.96))] sm:max-h-[340px]"
                  />
                ) : (
                  <div className="flex min-h-[220px] items-center justify-center px-6 text-center text-sm text-slate-500 sm:min-h-[260px]">
                    Preview scan belum tersedia untuk data ini.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50/70 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Status</div>
                  <div className="mt-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyles[detail.status] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                      {detail.status}
                    </span>
                  </div>
                </section>

                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Waktu</div>
                  <div className="mt-3 text-sm font-semibold leading-6 text-slate-700">{dateTimeFormatter.format(new Date(detail.createdAt))}</div>
                </section>

                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 sm:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Device</div>
                  <div className="mt-3 flex items-start gap-3 text-sm font-semibold text-slate-800">
                    <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <span className="break-all leading-6">{detail.deviceID}</span>
                  </div>
                </section>

                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 sm:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Lokasi</div>
                  <div className="mt-3 flex items-start gap-3 text-sm font-semibold text-slate-800">
                    <div className="rounded-xl bg-cyan-50 p-2 text-cyan-700">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <span className="leading-6">{formatLocation(detail.latitude, detail.longitude)}</span>
                  </div>
                </section>

                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 sm:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Notes</div>
                  <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
                    {detail.notes || 'Tidak ada catatan tambahan.'}
                  </p>
                </section>

                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 sm:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Data Validasi</div>
                      <div className="mt-1 text-[11px] text-slate-500">pattern_decode_payload • Base64</div>
                    </div>
                    {detail.validationPayloadBase64 ? (
                      <button
                        type="button"
                        onClick={() => void handleCopyPayload()}
                        className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        {copiedPayload ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedPayload ? 'Tersalin' : 'Salin'}
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 break-all rounded-xl border border-slate-200 bg-slate-950 px-3 py-3 font-mono text-xs leading-5 text-cyan-100">
                    {detail.validationPayloadBase64 || 'Data validasi tidak tersedia.'}
                  </div>
                </section>

                <section className="rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100 sm:col-span-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Metadata</div>
                  <dl className="mt-3 space-y-3 text-sm text-slate-600">
                    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                      <dt className="shrink-0 font-medium text-slate-400">Record ID</dt>
                      <dd className="max-w-[72%] break-all text-right font-mono text-slate-800">{detail.id}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <dt className="shrink-0 font-medium text-slate-400">Label</dt>
                      <dd className="max-w-[72%] break-all text-right font-mono text-slate-800">{detail.label}</dd>
                    </div>
                  </dl>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
