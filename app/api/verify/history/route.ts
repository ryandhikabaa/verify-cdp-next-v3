import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {detectVerificationSource} from '@/lib/cdp/verification-source';
import {mapDetectionToPublicHistoryItem} from '@/lib/db/detections';
import {prisma} from '@/lib/db/prisma';

const DEVICE_ID_MAX_LENGTH = 255;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function sanitizeDeviceId(value: string | null) {
  return typeof value === 'string' ? value.trim().slice(0, DEVICE_ID_MAX_LENGTH) : '';
}

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

/** Returns public verification history for one mobile or web device based on deviceID. */
export async function GET(request: NextRequest) {
  const deviceID = sanitizeDeviceId(request.nextUrl.searchParams.get('deviceID'));
  const page = parsePositiveInteger(request.nextUrl.searchParams.get('page'), 1);
  const limit = Math.min(parsePositiveInteger(request.nextUrl.searchParams.get('limit'), DEFAULT_LIMIT), MAX_LIMIT);
  const offset = (page - 1) * limit;

  if (!deviceID) {
    return apiError({status: 400, message: 'Query deviceID wajib diisi.'});
  }

  try {
    const [historyRows, total] = await Promise.all([
      prisma.patternDetection.findMany({
        where: {deviceID},
        orderBy: {createdAt: 'desc'},
        skip: offset,
        take: limit,
      }),
      prisma.patternDetection.count({where: {deviceID}}),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return apiSuccess(
      {
        deviceID,
        source: detectVerificationSource(deviceID),
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
        },
        items: historyRows.map(mapDetectionToPublicHistoryItem),
      },
      {message: total > 0 ? 'Verification history retrieved successfully.' : 'No verification history found for this device.'},
    );
  } catch (error) {
    console.error('[api/verify/history] Error fetching device history', {deviceID, page, limit, error});
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}