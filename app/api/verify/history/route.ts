import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {detectVerificationSource} from '@/lib/cdp/verification-source';
import {ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import type {VerifyStatus} from '@/lib/types';

type VerificationHistoryRow = {
  id: string;
  label: string;
  deviceID: string;
  status: VerifyStatus;
  notes: string | null;
  image_data: string | null;
  latitude: number | null;
  longitude: number | null;
  qr_value: string | null;
  qr_format: string | null;
  qr_detected: boolean;
  qr_bounds: Record<string, unknown> | null;
  pattern_crop_bounds: Record<string, unknown> | null;
  pattern_decode_payload: string | null;
  payload_mode: 'legacy' | 'encrypted' | 'three-part' | 'unknown' | null;
  decrypt_succeeded: boolean | null;
  checksum_valid: boolean | null;
  created_at: Date | string;
  updated_at: Date | string;
};

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
    await ensureDotveraSchema();

    const pool = getDotveraPool();
    const [historyResult, countResult] = await Promise.all([
      pool.query<VerificationHistoryRow>(
        `SELECT id, label, "deviceID", status, notes, image_data, latitude, longitude,
          qr_value, qr_format, qr_detected, qr_bounds, pattern_crop_bounds,
          pattern_decode_payload, payload_mode, decrypt_succeeded, checksum_valid,
          created_at, updated_at
         FROM pattern_detection
         WHERE "deviceID" = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [deviceID, limit, offset],
      ),
      pool.query<{count: number}>('SELECT COUNT(*)::int AS count FROM pattern_detection WHERE "deviceID" = $1', [deviceID]),
    ]);

    const total = countResult.rows[0]?.count ?? 0;
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
        items: historyResult.rows.map((row) => ({
          id: row.id,
          label: row.label,
          deviceID: row.deviceID,
          source: detectVerificationSource(row.deviceID),
          status_result: row.status,
          notes: row.notes,
          image_data: row.image_data,
          latitude: row.latitude,
          longitude: row.longitude,
          qr_value: row.qr_value,
          qr_format: row.qr_format,
          qr_detected: row.qr_detected,
          qr_bounds: row.qr_bounds,
          pattern_crop_bounds: row.pattern_crop_bounds,
          pattern_decode_payload: row.pattern_decode_payload,
          payload_mode: row.payload_mode,
          decrypt_succeeded: row.decrypt_succeeded,
          checksum_valid: row.checksum_valid,
          created_at: new Date(row.created_at).toISOString(),
          updated_at: new Date(row.updated_at).toISOString(),
        })),
      },
      {message: total > 0 ? 'Verification history retrieved successfully.' : 'No verification history found for this device.'},
    );
  } catch (error) {
    console.error('[api/verify/history] Error fetching device history', {deviceID, page, limit, error});
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}