import {NextRequest} from 'next/server';
import {apiError, apiSuccess} from '@/lib/api-response';
import {getSetting, HVALUE_SETTING_KEY, MAX_SCAN_SETTING_KEY, setSetting} from '@/lib/db/settings';
import {SettingsUpdateSchema} from '@/lib/schemas';

const EDITABLE_SETTING_KEYS = [MAX_SCAN_SETTING_KEY, HVALUE_SETTING_KEY] as const;

const HVALUE_ALPHABET = /^[A-Za-z0-9]+$/;

/** Returns the editable application settings catalog. */
export async function GET() {
  try {
    const entries = await Promise.all(
      EDITABLE_SETTING_KEYS.map(async (parameter) => {
        const row = await getSetting(parameter);
        return row
          ? {parameter: row.parameter, value: row.value, updated_at: row.updated_at.toISOString()}
          : {parameter, value: null, updated_at: null};
      }),
    );

    return apiSuccess(entries, {message: 'Settings retrieved successfully'});
  } catch (error) {
    console.error('Error fetching settings:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}

/** Updates one or more editable application settings. */
export async function PATCH(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError({status: 400, message: 'Body JSON tidak valid.'});
  }

  const validation = SettingsUpdateSchema.safeParse(body);
  if (!validation.success) {
    return apiError({status: 400, message: validation.error.issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')});
  }

  const updates: Array<{parameter: string; value: string}> = [];

  for (const parameter of EDITABLE_SETTING_KEYS) {
    if (!(parameter in validation.data)) continue;

    if (parameter === MAX_SCAN_SETTING_KEY) {
      if (validation.data.max_scan !== undefined) {
        updates.push({parameter, value: String(validation.data.max_scan)});
      }
    }

    if (parameter === HVALUE_SETTING_KEY) {
      if (validation.data.hvalue !== undefined) {
        updates.push({parameter, value: validation.data.hvalue});
      }
    }
  }

  if (updates.length === 0) {
    return apiError({status: 400, message: 'Tidak ada setting yang valid untuk diperbarui.'});
  }

  try {
    const results = await Promise.all(
      updates.map(async ({parameter, value}) => {
        const row = await setSetting(parameter, value);
        return {parameter: row.parameter, value: row.value, updated_at: row.updated_at.toISOString()};
      }),
    );

    return apiSuccess(results, {message: 'Settings berhasil diperbarui.'});
  } catch (error) {
    console.error('Error updating settings:', error);
    return apiError({status: 500, message: 'Internal Server Error'});
  }
}
