import {z} from 'zod';

// ============================================
// Common Schemas
// ============================================

export const StringSchema = z.string().min(1, 'Field tidak boleh kosong');
export const TrimmedStringSchema = z.string().min(1, 'Field tidak boleh kosong').transform((val) => val.trim());

// ============================================
// Authentication Schemas
// ============================================

export const LoginSchema = z.object({
  username: TrimmedStringSchema.describe('Username admin'),
  password: StringSchema.describe('Password admin'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ============================================
// User Schemas
// ============================================

export const CreateUserSchema = z.object({
  nama: TrimmedStringSchema.describe('Nama lengkap user'),
  username: z.string().min(3, 'Username minimal 3 karakter').max(100, 'Username maksimal 100 karakter').transform((val) => val.trim()),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// ============================================
// Pattern Schemas
// ============================================

export const PatternPayloadSchema = z
  .string()
  .length(24, 'Pattern payload harus tepat 24 karakter')
  .regex(/^[A-Za-z0-9]+$/, 'Pattern payload hanya boleh huruf dan angka');

// Matches HVALUE_MIN_LENGTH..HVALUE_MAX_LENGTH in lib/cdp/hvalue.ts (1-7).
// The generator, Setting page, and QR generate endpoint all accept 1-7, so the
// save schemas must not demand exactly 7 or valid short hvalues are rejected.
export const QRHValueSchema = z
  .string()
  .min(1, 'HValue wajib diisi')
  .max(7, 'HValue maksimal 7 karakter')
  .regex(/^[A-Za-z0-9]+$/, 'HValue hanya boleh huruf dan angka');

export const QRSecretSchema = z.string().min(1, 'QR secret tidak boleh kosong');

export const QRImageSchema = z.string().min(1, 'QR image tidak boleh kosong');

export const DensitySchema = z.number().min(0).max(100, 'Density maksimal 100');

export const OptionalNumberSchema = z.number().optional();

// Stored style is metadata-extended by withGreyTextureStyleTrace() as
// "<base>;grey-v3;gray=...;alpha=...;sizeRatio=...". The base enum still has
// to be one of the known styles; the trace suffix is preserved verbatim and
// parsed back via getStoredPatternStyle/getStoredGreyTextureVersion.
export const StyleSchema = z
  .string()
  .refine((value) => ['stochastic_noise', 'halftone_grid', 'error_diffusion'].includes(value.split(';', 1)[0]), {
    message: 'Style pattern tidak dikenal',
  })
  .optional();

export const LayoutVersionSchema = z.string().default('v3-qr-pattern');

// Schema untuk POST /api/patterns
export const CreatePatternSchema = z.object({
  qr_payload: StringSchema.describe('QR payload'),
  qr_hvalue: QRHValueSchema.describe('QR HValue'),
  qr_secret1: QRSecretSchema.describe('QR secret 1'),
  qr_secret2: QRSecretSchema.describe('QR secret 2'),
  qr_image: QRImageSchema.describe('QR image base64'),
  pattern_payload: PatternPayloadSchema.describe('Pattern payload'),
  image_data: z.string().optional(),
  density: DensitySchema.optional(),
  size: OptionalNumberSchema,
  style: StyleSchema,
  layout_version: LayoutVersionSchema,
  qr_width_px: OptionalNumberSchema,
  qr_height_px: OptionalNumberSchema,
  pattern_width_px: OptionalNumberSchema,
  pattern_height_px: OptionalNumberSchema,
  gap_px: OptionalNumberSchema,
  canvas_width_px: OptionalNumberSchema,
  canvas_height_px: OptionalNumberSchema,
});

export type CreatePatternInput = z.infer<typeof CreatePatternSchema>;

// Schema untuk GET /api/patterns (query params)
export const PatternListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(10),
  sort: z.enum(['asc', 'desc', 'newest', 'oldest']).optional().default('desc'),
  search: z.string().optional(),
  day: z.string().optional(),
  seedLength: z.coerce.number().int().positive().optional(),
  mode: z.enum(['ids', 'full']).optional(),
});

export type PatternListQueryInput = z.infer<typeof PatternListQuerySchema>;

// ============================================
// QR Generate Schemas
// ============================================

export const QRGenerateRequestSchema = z.object({
  hvalue: QRHValueSchema,
});

export type QRGenerateRequestInput = z.infer<typeof QRGenerateRequestSchema>;

// ============================================
// Settings Schemas
// ============================================

export const MaxScanSettingSchema = z.number().int().nonnegative('max_scan harus berupa angka bulat >= 0');

export const HValueSettingSchema = z
  .string()
  .min(1, 'hvalue tidak boleh kosong')
  .max(7, 'hvalue maksimal 7 karakter')
  .regex(/^[A-Za-z0-9]+$/, 'hvalue hanya boleh huruf dan angka');

export const SettingsUpdateSchema = z.object({
  max_scan: MaxScanSettingSchema.optional(),
  hvalue: HValueSettingSchema.optional(),
});

export type SettingsUpdateInput = z.infer<typeof SettingsUpdateSchema>;

// ============================================
// Batch Pattern Schemas
// ============================================

export const BatchPatternItemSchema = z.object({
  qr_payload: StringSchema,
  qr_hvalue: QRHValueSchema,
  qr_secret1: QRSecretSchema,
  qr_secret2: QRSecretSchema,
  qr_image: QRImageSchema,
  pattern_payload: PatternPayloadSchema,
  image_data: z.string().optional(),
  density: DensitySchema.optional(),
  size: OptionalNumberSchema,
  style: StyleSchema,
  layout_version: z.string().optional(),
  qr_width_px: OptionalNumberSchema,
  qr_height_px: OptionalNumberSchema,
  pattern_width_px: OptionalNumberSchema,
  pattern_height_px: OptionalNumberSchema,
  gap_px: OptionalNumberSchema,
  canvas_width_px: OptionalNumberSchema,
  canvas_height_px: OptionalNumberSchema,
});

export const BatchPatternRequestSchema = z.object({
  items: z.array(BatchPatternItemSchema).min(1, 'Minimal 1 pattern untuk batch'),
});

export type BatchPatternRequestInput = z.infer<typeof BatchPatternRequestSchema>;

// ============================================
// Helper Functions
// ============================================

export function validateWithZod<T>(schema: z.ZodSchema<T>, data: unknown): {success: boolean; data?: T; error?: string} {
  const result = schema.safeParse(data);
  if (result.success) {
    return {success: true, data: result.data};
  }
  
  const errorMessage = result.error.issues
    .map((err) => `${err.path.join('.')}: ${err.message}`)
    .join(', ');
  
  return {success: false, error: errorMessage};
}

export function validateQueryWithZod<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): {success: boolean; data?: T; error?: string} {
  const queryObj: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    queryObj[key] = value;
  }
  return validateWithZod(schema, queryObj);
}
