import {NextRequest} from 'next/server';
import {apiError} from '@/lib/api-response';

const PATTERN_SAVE_UNAVAILABLE_MESSAGE = 'Penyimpanan pattern V3.1 membutuhkan metadata QR dari API generate. Endpoint ini aktif setelah Phase 4.';

/** Pattern batch waits for Phase 4 QR metadata. Do not insert into v21. */
export async function POST(_request: NextRequest) {
  return apiError({status: 400, message: PATTERN_SAVE_UNAVAILABLE_MESSAGE});
}
