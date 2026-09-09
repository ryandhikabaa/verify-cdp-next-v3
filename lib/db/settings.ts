import {prisma} from '@/lib/db/prisma';

export const MAX_SCAN_SETTING_KEY = 'max_scan';
export const DEFAULT_MAX_SCAN = 10;

export const HVALUE_SETTING_KEY = 'hvalue';
export const DEFAULT_HVALUE = 'DOTVERA';

/** Public shape returned to the settings UI and API. */
export type AppSettingValue = {
  parameter: string;
  value: string;
  updated_at: Date;
};

/**
 * Reads a single application setting. Returns `null` when the parameter does
 * not exist yet.
 */
export async function getSetting(parameter: string): Promise<AppSettingValue | null> {
  const row = await prisma.setting.findUnique({
    where: {parameter},
  });

  if (!row) return null;

  return {
    parameter: row.parameter,
    value: row.value,
    updated_at: row.updateAt,
  };
}

/**
 * Reads the max_scan limit. Falls back to DEFAULT_MAX_SCAN when unset/invalid.
 * A value of `0` means "unlimited" (no scan cap).
 */
export async function resolveMaxScanLimit(): Promise<number> {
  const row = await getSetting(MAX_SCAN_SETTING_KEY);
  if (!row) return DEFAULT_MAX_SCAN;

  const parsed = Number.parseInt(row.value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MAX_SCAN;
}

/**
 * Reads the global hidden value (hvalue) used as the QR anchor for generated
 * patterns. Falls back to DEFAULT_HVALUE when unset or empty.
 */
export async function resolveHvalue(): Promise<string> {
  const row = await getSetting(HVALUE_SETTING_KEY);
  const value = row?.value?.trim();
  return value ? value : DEFAULT_HVALUE;
}

/**
 * Upserts a single application setting by its unique `parameter` key.
 */
export async function setSetting(parameter: string, value: string): Promise<AppSettingValue> {
  const row = await prisma.setting.upsert({
    where: {parameter},
    create: {parameter, value},
    update: {value, updateAt: new Date()},
  });

  return {
    parameter: row.parameter,
    value: row.value,
    updated_at: row.updateAt,
  };
}
