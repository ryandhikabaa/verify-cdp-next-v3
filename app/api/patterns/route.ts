import {NextRequest} from 'next/server';
import {decodeDotveraBinaryText, dotveraImageDataToBuffer, encodeDotveraBinaryText, ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError, apiSuccess} from '@/lib/api-response';

/** Returns the full pattern catalog ordered by ID. */
export async function GET() {
  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query(
       `SELECT id, serial, density, size, style, payload_1, payload_2, payload_qr, pattern_seed,
            layout_version, left_position, qr_position, right_position, left_width_px, left_height_px,
            qr_width_px, qr_height_px, right_width_px, right_height_px, gap_px, canvas_width_px, canvas_height_px,
              image_data, create_at, update_at
          FROM pattern_generated_v21
         ORDER BY serial ASC`,
    );
    return apiSuccess(
      result.rows.map((row) => ({
        id: row.serial,
        record_id: row.id,
        label: row.serial,
        density: row.density,
        size: row.size,
        style: row.style,
        payload: decodeDotveraBinaryText(row.payload_1),
        payload_1: decodeDotveraBinaryText(row.payload_1),
        payload_2: decodeDotveraBinaryText(row.payload_2),
        payload_qr: row.payload_qr,
        qr_payload: row.payload_qr,
        pattern_payload: decodeDotveraBinaryText(row.payload_1),
        pattern_seed: row.pattern_seed,
        layout_version: row.layout_version,
        left_position: row.left_position,
        qr_position: row.qr_position,
        right_position: row.right_position,
        pattern_position: row.right_position,
        left_width_px: row.left_width_px,
        left_height_px: row.left_height_px,
        qr_width_px: row.qr_width_px,
        qr_height_px: row.qr_height_px,
        right_width_px: row.right_width_px,
        right_height_px: row.right_height_px,
        pattern_width_px: row.right_width_px ?? row.left_width_px,
        pattern_height_px: row.right_height_px ?? row.left_height_px,
        gap_px: row.gap_px,
        canvas_width_px: row.canvas_width_px,
        canvas_height_px: row.canvas_height_px,
        image_data: row.image_data,
        created_at: row.create_at,
        updated_at: row.update_at,
      })),
      {message: 'Patterns retrieved successfully'},
    );
  } catch (error) {
    console.error('Error fetching patterns:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}

const SEED_PATTERN = /^[A-Z0-9]{1,24}$/;

function isUniqueViolation(error: unknown): error is {code: string} {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

/** Inserts one new pattern without allowing an existing serial to be overwritten. */
export async function POST(request: NextRequest) {
  const {
    id,
    label,
    density,
    size,
    style,
    payload,
    payload_1,
    payload_2,
    payload_qr,
    qr_payload,
    pattern_payload,
    pattern_seed,
    layout_version,
    qr_position,
    left_width_px,
    left_height_px,
    qr_width_px,
    qr_height_px,
    right_width_px,
    right_height_px,
    pattern_width_px,
    pattern_height_px,
    gap_px,
    canvas_width_px,
    canvas_height_px,
    image_data,
  } = await request.json();
  const serial = typeof id === 'string' ? id : '';
  const qrPayload = payload_qr ?? qr_payload;
  if (!SEED_PATTERN.test(serial) || pattern_seed !== serial || typeof qrPayload !== 'string' || typeof density !== 'number') {
    return apiError({status: 400, message: 'Invalid pattern data'});
  }

  try {
    await ensureDotveraSchema();
    const imageBlob = dotveraImageDataToBuffer(image_data);
    const storedPayload1 = encodeDotveraBinaryText(payload_1 ?? pattern_payload ?? payload ?? label ?? serial);
    const storedPayload2 = payload_2 == null ? null : encodeDotveraBinaryText(payload_2);
    const result = await getDotveraPool().query(
      `INSERT INTO pattern_generated_v21 (
         serial, density, size, style, payload_1, payload_2, payload_qr, pattern_seed,
         layout_version, left_position, qr_position, right_position, left_width_px, left_height_px,
         qr_width_px, qr_height_px, right_width_px, right_height_px, gap_px, canvas_width_px, canvas_height_px,
         image_data, image_blob
       )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'left', $10, 'right', $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id, serial, density, size, style, payload_1, payload_2, payload_qr, pattern_seed,
                 layout_version, left_position, qr_position, right_position, left_width_px, left_height_px,
                 qr_width_px, qr_height_px, right_width_px, right_height_px, gap_px, canvas_width_px, canvas_height_px,
                 image_data, create_at, update_at`,
      [
        serial,
        density,
        size,
        style,
        storedPayload1,
        storedPayload2,
        qrPayload ?? null,
        pattern_seed ?? null,
        layout_version ?? 'three-part-v2.1',
        qr_position ?? 'center',
        left_width_px ?? pattern_width_px ?? null,
        left_height_px ?? pattern_height_px ?? null,
        qr_width_px ?? null,
        qr_height_px ?? null,
        right_width_px ?? pattern_width_px ?? null,
        right_height_px ?? pattern_height_px ?? null,
        gap_px ?? null,
        canvas_width_px ?? null,
        canvas_height_px ?? null,
        image_data,
        imageBlob,
      ],
    );
    const row = result.rows[0];
    return apiSuccess(
      {
        id: row.serial,
        record_id: row.id,
        label: row.serial,
        density: row.density,
        size: row.size,
        style: row.style,
        payload: decodeDotveraBinaryText(row.payload_1),
        payload_1: decodeDotveraBinaryText(row.payload_1),
        payload_2: decodeDotveraBinaryText(row.payload_2),
        payload_qr: row.payload_qr,
        qr_payload: row.payload_qr,
        pattern_payload: decodeDotveraBinaryText(row.payload_1),
        pattern_seed: row.pattern_seed,
        layout_version: row.layout_version,
        left_position: row.left_position,
        qr_position: row.qr_position,
        right_position: row.right_position,
        pattern_position: row.right_position,
        left_width_px: row.left_width_px,
        left_height_px: row.left_height_px,
        qr_width_px: row.qr_width_px,
        qr_height_px: row.qr_height_px,
        right_width_px: row.right_width_px,
        right_height_px: row.right_height_px,
        pattern_width_px: row.right_width_px ?? row.left_width_px,
        pattern_height_px: row.right_height_px ?? row.left_height_px,
        gap_px: row.gap_px,
        canvas_width_px: row.canvas_width_px,
        canvas_height_px: row.canvas_height_px,
        image_data: row.image_data,
        created_at: row.create_at,
        updated_at: row.update_at,
      },
      {status: 201, message: 'Pattern saved successfully'},
    );
  } catch (error) {
    console.error('Error saving pattern:', error);
    if (isUniqueViolation(error)) {
      return apiError({status: 409, message: 'Seed sudah tersimpan. Generate seed baru.'});
    }
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
