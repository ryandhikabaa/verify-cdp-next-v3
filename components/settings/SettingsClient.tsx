'use client';

import {useState} from 'react';
import {Check, EyeOff, Infinity as InfinityIcon, Loader2, Save, ScanLine, Settings2} from 'lucide-react';
import {ApiClientError, fetchApi} from '@/lib/api-client';

type SettingEntry = {
  parameter: string;
  value: string | null;
  updated_at: string | null;
};

function parseMaxScan(value: string | null): string {
  if (value == null) return '10';
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? String(parsed) : '10';
}

const HVALUE_ALPHABET = /^[A-Za-z0-9]+$/;

function isHvalueInvalid(value: string): boolean {
  if (!value.trim()) return true;
  return value.length > 7 || !HVALUE_ALPHABET.test(value.trim());
}

export function SettingsClient({initialSettings}: {initialSettings: SettingEntry[]}) {
  const maxScanEntry = initialSettings.find((entry) => entry.parameter === 'max_scan');
  const hvalueEntry = initialSettings.find((entry) => entry.parameter === 'hvalue');
  const [maxScan, setMaxScan] = useState(parseMaxScan(maxScanEntry?.value ?? null));
  const [hvalue, setHvalue] = useState(hvalueEntry?.value ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(maxScanEntry?.updated_at ?? null);

  const isUnlimited = maxScan === '0';
  const hvalueInvalid = isHvalueInvalid(hvalue);

  const resetFeedback = () => {
    setError('');
    setSuccess('');
  };

  const requestSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (isHvalueInvalid(hvalue)) {
      setError('Hidden value harus 1–7 karakter, hanya huruf atau angka.');
      return;
    }

    setConfirmOpen(true);
  };

  const performSave = async () => {
    resetFeedback();
    setSaving(true);

    try {
      const result = await fetchApi<SettingEntry[]>('/api/settings', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({max_scan: maxScan, hvalue: hvalue.trim()}),
      });

      const updatedMaxScan = result.data.find((entry) => entry.parameter === 'max_scan');
      const updatedHvalue = result.data.find((entry) => entry.parameter === 'hvalue');
      setMaxScan(parseMaxScan(updatedMaxScan?.value ?? null));
      setHvalue(updatedHvalue?.value ?? hvalue.trim());
      setLastUpdated(updatedMaxScan?.updated_at ?? updatedHvalue?.updated_at ?? null);
      setSuccess('Pengaturan berhasil disimpan.');
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : 'Gagal menyimpan pengaturan.';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const dateFormatter = new Intl.DateTimeFormat('id-ID', {dateStyle: 'medium', timeStyle: 'short'});

  return (
    <section className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.05)] lg:p-8">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">
        <Settings2 className="h-4 w-4" />
        Setting
      </div>

      <div className="mt-4 space-y-6">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <span className="mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={requestSave} className="space-y-6">
          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-[0_10px_30px_rgba(8,145,178,0.22)]">
                <ScanLine className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-950">Batas Maksimum Scan</h3>
                  {isUnlimited && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800">
                      <InfinityIcon className="h-3 w-3" />
                      Tanpa batas
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Jumlah maksimum kali satu produk boleh dipindai dan tetap dinyatakan autentik. Pada pemindaian ke-{maxScan === '0' ? 'n' : Number(maxScan) + 1} untuk produk yang sama, status akan menjadi COUNTERFEIT.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nilai batas</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={maxScan}
                  onChange={(event) => {
                    resetFeedback();
                    setMaxScan(event.target.value);
                  }}
                  className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                  placeholder="10"
                />
              </label>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isUnlimited}
                    onChange={(event) => {
                      resetFeedback();
                      setMaxScan(event.target.checked ? '0' : '10');
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-700 accent-cyan-700"
                  />
                  Tanpa batas (0)
                </label>
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-400">
              Isi <span className="font-semibold text-slate-600">0</span> untuk menonaktifkan batas scan (tanpa batas).
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-700 text-white shadow-[0_10px_30px_rgba(8,145,178,0.22)]">
                <EyeOff className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-950">Hidden Value</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Nilai tersembunyi global yang dipakai sebagai QR anchor pada generator. Nilai ini menggantikan input hidden value di halaman generator yang kini bersifat read-only.
                </p>
              </div>
            </div>

            <label className="mt-5 flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nilai hidden value</span>
              <input
                type="text"
                value={hvalue}
                onChange={(event) => {
                  resetFeedback();
                  setHvalue(event.target.value.toUpperCase());
                }}
                maxLength={7}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={hvalueInvalid}
                className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
                placeholder="DOTVERA"
              />
            </label>

            <p className="mt-3 text-xs text-slate-400">
              Maksimal 7 karakter, hanya huruf (A-Z/a-z) atau angka (0-9).
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              {lastUpdated ? `Terakhir diperbarui: ${dateFormatter.format(new Date(lastUpdated))}` : 'Belum pernah diperbarui.'}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(8,145,178,0.25)] transition hover:bg-cyan-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-[2rem] border border-cyan-100 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-700">Konfirmasi simpan</div>
            <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Simpan pengaturan ini?</h3>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              Perubahan akan disimpan ke database dan langsung memengaruhi proses generator maupun verifikasi.
            </p>
            <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Batas scan</div>
                <div className="mt-1 font-mono text-xl font-black text-slate-950">{isUnlimited ? 'Tanpa batas' : maxScan}</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Hidden value</div>
                <div className="mt-1 font-mono text-xl font-black text-slate-950">{hvalue || '—'}</div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 px-6 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  void performSave();
                }}
                disabled={saving}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-cyan-700 px-6 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Menyimpan...' : 'Ya, simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
