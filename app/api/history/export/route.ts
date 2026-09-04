import {NextRequest, NextResponse} from 'next/server';
import {apiError} from '@/lib/api-response';
import {detectVerificationSource} from '@/lib/cdp/verification-source';
import {buildDetectionListWhere} from '@/lib/db/detections';
import {prisma} from '@/lib/db/prisma';

function escapeCsv(value: unknown) {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';
    const status = request.nextUrl.searchParams.get('status')?.trim().toUpperCase() ?? 'ALL';
    const source = request.nextUrl.searchParams.get('source')?.trim().toUpperCase() ?? 'ALL';
    const result = await prisma.patternDetection.findMany({
      where: buildDetectionListWhere({search, status, source}),
      orderBy: {createdAt: 'desc'},
      select: {
        id: true,
        label: true,
        deviceID: true,
        status: true,
        latitude: true,
        longitude: true,
        createdAt: true,
      },
    });

    const header = ['id', 'label', 'device_id', 'source', 'status', 'latitude', 'longitude', 'created_at'];
    const rows = result.map((row) => [
      escapeCsv(row.id),
      escapeCsv(row.label),
      escapeCsv(row.deviceID),
      escapeCsv(detectVerificationSource(row.deviceID)),
      escapeCsv(row.status),
      escapeCsv(row.latitude),
      escapeCsv(row.longitude),
      escapeCsv(row.createdAt.toISOString()),
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
