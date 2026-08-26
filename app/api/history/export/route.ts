import {NextRequest, NextResponse} from 'next/server';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError} from '@/lib/api-response';
import {buildVerificationSourceFilterClause, detectVerificationSource} from '@/lib/cdp/verification-source';

type ExportRow = {
  id: string;
  label: string;
  deviceID: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: Date | string;
};

function escapeCsv(value: unknown) {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    await ensureDotveraSchema();

    const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';
    const status = request.nextUrl.searchParams.get('status')?.trim().toUpperCase() ?? 'ALL';
    const source = request.nextUrl.searchParams.get('source')?.trim().toUpperCase() ?? 'ALL';

    const filters: string[] = [];
    const values: Array<string> = [];

    if (search) {
      values.push(`%${search}%`);
      filters.push(`(label ILIKE $${values.length} OR "deviceID" ILIKE $${values.length})`);
    }

    if (status !== 'ALL') {
      values.push(status);
      filters.push(`status = $${values.length}`);
    }

    if (source !== 'ALL') {
      values.push(source);
      filters.push(`(${buildVerificationSourceFilterClause(values.length)})`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const pool = getDotveraPool();
    const result = await pool.query<ExportRow>(`
      SELECT id, label, "deviceID", status, latitude, longitude, created_at
      FROM pattern_detection
      ${whereClause}
      ORDER BY created_at DESC
    `, values);

    const header = ['id', 'label', 'device_id', 'source', 'status', 'latitude', 'longitude', 'created_at'];
    const rows = result.rows.map((row) => [
      escapeCsv(row.id),
      escapeCsv(row.label),
      escapeCsv(row.deviceID),
      escapeCsv(detectVerificationSource(row.deviceID)),
      escapeCsv(row.status),
      escapeCsv(row.latitude),
      escapeCsv(row.longitude),
      escapeCsv(new Date(row.created_at).toISOString()),
    ]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="verification-history.csv"',
      },
    });
  } catch (error) {
    return apiError({status: 500, message: error instanceof Error ? error.message : 'Failed to export history'});
  }
}
