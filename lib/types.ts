export type PatternStyle = 'stochastic_noise' | 'halftone_grid' | 'error_diffusion';
export type GreyTextureVersion = 'grey-v1' | 'grey-v2' | 'grey-v3';
export type VerifyStatus = 'AUTHENTIC' | 'COUNTERFEIT' | 'MISMATCH';

/** Full set of parameters that control how a CDP pattern is generated. */
export interface GeneratorSettings {
  gridSize: number;
  dotDensity: number;
  dotSize: number;
  seed: string;
  payload?: string;
  payload1?: string;
  payload2?: string;
  payloadQr?: string;
  qrPayload?: string;
  style: PatternStyle;
  greyTextureVersion?: GreyTextureVersion;
  addMarkers: boolean;
}

export interface RectangularPatternMatrix {
  rows: number;
  columns: number;
  cells: number[][];
}

/** A single batch-generated pattern kept in memory before or after save. */
export interface BatchPattern {
  id: string;
  settings: GeneratorSettings;
}

/** A pattern document as stored in and returned by the backend. */
export interface PatternDoc {
  id: string;
  label: string;
  density: number;
  size?: number;
  style?: string;
  grey_texture_version?: GreyTextureVersion;
  payload?: string;
  payload_1?: string;
  payload_2?: string;
  payload_qr?: string;
  qr_payload?: string;
  pattern_payload?: string;
  pattern_seed?: string;
  layout_version?: string;
  left_position?: string;
  qr_position?: string;
  right_position?: string;
  pattern_position?: string;
  left_width_px?: number;
  left_height_px?: number;
  qr_width_px?: number;
  qr_height_px?: number;
  right_width_px?: number;
  right_height_px?: number;
  pattern_width_px?: number;
  pattern_height_px?: number;
  gap_px?: number;
  canvas_width_px?: number;
  canvas_height_px?: number;
  image_data?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PatternPreview {
  id: string;
  label: string;
  density: number;
  size?: number;
  style?: string;
  layout_version?: string;
  image_data?: string;
}

/** Result returned by the decoder alignment pipeline. */
export interface ScanDecodeResult {
  id: string;
  rawPayloadText?: string;
  payloadMode?: 'legacy' | 'encrypted' | 'unknown';
  isValid: boolean;
  rawScore: number;
  alignedCanvas: HTMLCanvasElement;
  alignedDisplayCanvas: HTMLCanvasElement;
  anchorsFound: boolean;
  reason: string;
  bitVotes: number[];
  anchors: number[];
  sharpness: number;
  contrast: number;
}

/** Pearson correlation result from the anti-copy comparison stage. */
export interface SimilarityResult {
  score: number;
  isValid: boolean;
  status: VerifyStatus;
}

export interface VerificationRecord {
  id: string;
  label: string;
  deviceID: string;
  status: VerifyStatus;
  notes: string | null;
  image_data?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  qr_value?: string | null;
  qr_format?: string | null;
  qr_detected?: boolean;
  qr_bounds?: Record<string, unknown> | null;
  pattern_crop_bounds?: Record<string, unknown> | null;
  pattern_decode_payload?: string | null;
  payload_mode?: 'legacy' | 'encrypted' | 'three-part' | 'unknown' | null;
  decrypt_succeeded?: boolean | null;
  checksum_valid?: boolean | null;
  created_at?: string;
  updated_at?: string;
}
