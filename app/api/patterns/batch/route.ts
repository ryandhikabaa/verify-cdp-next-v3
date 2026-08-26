import {NextRequest} from 'next/server';
import {decodeDotveraBinaryText, dotveraImageDataToBuffer, encodeDotveraBinaryText, ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError, apiSuccess} from '@/lib/api-response';

const SEED_PATTERN = /^[A-Z0-9]{1,24}$/;
const MAX_BATCH_SIZE = 100;

function isUniqueViolation(error: unknown): error is {code: string; constraint?: string} {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

/** Inserts a transactional batch without allowing an existing serial to be overwritten. */
export async function POST(request: NextRequest) {
  const {docs} = await request.json();
  if (!Array.isArray(docs) || docs.length === 0 || docs.length > MAX_BATCH_SIZE) {
    return apiError({status: 400, message: 'Invalid batch data'});
  }
  const ids = docs.map((doc) => typeof doc?.id === 'string' ? doc.id : '');
  const uniqueIds = new Set(ids);
  const hasInvalidDocument = docs.some((doc, index) => (
    !SEED_PATTERN.test(ids[index])
    || doc.pattern_seed !== ids[index]
    || typeof (doc.payload_qr ?? doc.qr_payload) !== 'string'
    || typeof doc.density !== 'number'
  ));
  if (hasInvalidDocument || uniqueIds.size !== ids.length) {
    return apiError({status: 400, message: 'Seed batch harus unik, alfanumerik kapital, dan sepanjang 1-12 karakter'});
  }

  await ensureDotveraSchema();
  const client = await getDotveraPool().connect();
  try {
    await client.query('BEGIN');
    const savedDocs = [];
    for (const doc of docs) {
      const imageBlob = dotveraImageDataToBuffer(doc.image_data);
      const storedPayload1 = encodeDotveraBinaryText(doc.payload_1 ?? doc.pattern_payload ?? doc.payload ?? doc.label ?? doc.id);
      const storedPayload2 = doc.payload_2 == null ? null : encodeDotveraBinaryText(doc.payload_2);
      const qrPayload = doc.payload_qr ?? doc.qr_payload;
      const result = await client.query(
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
          doc.id,
          doc.density,
          doc.size,
          doc.style,
          storedPayload1,
          storedPayload2,
          qrPayload ?? null,
          doc.pattern_seed ?? null,
          doc.layout_version ?? 'three-part-v2.1',
          doc.qr_position ?? 'center',
          doc.left_width_px ?? doc.pattern_width_px ?? null,
          doc.left_height_px ?? doc.pattern_height_px ?? null,
          doc.qr_width_px ?? null,
          doc.qr_height_px ?? null,
          doc.right_width_px ?? doc.pattern_width_px ?? null,
          doc.right_height_px ?? doc.pattern_height_px ?? null,
          doc.gap_px ?? null,
          doc.canvas_width_px ?? null,
          doc.canvas_height_px ?? null,
          doc.image_data,
          imageBlob,
        ],
      );
      const row = result.rows[0];
      savedDocs.push({
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
      });
    }
    await client.query('COMMIT');
    return apiSuccess(savedDocs, {status: 201, message: 'Pattern batch saved successfully'});
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing batch:', error);
    if (isUniqueViolation(error)) {
      return apiError({status: 409, message: 'Satu atau lebih seed sudah tersimpan. Generate ulang batch untuk memperoleh seed baru.'});
    }
    return apiError({status: 500, message: 'Failed to process batch insertion'});
  } finally {
    client.release();
  }
}
