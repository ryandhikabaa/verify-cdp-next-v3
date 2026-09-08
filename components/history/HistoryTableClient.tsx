"use client";

import Link from 'next/link';
import {useMemo, useState} from 'react';
import {ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Copy, Download, Eye, ExternalLink, MapPin} from 'lucide-react';
import {HistoryDetailsModal} from '@/components/history/HistoryDetailsModal';

type HistoryRow = {
  id: string;
  deviceID: string;
  source: string;
  clientInfo?: string | null;
  status: string;
  notes: string | null;
  validationPayloadBase64: string | null;
  qrPayload: string | null;
  patternDecodePayload: string | null;
  qrHvalue: string | null;
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
    return '—';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

type HistorySort = 'payload' | 'source' | 'status' | 'device' | 'location' | 'time';
type SortDirection = 'asc' | 'desc';

function buildHistoryHref(search: string, status: string, source: string, page: number, sort: HistorySort, direction: SortDirection) {
  const params = new URLSearchParams();

  if (search) params.set('search', search);
  if (status && status !== 'ALL') params.set('status', status);
  if (source && source !== 'ALL') params.set('source', source);
  params.set('sort', sort);
  params.set('direction', direction);
  if (page > 1) params.set('page', String(page));

  const query = params.toString();
  return query ? `/app/history?${query}` : '/app/history';
}

function buildExportHref(search: string, status: string, source: string) {
  const params = new URLSearchParams();

  if (search) params.set('search', search);
  if (status && status !== 'ALL') params.set('status', status);
  if (source && source !== 'ALL') params.set('source', source);

  const query = params.toString();
  return query ? `/api/history/export?${query}` : '/api/history/export';
}

export function HistoryTableClient({
  historyRows,
  search,
  status,
  source,
  sort,
  direction,
  filteredCount,
  totalPages,
  safeCurrentPage,
  pageStart,
  pageEnd,
}: {
  historyRows: HistoryRow[];
  search: string;
  status: string;
  source: string;
  sort: HistorySort;
  direction: SortDirection;
  filteredCount: number;
  totalPages: number;
  safeCurrentPage: number;
  pageStart: number;
  pageEnd: number;
}) {
  const [selectedDetail, setSelectedDetail] = useState<HistoryRow | null>(null);
  const [copiedDeviceId, setCopiedDeviceId] = useState<string | null>(null);

  const pageNumbers = useMemo(
    () =>
      Array.from({length: totalPages}, (_, index) => index + 1).filter(
        (page) => page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 1,
      ),
    [safeCurrentPage, totalPages],
  );

  const handleCopyDeviceId = async (deviceID: string) => {
    try {
      await navigator.clipboard.writeText(deviceID);
      setCopiedDeviceId(deviceID);
      window.setTimeout(() => {
        setCopiedDeviceId((current) => (current === deviceID ? null : current));
      }, 1800);
    } catch {
      setCopiedDeviceId(null);
    }
  };

  const sortHref = (column: HistorySort) => buildHistoryHref(
    search,
    status,
    source,
    1,
    column,
    sort === column && direction === 'asc' ? 'desc' : 'asc',
  );

  const sortIcon = (column: HistorySort) => {
    if (sort !== column) return <ArrowUpDown className="h-3 w-3 opacity-45" />;
    return direction === 'asc' ? <ArrowUp className="h-3 w-3 text-cyan-700" /> : <ArrowDown className="h-3 w-3 text-cyan-700" />;
  };

  const sortableHeader = (column: HistorySort, label: string, align: 'left' | 'center' = 'left') => (
    <Link
      href={sortHref(column)}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap transition hover:text-cyan-700 ${align === 'center' ? 'justify-center' : ''}`}
      aria-label={`Urutkan berdasarkan ${label}`}
    >
      {label}
      {sortIcon(column)}
    </Link>
  );

  return (
    <>
      {historyRows.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">Belum ada history verifikasi.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="min-w-[1060px]">
              <div className="grid grid-cols-[minmax(150px,1.25fr)_100px_120px_minmax(160px,1fr)_190px_170px_64px] items-center gap-5 border-b border-slate-200 bg-slate-50 px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            <div>{sortableHeader('payload', 'Payload')}</div>
            <div>{sortableHeader('source', 'Source')}</div>
            <div>{sortableHeader('status', 'Status')}</div>
            <div>{sortableHeader('device', 'Device')}</div>
            <div>{sortableHeader('location', 'Lokasi')}</div>
            <div>{sortableHeader('time', 'Waktu')}</div>
            <div className="text-center">Aksi</div>
          </div>

          <div className="divide-y divide-slate-200">
            {historyRows.map((row) => (
              <div key={row.id} className="px-5 py-4 transition hover:bg-slate-50/70">
                <div className="grid grid-cols-[minmax(150px,1.25fr)_100px_120px_minmax(160px,1fr)_190px_170px_64px] items-center gap-5">
                  <button type="button" onClick={() => setSelectedDetail(row)} className="min-w-0 text-left">
                    <div className="truncate font-mono text-sm font-black text-slate-900">{row.patternDecodePayload ?? row.id}</div>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <div className="truncate text-xs text-slate-500" title={row.qrPayload ?? ''}>
                        <span className="mr-1 font-semibold text-slate-400">QR:</span>
                        <span className="font-mono">{row.qrPayload ?? '—'}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500" title={row.patternDecodePayload ?? ''}>
                        <span className="mr-1 font-semibold text-slate-400">Payload:</span>
                        <span className="font-mono">{row.patternDecodePayload ?? '—'}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500" title={row.qrHvalue ?? ''}>
                        <span className="mr-1 font-semibold text-slate-400">Hidden:</span>
                        <span className="font-mono">{row.qrHvalue ?? '—'}</span>
                      </div>
                    </div>
                  </button>

                  <div>
                    <span className="inline-flex rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-bold text-cyan-800">
                      {row.source}
                    </span>
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${statusStyles[row.status] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                      {row.status}
                    </span>
                  </div>

                  <div className="min-w-0 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedDetail(row)} className="min-w-0 flex-1 text-left">
                        <div className="truncate font-semibold text-slate-800">{row.deviceID}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyDeviceId(row.deviceID)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        title="Copy device ID"
                        aria-label={`Copy device ID ${row.deviceID}`}
                      >
                        {copiedDeviceId === row.deviceID ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="min-w-0 text-sm text-slate-600">
                    {row.latitude != null && row.longitude != null ? (
                      <a
                        href={`https://www.google.com/maps?q=${row.latitude},${row.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="grid grid-cols-[14px_minmax(0,1fr)_14px] items-center gap-2 text-cyan-700 transition hover:text-cyan-800"
                        title="Open in Google Maps"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="min-w-0 leading-5">{formatLocation(row.latitude, row.longitude)}</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <div className="inline-flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-cyan-700" />
                        <span>{formatLocation(row.latitude, row.longitude)}</span>
                      </div>
                    )}
                  </div>

                  <div className="whitespace-nowrap text-sm text-slate-600">{dateTimeFormatter.format(new Date(row.createdAt))}</div>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(row)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      title="Detail"
                      aria-label={`Detail ${row.patternDecodePayload ?? row.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span>
                Menampilkan <span className="font-bold text-slate-700">{pageStart}-{pageEnd}</span> dari <span className="font-bold text-slate-700">{filteredCount.toLocaleString('id-ID')}</span> data
              </span>
              <a
                href={buildExportHref(search, status, source)}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-800 transition hover:bg-cyan-100"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href={buildHistoryHref(search, status, source, Math.max(1, safeCurrentPage - 1), sort, direction)}
                aria-disabled={safeCurrentPage === 1}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${
                  safeCurrentPage === 1
                    ? 'pointer-events-none cursor-not-allowed border-slate-200 bg-white text-slate-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
                title="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Link>

              <div className="flex items-center gap-1">
                {pageNumbers.map((pageNumber, index) => {
                  const previousPage = pageNumbers[index - 1];
                  const showEllipsis = index > 0 && previousPage !== undefined && pageNumber - previousPage > 1;

                  return (
                    <div key={pageNumber} className="flex items-center gap-1">
                      {showEllipsis ? <span className="px-1 text-xs text-slate-400">...</span> : null}
                      <Link
                        href={buildHistoryHref(search, status, source, pageNumber, sort, direction)}
                        className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition ${
                          pageNumber === safeCurrentPage
                            ? 'bg-cyan-700 text-white'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {pageNumber}
                      </Link>
                    </div>
                  );
                })}
              </div>

              <Link
                href={buildHistoryHref(search, status, source, Math.min(totalPages, safeCurrentPage + 1), sort, direction)}
                aria-disabled={safeCurrentPage === totalPages}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-semibold transition ${
                  safeCurrentPage === totalPages
                    ? 'pointer-events-none cursor-not-allowed border-slate-200 bg-white text-slate-300'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
                title="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </>
      )}

      <HistoryDetailsModal open={selectedDetail !== null} detail={selectedDetail} onClose={() => setSelectedDetail(null)} />
    </>
  );
}
