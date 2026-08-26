import {ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Eye, Filter, LoaderCircle, Search, Trash2, X} from 'lucide-react';
import {useEffect, useMemo, useState} from 'react';
import {Card} from '@/components/ui/Card';
import {docToSettings} from '@/lib/pattern-helpers';
import type {GeneratorSettings, PatternDoc, PatternPreview} from '@/lib/types';
import type {usePatternLibrary} from '@/hooks/usePatternLibrary';

type PatternLibraryState = ReturnType<typeof usePatternLibrary>;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
type PayloadStatusFilter = 'all' | 'complete' | 'missing_payload' | 'has_qr' | 'missing_qr';

function getCreatedTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatCreatedAt(value?: string) {
  if (!value) return 'Tanggal tidak tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tanggal tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatOptional(value: unknown) {
  if (value === undefined || value === null || value === '') return 'Tidak tersedia';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(4);
  return String(value);
}

function getPayload1(doc: PatternDoc) {
  return doc.payload_1 ?? doc.pattern_payload ?? doc.payload ?? '';
}

function getPayload2(doc: PatternDoc) {
  return doc.payload_2 ?? '';
}

function getQrPayload(doc: PatternDoc) {
  return doc.payload_qr ?? doc.qr_payload ?? '';
}

function hasText(value: unknown) {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

function shortValue(value: unknown, maxLength = 34) {
  const text = formatOptional(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function getSearchCorpus(doc: PatternDoc) {
  return [
    doc.id,
    doc.label,
    getPayload1(doc),
    getPayload2(doc),
    getQrPayload(doc),
    doc.style,
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toUpperCase();
}

function matchesPayloadStatus(doc: PatternDoc, status: PayloadStatusFilter) {
  const hasPayload1 = hasText(getPayload1(doc));
  const hasPayload2 = hasText(getPayload2(doc));
  const hasQr = hasText(getQrPayload(doc));

  if (status === 'complete') return hasPayload1 && hasPayload2 && hasQr;
  if (status === 'missing_payload') return !hasPayload1 || !hasPayload2;
  if (status === 'has_qr') return hasQr;
  if (status === 'missing_qr') return !hasQr;
  return true;
}

function detailRows(doc: PatternDoc) {
  return [
    ['Serial / ID', doc.id],
    ['payload_1', doc.payload_1 ?? doc.pattern_payload ?? doc.payload],
    ['payload_2', doc.payload_2],
    ['payload_qr', doc.payload_qr ?? doc.qr_payload],
    ['Density', `${(doc.density * 100).toFixed(0)}% (${doc.density})`],
    ['Size', doc.size ? `${doc.size} × ${doc.size}` : undefined],
    ['Style', doc.style],
    ['Layout version', doc.layout_version],
    ['Created at', doc.created_at ? formatCreatedAt(doc.created_at) : undefined],
  ] as const;
}

/** Renders the stored random-pattern catalog, filters, and batch actions. */
export function StoredPatternsPanel({
  settings,
  patternLibrary,
  setPreviewSettings,
  setPreviewDoc,
  downloadDoc,
  downloadSelectedDocs,
}: {
  settings: GeneratorSettings;
  patternLibrary: PatternLibraryState;
  setPreviewSettings: (settings: GeneratorSettings | null) => void;
  setPreviewDoc: (preview: PatternPreview | null) => void;
  downloadDoc: (doc: PatternLibraryState['docsList'][number]) => void;
  downloadSelectedDocs: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
  const [detailTargetDoc, setDetailTargetDoc] = useState<PatternDoc | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [seedLengthFilter, setSeedLengthFilter] = useState(0);
  const [payloadStatusFilter, setPayloadStatusFilter] = useState<PayloadStatusFilter>('all');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest');

  const filteredDocs = useMemo(() => {
    const query = searchQuery.trim().toUpperCase();
    return patternLibrary.docsList
      .filter((doc) => (
        (!query || getSearchCorpus(doc).includes(query))
        && (!seedLengthFilter || doc.id.length === seedLengthFilter)
        && matchesPayloadStatus(doc, payloadStatusFilter)
        && (!selectedOnly || patternLibrary.selectedDocIds.includes(doc.id))
      ))
      .sort((first, second) => {
        const difference = getCreatedTimestamp(first.created_at) - getCreatedTimestamp(second.created_at);
        return dateSort === 'oldest' ? difference : -difference;
      });
  }, [dateSort, patternLibrary.docsList, patternLibrary.selectedDocIds, payloadStatusFilter, searchQuery, seedLengthFilter, selectedOnly]);

  const allFilteredSelected = filteredDocs.length > 0 && filteredDocs.every((doc) => patternLibrary.selectedDocIds.includes(doc.id));

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / pageSize));
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({length: totalPages}, (_, index) => index + 1);
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateSort, payloadStatusFilter, searchQuery, seedLengthFilter, selectedOnly]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedDocs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredDocs.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredDocs, pageSize]);

  const allCurrentPageSelected = paginatedDocs.length > 0 && paginatedDocs.every((doc) => patternLibrary.selectedDocIds.includes(doc.id));
  const hasActiveFilters = Boolean(searchQuery.trim()) || seedLengthFilter > 0 || payloadStatusFilter !== 'all' || selectedOnly;

  const pageStart = filteredDocs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredDocs.length);
  const selectedDocsForDelete = useMemo(() => patternLibrary.docsList.filter((doc) => patternLibrary.selectedDocIds.includes(doc.id)), [patternLibrary.docsList, patternLibrary.selectedDocIds]);

  const clearSelection = () => {
    if (patternLibrary.selectedDocIds.length > 0) {
      patternLibrary.selectDocs(patternLibrary.selectedDocIds);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSeedLengthFilter(0);
    setPayloadStatusFilter('all');
    setSelectedOnly(false);
  };

  useEffect(() => {
    if (!deleteTargetId && !detailTargetDoc && !bulkDeleteConfirmOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isDeleting) {
          setDeleteTargetId(null);
          setDetailTargetDoc(null);
          setBulkDeleteConfirmOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bulkDeleteConfirmOpen, deleteTargetId, detailTargetDoc, isDeleting]);

  return (
    <Card title="Generated Data" variant="public">
      <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
        <div className="flex flex-col gap-3 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(236,254,255,0.5)_48%,rgba(255,255,255,0.98))] p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">Generated Data</div>
          <div className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">Kelola pattern tersimpan, validasi payload, lalu pilih data yang ingin diunduh.</div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <div className="rounded-xl border border-cyan-100 bg-white/90 px-3 py-1.5 text-center shadow-sm shadow-cyan-100/60 sm:min-w-24">
            <div className="text-[9px] font-black uppercase tracking-wider text-cyan-700">Total</div>
            <div className="mt-0.5 text-sm font-black text-slate-950">{patternLibrary.docsList.length} data</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-center shadow-sm shadow-slate-100 sm:min-w-24">
            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Terpilih</div>
            <div className="mt-0.5 text-sm font-black text-cyan-800">{patternLibrary.selectedDocIds.length} data</div>
          </div>
        </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 shadow-sm shadow-slate-100 sm:p-3">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.5fr)_170px_205px_160px] lg:items-end">
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Cari Data</span>
          <div className="flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm shadow-slate-100 transition focus-within:border-cyan-300 focus-within:ring-4 focus-within:ring-cyan-100/70">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ID, label, payload, QR, style" className="min-w-0 flex-1 bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm" />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Panjang Seed</span>
          <select value={seedLengthFilter} onChange={(event) => setSeedLengthFilter(Number(event.target.value))} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-100 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/70 sm:text-sm">
            <option value={0}>Semua panjang</option>
            {Array.from({length: 12}, (_, index) => index + 1).map((length) => <option key={length} value={length}>{length} karakter</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Status Payload</span>
          <select value={payloadStatusFilter} onChange={(event) => setPayloadStatusFilter(event.target.value as PayloadStatusFilter)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-100 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/70 sm:text-sm">
            <option value="all">Semua status</option>
            <option value="complete">Lengkap + QR</option>
            <option value="missing_payload">Payload belum lengkap</option>
            <option value="has_qr">Memiliki QR</option>
            <option value="missing_qr">QR belum tersedia</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-slate-400">Urutan</span>
          <select value={dateSort} onChange={(event) => setDateSort(event.target.value as 'newest' | 'oldest')} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm shadow-slate-100 outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-100/70 sm:text-sm">
            <option value="newest">Terbaru dahulu</option>
            <option value="oldest">Terlama dahulu</option>
          </select>
        </label>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2.5">
        <div className="mr-1 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[10px] font-bold text-slate-600 shadow-sm shadow-slate-100">
          <Filter className="h-3.5 w-3.5 text-cyan-700" />
          {filteredDocs.length} dari {patternLibrary.docsList.length} data
        </div>
        <button
          type="button"
          onClick={() => setSelectedOnly((current) => !current)}
          disabled={patternLibrary.selectedDocIds.length === 0}
          className={`min-h-8 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${selectedOnly ? 'border-cyan-200 bg-cyan-50 text-cyan-800 shadow-sm shadow-cyan-100' : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:text-cyan-800'}`}
        >
          Hanya Dipilih
        </button>
        {hasActiveFilters ? (
          <button type="button" onClick={clearFilters} className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white active:scale-[0.98]">
            Reset Filter
          </button>
        ) : null}
      </div>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(236,254,255,0.82),rgba(248,250,252,0.8))] p-2.5 shadow-sm shadow-cyan-100/60 sm:p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-700">Bulk actions</div>
          <div className="mt-0.5 text-xs font-semibold text-slate-600"><span className="font-black text-cyan-900">{patternLibrary.selectedDocIds.length}</span> data dipilih dari hasil yang tersedia.</div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex min-h-8 items-center rounded-lg bg-white/90 px-2.5 text-[10px] font-black text-cyan-900 shadow-sm shadow-cyan-100/60" aria-live="polite">
          {patternLibrary.selectedDocIds.length} dipilih
        </div>
        <button
          type="button"
          onClick={() => patternLibrary.selectDocs(filteredDocs.map((doc) => doc.id))}
          disabled={filteredDocs.length === 0}
          className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          title={allFilteredSelected ? 'Batalkan pilihan semua hasil filter' : 'Pilih semua data sesuai filter aktif'}
        >
          {allFilteredSelected ? 'Batal Pilih Hasil Filter' : 'Pilih Hasil Filter'}
        </button>
        <button
          type="button"
          onClick={() => patternLibrary.selectDocs(paginatedDocs.map((doc) => doc.id))}
          disabled={paginatedDocs.length === 0}
          className="min-h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          title={allCurrentPageSelected ? 'Batalkan pilihan halaman ini' : 'Pilih semua data di halaman ini'}
        >
          {allCurrentPageSelected ? 'Batal Pilih Halaman' : 'Pilih Halaman Ini'}
        </button>
        <button
          type="button"
          onClick={async () => {
            setIsDownloadingSelected(true);
            try {
              await downloadSelectedDocs();
            } finally {
              setIsDownloadingSelected(false);
            }
          }}
          disabled={isDownloadingSelected || patternLibrary.selectedDocIds.length === 0}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-cyan-700 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm shadow-cyan-200 transition hover:bg-cyan-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          title={isDownloadingSelected ? 'Sedang menyiapkan file download' : 'Download semua data yang dipilih'}
        >
          {isDownloadingSelected ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {isDownloadingSelected ? 'Menyiapkan...' : 'Download Pilihan'}
        </button>
        <button
          type="button"
          onClick={() => setBulkDeleteConfirmOpen(true)}
          disabled={patternLibrary.selectedDocIds.length === 0}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-rose-700 shadow-sm shadow-rose-100 transition hover:bg-rose-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          title="Hapus semua data yang dipilih"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Hapus Pilihan
        </button>
        {patternLibrary.selectedDocIds.length > 0 ? (
          <button type="button" onClick={clearSelection} className="min-h-8 rounded-lg border border-cyan-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-cyan-800 transition hover:bg-cyan-50 active:scale-[0.98]">
            Bersihkan Pilihan
          </button>
        ) : null}
        </div>
      </div>

      {patternLibrary.docsList.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-cyan-200 bg-[linear-gradient(135deg,rgba(236,254,255,0.58),rgba(248,250,252,0.9))] p-5 text-center shadow-sm shadow-cyan-100/50 sm:p-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-100 bg-white text-cyan-700 shadow-sm shadow-cyan-100">
            <Search className="h-4 w-4" />
          </div>
          <h3 className="mt-3 text-sm font-black tracking-[-0.03em] text-slate-950 sm:text-base">Belum ada data generator</h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500 sm:text-sm">Data yang berhasil dibuat akan tampil di sini lengkap dengan payload, QR, preview, dan aksi download.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-100">
          <div className="hidden grid-cols-[30px_minmax(260px,0.95fr)_minmax(260px,1.1fr)_140px_124px] items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-400 xl:grid">
            <div className="text-center">Pilih</div>
            <div>Identitas & Pattern</div>
            <div>Payload & QR</div>
            <button
              type="button"
              onClick={() => setDateSort((current) => current === 'newest' ? 'oldest' : 'newest')}
              className="inline-flex w-fit items-center gap-1.5 rounded-md py-1 text-left transition hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              aria-label={`Urutkan Created At ${dateSort === 'newest' ? 'terlama dahulu' : 'terbaru dahulu'}`}
              title={dateSort === 'newest' ? 'Terbaru dahulu' : 'Terlama dahulu'}
            >
              Created At
              {dateSort === 'newest' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            </button>
            <div className="text-center">Aksi</div>
          </div>

          <div className="divide-y divide-slate-100">
          {paginatedDocs.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400">
                <Filter className="h-4 w-4" />
              </div>
              <h3 className="mt-3 text-sm font-black tracking-[-0.03em] text-slate-950 sm:text-base">Tidak ada hasil yang cocok</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-500 sm:text-sm">Coba ubah kata kunci, status payload, panjang seed, atau matikan filter hanya dipilih.</p>
              {hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className="mt-4 min-h-8 rounded-lg border border-cyan-200 bg-white px-3 text-[11px] font-bold text-cyan-800 transition hover:bg-cyan-50 active:scale-[0.98]">
                  Reset filter
                </button>
              ) : null}
            </div>
          ) : null}
          {paginatedDocs.map((doc, index) => {
            const payload1 = getPayload1(doc);
            const payload2 = getPayload2(doc);
            const qrPayload = getQrPayload(doc);
            const displayLabel = doc.label?.trim();
            const shouldShowLabel = displayLabel && displayLabel.toUpperCase() !== doc.id.toUpperCase();

            return (
            <div
              key={doc.id}
              role="button"
              tabIndex={0}
              onClick={() => setDetailTargetDoc(doc)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setDetailTargetDoc(doc);
                }
              }}
              className={`grid cursor-pointer grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 px-3 py-2 transition sm:px-3.5 xl:grid-cols-[28px_minmax(260px,0.95fr)_minmax(260px,1.1fr)_140px_124px] xl:items-center xl:gap-2.5 ${patternLibrary.selectedDocIds.includes(doc.id) ? 'bg-cyan-50 ring-1 ring-inset ring-cyan-200' : index % 2 === 0 ? 'bg-white hover:bg-cyan-50/60' : 'bg-slate-100/70 hover:bg-cyan-50/70'}`}
              aria-label={`Lihat detail ${doc.id}`}
            >
              <div className="flex items-start justify-center pt-1 lg:items-center lg:pt-0">
                <input
                  type="checkbox"
                  checked={patternLibrary.selectedDocIds.includes(doc.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => patternLibrary.toggleDocSelection(doc.id)}
                  className="h-4 w-4 shrink-0 accent-cyan-700"
                  aria-label={`Pilih ${doc.id}`}
                />
              </div>

              <div className="min-w-0 rounded-lg px-2 py-1.5 text-left transition xl:h-full">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-700 text-[9px] font-black text-white shadow-sm shadow-cyan-100">#{(currentPage - 1) * pageSize + index + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs font-black leading-4 text-slate-900">{doc.id}</div>
                    {shouldShowLabel ? <div className="mt-0.5 truncate text-[10px] font-semibold leading-3 text-slate-500">{displayLabel}</div> : null}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-bold text-slate-500">
                  <span>D {(doc.density * 100).toFixed(0)}%</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="text-cyan-800">{doc.id.length} char</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>{doc.size ?? 64}×{doc.size ?? 64}</span>
                </div>
                <div className="mt-0.5 truncate text-[9px] font-semibold text-slate-400" title={doc.style ?? 'stochastic_noise'}>
                  {doc.style ?? 'stochastic_noise'}
                </div>
              </div>

              <div className="col-start-2 min-w-0 border-t border-slate-100 pt-1.5 xl:col-start-auto xl:border-l xl:border-t-0 xl:pl-3 xl:pt-0">
                <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="min-w-0">
                    <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">payload_1</div>
                    <div className={`truncate font-mono text-[10px] font-bold leading-4 ${hasText(payload1) ? 'text-slate-800' : 'text-amber-700'}`} title={formatOptional(payload1)}>
                      {shortValue(payload1)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">payload_2</div>
                    <div className={`truncate font-mono text-[10px] font-bold leading-4 ${hasText(payload2) ? 'text-slate-800' : 'text-amber-700'}`} title={formatOptional(payload2)}>
                      {shortValue(payload2)}
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[8px] font-black ${hasText(qrPayload) ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>{hasText(qrPayload) ? 'QR' : 'No QR'}</span>
                  <span className="min-w-0 truncate font-mono text-[10px] font-semibold text-slate-500" title={formatOptional(qrPayload)}>{shortValue(qrPayload, 44)}</span>
                </div>
              </div>

              <div className="col-start-2 text-left xl:col-start-auto">
                <div className="mb-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 lg:hidden">Created At</div>
                <time dateTime={doc.created_at} className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-600 sm:text-[11px]">
                  {formatCreatedAt(doc.created_at)}
                </time>
              </div>

              <div className="col-span-2 flex flex-wrap gap-1.5 xl:col-span-1 xl:justify-center">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDetailTargetDoc(doc);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 shadow-sm shadow-slate-100 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 active:scale-95 xl:w-9 xl:justify-center xl:px-0"
                  aria-label={`Lihat detail ${doc.id}`}
                  title={`Lihat detail ${doc.id}`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="xl:sr-only">Detail</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadDoc(doc);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 text-[10px] font-bold text-cyan-800 shadow-sm shadow-cyan-100 transition hover:bg-cyan-100 active:scale-95 xl:w-9 xl:justify-center xl:px-0"
                  aria-label={`Download ${doc.id}`}
                  title={`Download ${doc.id}`}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="xl:sr-only">Download</span>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTargetId(doc.id);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[10px] font-bold text-rose-700 shadow-sm shadow-rose-100 transition hover:bg-rose-100 active:scale-95 xl:w-9 xl:justify-center xl:px-0"
                  aria-label={`Hapus ${doc.id}`}
                  title={`Hapus ${doc.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="xl:sr-only">Hapus</span>
                </button>
              </div>
            </div>
            );
          })}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-slate-200 bg-slate-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="text-[11px] text-slate-500 sm:text-xs">
                Menampilkan <span className="font-bold text-slate-700">{pageStart}-{pageEnd}</span> dari <span className="font-bold text-slate-700">{filteredDocs.length}</span> data
              </div>

              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 sm:text-xs">
                <span>Per page</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 outline-none transition focus:border-cyan-300"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNumber, index) => {
                  const previousPage = pageNumbers[index - 1];
                  const needsEllipsis = index > 0 && previousPage !== undefined && pageNumber - previousPage > 1;

                  return (
                    <div key={pageNumber} className="flex items-center gap-1">
                      {needsEllipsis ? <span className="px-1 text-xs text-slate-400">...</span> : null}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md px-2 text-[10px] font-semibold transition ${
                          currentPage === pageNumber
                            ? 'bg-cyan-700 text-white'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => {
          if (!isDeleting) setDeleteTargetId(null);
        }}>
          <div className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-600">Delete pattern</div>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Hapus data ini?</h3>
              </div>
              <button
                type="button"
                aria-label="Close delete dialog"
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-500">
              Pattern <span className="font-mono font-bold text-slate-800">{deleteTargetId}</span> akan dihapus dari data generator. Tindakan ini tidak bisa dibatalkan.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = deleteTargetId;
                  if (targetId) {
                    setIsDeleting(true);
                    try {
                      await patternLibrary.deleteDoc(targetId);
                      setDeleteTargetId(null);
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                }}
                disabled={isDeleting}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isDeleting ? 'Menghapus...' : 'Ya, hapus'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {bulkDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" onClick={() => {
          if (!isDeleting) setBulkDeleteConfirmOpen(false);
        }}>
          <div className="w-full max-w-lg rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-600">Bulk delete</div>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">Hapus data terpilih?</h3>
              </div>
              <button
                type="button"
                aria-label="Close bulk delete dialog"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                disabled={isDeleting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-rose-600">Total yang akan dihapus</div>
              <div className="mt-1 text-3xl font-black tracking-[-0.04em] text-rose-700">{patternLibrary.selectedDocIds.length} data</div>
              <p className="mt-2 text-sm leading-6 text-rose-700/80">Tindakan ini akan menghapus data generator terpilih dari database dan tidak bisa dibatalkan.</p>
            </div>

            {selectedDocsForDelete.length > 0 ? (
              <div className="mt-4 max-h-32 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preview data</div>
                <div className="space-y-1.5">
                  {selectedDocsForDelete.slice(0, 6).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-2.5 py-1.5 text-[11px] shadow-sm shadow-slate-100">
                      <span className="min-w-0 truncate font-mono font-bold text-slate-800">{doc.id}</span>
                      <span className="shrink-0 text-slate-400">{formatCreatedAt(doc.created_at)}</span>
                    </div>
                  ))}
                  {selectedDocsForDelete.length > 6 ? <div className="px-2 text-[11px] font-semibold text-slate-500">+{selectedDocsForDelete.length - 6} data lainnya</div> : null}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirmOpen(false)}
                disabled={isDeleting}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetIds = [...patternLibrary.selectedDocIds];
                  setIsDeleting(true);
                  try {
                    await patternLibrary.deleteDocs(targetIds);
                    setBulkDeleteConfirmOpen(false);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting || patternLibrary.selectedDocIds.length === 0}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isDeleting ? `Menghapus ${patternLibrary.selectedDocIds.length} data...` : `Ya, hapus ${patternLibrary.selectedDocIds.length} data`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailTargetDoc ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-8" onClick={() => setDetailTargetDoc(null)}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]" onClick={(event) => event.stopPropagation()}>
              <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef9ff_52%,#ffffff_100%)] px-5 py-4 sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">Generated data detail</div>
                    <h3 className="mt-1 truncate font-mono text-xl font-black tracking-[-0.04em] text-slate-950 sm:text-2xl">{detailTargetDoc.label || detailTargetDoc.id}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-bold text-cyan-800">{detailTargetDoc.id.length} karakter</span>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-600">Density {(detailTargetDoc.density * 100).toFixed(0)}%</span>
                      <span className="inline-flex rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-600">{formatCreatedAt(detailTargetDoc.created_at)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Close detail dialog"
                    onClick={() => setDetailTargetDoc(null)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:bg-white hover:text-slate-900"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]">
                <div className="border-b border-slate-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Image Preview</div>
                    <div className="text-[11px] font-semibold text-slate-500">PNG</div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-inner shadow-slate-100">
                    {detailTargetDoc.image_data ? (
                      <img src={detailTargetDoc.image_data} alt={detailTargetDoc.label || detailTargetDoc.id} className="h-full max-h-[280px] w-full object-contain bg-[radial-gradient(circle_at_top,rgba(224,242,254,0.72),rgba(255,255,255,0.96))] [image-rendering:pixelated]" />
                    ) : (
                      <div className="flex min-h-[240px] items-center justify-center px-6 text-center text-sm text-slate-500">Preview gambar belum tersedia untuk data ini.</div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50/70 p-5 sm:p-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {detailRows(detailTargetDoc).map(([label, value]) => (
                      <section key={label} className={`${label === 'payload_qr' || label === 'Serial / ID' ? 'sm:col-span-2' : ''} rounded-[1.1rem] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100`}>
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-700">{label}</div>
                        <div className="mt-2 break-all font-mono text-sm font-semibold leading-6 text-slate-800">{formatOptional(value)}</div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
