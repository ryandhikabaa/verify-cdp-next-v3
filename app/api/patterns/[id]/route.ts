import {NextRequest, NextResponse} from 'next/server';
import {decodeDotveraBinaryText, ensureDotveraSchema, getDotveraPool} from '@/lib/db/dotvera';
import {apiError, apiSuccess} from '@/lib/api-response';

/** Deletes a single stored pattern by ID. */
export async function DELETE(_request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params;
  try {
    await ensureDotveraSchema();
    const result = await getDotveraPool().query(
      'DELETE FROM pattern_generated_v21 WHERE serial = $1 RETURNING id, serial, density, size, style, payload_1, payload_2, payload_qr, create_at, update_at',
      [id],
    );
    if (result.rowCount === 0) {
      return apiError({status: 404, message: 'Pattern not found'});
    }
    const row = result.rows[0];
    return apiSuccess({
      deleted: {
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
        created_at: row.create_at,
        updated_at: row.update_at,
      },
    }, {message: 'Pattern deleted'});
  } catch (error) {
    console.error('Error deleting pattern:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
