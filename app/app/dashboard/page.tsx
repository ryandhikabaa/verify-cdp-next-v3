import {BarChart3, Grid2X2, ShieldCheck, Smartphone, Users} from 'lucide-react';
import {AppShell} from '@/components/AppShell';
import {VerificationMapCard} from '@/components/dashboard/VerificationMapCardClient';
import {detectVerificationSource} from '@/lib/cdp/verification-source';
import {prisma} from '@/lib/db/prisma';

const numberFormatter = new Intl.NumberFormat('id-ID');

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Renders the dashboard landing page for the authenticated app area. */
export default async function DashboardPage() {
  const today = startOfToday();
  const [patternsCount, verificationsCount, authenticCount, counterfeitCount, mismatchCount, usersCount, todayCount, sourceRows, mapRows] = await Promise.all([
    prisma.patternGenerated.count(),
    prisma.patternDetection.count(),
    prisma.patternDetection.count({where: {status: 'AUTHENTIC'}}),
    prisma.patternDetection.count({where: {status: 'COUNTERFEIT'}}),
    prisma.patternDetection.count({where: {status: 'MISMATCH'}}),
    prisma.user.count(),
    prisma.patternDetection.count({where: {createdAt: {gte: today}}}),
    prisma.patternDetection.findMany({select: {deviceID: true}}),
    prisma.patternDetection.findMany({
      where: {latitude: {not: null}, longitude: {not: null}},
      orderBy: {createdAt: 'desc'},
      take: 150,
      select: {id: true, label: true, status: true, latitude: true, longitude: true, deviceID: true, createdAt: true},
    }),
  ]);

  const sourceCounts = new Map<string, number>();
  for (const row of sourceRows) {
    const source = detectVerificationSource(row.deviceID);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const recentSources = [...sourceCounts.entries()]
    .map(([source, count]) => ({source, count}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const verificationMapPoints = mapRows.flatMap((row) => {
    if (row.latitude == null || row.longitude == null) return [];
    return [{
      id: row.id,
      label: row.label,
      status: row.status,
      latitude: row.latitude,
      longitude: row.longitude,
      source: detectVerificationSource(row.deviceID),
      createdAt: row.createdAt.toISOString(),
    }];
  });
  const toPercent = (value: number) => (verificationsCount > 0 ? `${((value / verificationsCount) * 100).toFixed(1)}%` : '0%');
  const healthScore = verificationsCount > 0 ? Math.round((authenticCount / verificationsCount) * 100) : 0;
  const dominantSource = recentSources[0]?.source ?? '-';
  const verificationStatuses = [
    {
      label: 'AUTHENTIC',
      value: authenticCount,
      percent: toPercent(authenticCount),
      className: 'border-emerald-100 bg-emerald-50/80 text-emerald-950',
      labelClassName: 'text-emerald-700',
    },
    {
      label: 'COUNTERFEIT',
      value: counterfeitCount,
      percent: toPercent(counterfeitCount),
      className: 'border-rose-100 bg-rose-50/80 text-rose-950',
      labelClassName: 'text-rose-700',
    },
    {
      label: 'MISMATCH',
      value: mismatchCount,
      percent: toPercent(mismatchCount),
      className: 'border-orange-100 bg-orange-50/80 text-orange-950',
      labelClassName: 'text-orange-700',
    },
  ];

  return (
    <AppShell activeTab="dashboard">
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.05)] lg:p-6">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-700">
          <BarChart3 className="h-4 w-4" />
          Statistics
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)] lg:p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard title="Patterns Ready" value={numberFormatter.format(patternsCount)} helper="Pattern tersimpan" icon={<Grid2X2 className="h-4 w-4" />} />
                <MetricCard title="Total Verification" value={numberFormatter.format(verificationsCount)} helper="Seluruh riwayat scan" icon={<BarChart3 className="h-4 w-4" />} />
                <MetricCard title="Today" value={numberFormatter.format(todayCount)} helper="Verifikasi hari ini" icon={<ShieldCheck className="h-4 w-4" />} tone="cyan" />
                <MetricCard title="Managed Users" value={numberFormatter.format(usersCount)} helper="Admin internal" icon={<Users className="h-4 w-4" />} />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] lg:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Verification Status</div>
                  <div className="mt-1 text-[13px] font-semibold text-slate-500">Ringkasan performa verifikasi saat ini</div>
                </div>
                <div className="inline-flex rounded-full border border-cyan-100 bg-gradient-to-r from-cyan-50 to-white px-3 py-1 text-[11px] font-bold text-cyan-800 shadow-sm">{healthScore}% health</div>
              </div>

              <div className="mt-4 rounded-[1.45rem] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-3.5">
                <div className="grid gap-3 md:grid-cols-3">
                {verificationStatuses.map((status) => (
                  <div key={status.label} className={`rounded-[1.3rem] border px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ${status.className}`}>
                    <div className={`text-[10px] font-black uppercase tracking-[0.22em] ${status.labelClassName}`}>{status.label}</div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div className="text-3xl font-black tracking-[-0.04em] text-slate-950">{numberFormatter.format(status.value)}</div>
                      <div className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 shadow-sm">
                        {status.percent}
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] font-medium text-slate-500">
                      {status.value === 0 ? 'Belum ada aktivitas' : 'Kontribusi terhadap total verifikasi'}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)] lg:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Top Sources</div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Smartphone className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 space-y-2.5 text-sm font-semibold text-slate-700">
                {recentSources.length > 0 ? (
                  recentSources.map((item, index) => (
                    <div key={item.source} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[11px] font-black text-slate-600">{index + 1}</div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">{item.source}</div>
                          <div className="text-[11px] text-slate-500">Top source</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-slate-950">{numberFormatter.format(item.count)}</div>
                        <div className="text-[11px] text-slate-500">{toPercent(item.count)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">Belum ada data source.</div>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.03)] lg:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Overview</div>
                <div className="text-[11px] font-semibold text-slate-500">Source: {dominantSource}</div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <OverviewCard label="Health Score" value={`${healthScore}%`} helper="AUTHENTIC / total" tone="cyan" />
                <OverviewCard label="Top Source" value={dominantSource} helper="volume tertinggi" />
              </div>
            </div>
          </div>
        </div>

        <VerificationMapCard points={verificationMapPoints} />
      </section>
    </AppShell>
  );
}

function MetricCard({
  title,
  value,
  helper,
  icon,
  tone = 'slate',
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  tone?: 'slate' | 'cyan';
}) {
  const toneClass = tone === 'cyan' ? 'border-cyan-100 bg-cyan-50/80 text-cyan-900' : 'border-slate-200 bg-white text-slate-900';
  const iconClass = tone === 'cyan' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600';

  return (
    <div className={`rounded-[1.35rem] border px-4 py-4 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{title}</div>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl ${iconClass}`}>{icon}</div>
      </div>
      <div className="mt-3 text-3xl font-black tracking-[-0.04em]">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function OverviewCard({label, value, helper, tone = 'slate'}: {label: string; value: string; helper: string; tone?: 'slate' | 'cyan'}) {
  const className = tone === 'cyan' ? 'border-cyan-100 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-[1.25rem] border px-4 py-3 ${className}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-2 text-lg font-black tracking-[-0.03em]">{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{helper}</div>
    </div>
  );
}