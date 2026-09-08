import type {Prisma} from '@prisma/client';
import {Globe, History, ScanLine, Search, ShieldCheck, Smartphone} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {HistoryTableClient} from '@/components/history/HistoryTableClient';
import {detectVerificationSource} from '@/lib/cdp/verification-source';
import {buildDetectionListWhere} from '@/lib/db/detections';
import {prisma} from '@/lib/db/prisma';

const numberFormatter = new Intl.NumberFormat('id-ID');
const PAGE_SIZE = 10;
const HISTORY_SORT_COLUMNS = {
  payload: 'patternDecodePayload',
  source: 'deviceID',
  status: 'status',
  device: 'deviceID',
  location: 'latitude',
  time: 'createdAt',
} as const;

function toPercent(value: number, total: number) {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0%';
}

export default async function VerificationHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const search = typeof resolvedSearchParams.search === 'string' ? resolvedSearchParams.search.trim() : '';
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status.trim().toUpperCase() : 'ALL';
  const source = typeof resolvedSearchParams.source === 'string' ? resolvedSearchParams.source.trim().toUpperCase() : 'ALL';
  const pageValue = typeof resolvedSearchParams.page === 'string' ? Number(resolvedSearchParams.page) : 1;
  const currentPage = Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1;
  const requestedSort = typeof resolvedSearchParams.sort === 'string' ? resolvedSearchParams.sort : 'time';
  const sort = requestedSort in HISTORY_SORT_COLUMNS ? requestedSort as keyof typeof HISTORY_SORT_COLUMNS : 'time';
  const direction = resolvedSearchParams.direction === 'asc' ? 'asc' : 'desc';
  const sortField = HISTORY_SORT_COLUMNS[sort];
  const orderBy: Prisma.PatternDetectionOrderByWithRelationInput[] = [
    {[sortField]: direction},
    {createdAt: 'desc'},
  ];
  const where = buildDetectionListWhere({search, status, source});

  const [historyRowsRaw, filteredCount, totalCount, authenticCount, counterfeitCount, mismatchCount, devices, webCount, mobileCount] = await Promise.all([
    prisma.patternDetection.findMany({
      where,
      orderBy,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.patternDetection.count({where}),
    prisma.patternDetection.count(),
    prisma.patternDetection.count({where: {status: 'AUTHENTIC'}}),
    prisma.patternDetection.count({where: {status: 'COUNTERFEIT'}}),
    prisma.patternDetection.count({where: {status: 'MISMATCH'}}),
    prisma.patternDetection.findMany({select: {deviceID: true}, distinct: ['deviceID']}),
    prisma.patternDetection.count({where: {deviceID: {startsWith: 'WEB-', mode: 'insensitive'}}}),
    prisma.patternDetection.count({where: {NOT: {deviceID: {startsWith: 'WEB-', mode: 'insensitive'}}}}),
  ]);

  const devicesCount = devices.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = filteredCount === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safeCurrentPage * PAGE_SIZE, filteredCount);
  const statusOptions = ['ALL', 'AUTHENTIC', 'COUNTERFEIT', 'MISMATCH'];
  const sourceOptions = ['ALL', 'WEB', 'MOBILE'];
  const historyRows = historyRowsRaw.map((row) => ({
    id: row.id,
    deviceID: row.deviceID,
    source: detectVerificationSource(row.deviceID),
    status: row.status,
    notes: row.notes,
    validationPayloadBase64: row.patternDecodePayload
      ? Buffer.from(row.patternDecodePayload, 'latin1').toString('base64')
      : null,
    qrPayload: row.qrPayload,
    patternDecodePayload: row.patternDecodePayload,
    qrHvalue: row.qrHvalue,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.createdAt.toISOString(),
    imageData: row.imageData,
  }));

  return (
    <AppShell activeTab="history">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.05)] lg:p-8">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">
          <History className="h-4 w-4" />
          History
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.03)] lg:p-5">
          <div className="grid gap-3 xl:grid-cols-[1.85fr_1fr]">
            <div className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Total Verification</div>
                  <div className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">{numberFormatter.format(totalCount)}</div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <ScanLine className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">Riwayat verifikasi yang tersimpan</div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Status Distribution</div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-emerald-900">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">AUTHENTIC</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.04em]">{numberFormatter.format(authenticCount)}</div>
                  <div className="mt-1 text-[11px] text-emerald-800/80">{toPercent(authenticCount, totalCount)} dari total</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-3 py-3 text-amber-900">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700">COUNTERFEIT</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.04em]">{numberFormatter.format(counterfeitCount)}</div>
                  <div className="mt-1 text-[11px] text-amber-800/80">{toPercent(counterfeitCount, totalCount)} dari total</div>
                </div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-3 py-3 text-violet-900">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-700">MISMATCH</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.04em]">{numberFormatter.format(mismatchCount)}</div>
                  <div className="mt-1 text-[11px] text-violet-800/80">{toPercent(mismatchCount, totalCount)} dari total</div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Active Sources</div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Globe className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{numberFormatter.format(webCount + mobileCount)}</div>
                <div className="mt-1 text-xs text-slate-500">WEB {numberFormatter.format(webCount)} · MOBILE {numberFormatter.format(mobileCount)}</div>
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Unique Device</div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                    <Smartphone className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-950">{numberFormatter.format(devicesCount)}</div>
                <div className="mt-1 text-xs text-slate-500">Perangkat yang pernah scan</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-5">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Recent Verification</div>
              <div className="mt-1 text-sm text-slate-500">Data histori verifikasi dengan pencarian dan filter status.</div>
            </div>
            <div className="inline-flex items-center rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[11px] font-bold text-cyan-800">
              {numberFormatter.format(filteredCount)} data
            </div>
          </div>

          <form className="grid gap-3 border-b border-slate-200 bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_120px] lg:px-5" method="get">
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="direction" value={direction} />
            <label className="relative block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Search</span>
              <Search className="pointer-events-none absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
              <input
                type="text"
                name="search"
                defaultValue={search}
                placeholder="Cari label atau device"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Status</span>
              <select
                name="status"
                defaultValue={status}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'Semua Status' : option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Source</span>
              <select
                name="source"
                defaultValue={source}
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-300"
              >
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === 'ALL' ? 'Semua Source' : option}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="mt-[18px] min-h-11 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-800"
            >
              Terapkan
            </button>
          </form>

          <HistoryTableClient
            historyRows={historyRows}
            search={search}
            status={status}
            source={source}
            sort={sort}
            direction={direction}
            filteredCount={filteredCount}
            totalPages={totalPages}
            safeCurrentPage={safeCurrentPage}
            pageStart={pageStart}
            pageEnd={pageEnd}
          />
        </div>
      </section>
    </AppShell>
  );
}