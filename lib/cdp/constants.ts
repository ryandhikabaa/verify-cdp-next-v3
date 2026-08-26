import type {GeneratorSettings} from '@/lib/types';

export const CDP_PAYLOAD_CHARS = 12;
export const CDP_TOTAL_BITS = 112;
export const CDP_CHECKSUM_BITS = 16;
export const CDP_CHECKSUM_MULTIPLIER = 31;
export const CDP_CHECKSUM_MODULUS = 65536;
export const CDP_SPREAD_X = 73;
export const CDP_SPREAD_Y = 19;
export const CDP_MASK_X = 12.9898;
export const CDP_MASK_Y = 78.233;
export const CDP_MASK_Z = 43758.5453;
export const CDP_SIMILARITY_SIZE = 32;
export const CDP_MIN_VALID_SIMILARITY = 0.08;
export const CDP_RENDER_SCALE = 10;
export const CDP_PREVIEW_RENDER_SCALE = 1;
export const RECT_PATTERN_ROWS = 64;
export const RECT_PATTERN_COLUMNS = 32;
export const RECT_PATTERN_DOT_DENSITY = 0.45;
export const RECT_PATTERN_SAMPLE_RATIO = 0.5;

export const STANDARD_CDP_SETTINGS: GeneratorSettings = {
  gridSize: 64,
  dotDensity: RECT_PATTERN_DOT_DENSITY,
  dotSize: 4,
  seed: 'VERIFY0001',
  style: 'stochastic_noise',
  greyTextureVersion: 'grey-v3',
  addMarkers: false,
};
