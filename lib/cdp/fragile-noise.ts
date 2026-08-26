import type {GeneratorSettings, GreyTextureVersion} from '@/lib/types';
import {RECT_PATTERN_COLUMNS, RECT_PATTERN_ROWS} from './constants';

export type FragileTextureCell = {
  x: number;
  y: number;
  gray: number;
  alpha: number;
  sizeRatio: number;
  variant: 'noise';
  thickness: number;
};

export const GREY_TEXTURE_TRACES: Record<GreyTextureVersion, {
  version: GreyTextureVersion;
  gray: {min: number; max: number};
  alpha: {min: number; max: number};
  sizeRatio: readonly [number, number];
}> = {
  'grey-v1': {
    version: 'grey-v1',
    gray: {min: 105, max: 185},
    alpha: {min: 0.54, max: 0.77},
    sizeRatio: [0.62, 0.82],
  },
  'grey-v2': {
    version: 'grey-v2',
    gray: {min: 88, max: 164},
    alpha: {min: 0.6, max: 0.81},
    sizeRatio: [0.62, 0.82],
  },
  'grey-v3': {
    version: 'grey-v3',
    gray: {min: 74, max: 148},
    alpha: {min: 0.64, max: 0.84},
    sizeRatio: [0.78, 0.98],
  },
};

export const GREY_TEXTURE_TRACE = GREY_TEXTURE_TRACES['grey-v3'];

export function getGreyTextureTrace(version: GreyTextureVersion | undefined) {
  return GREY_TEXTURE_TRACES[version ?? 'grey-v3'] ?? GREY_TEXTURE_TRACE;
}

export function getGreyTextureStyleTrace(version: GreyTextureVersion | undefined) {
  const trace = getGreyTextureTrace(version);
  return `${trace.version};gray=${trace.gray.min}-${trace.gray.max};alpha=${trace.alpha.min}-${trace.alpha.max};sizeRatio=${trace.sizeRatio.join('/')}`;
}

export const GREY_TEXTURE_STYLE_TRACE = getGreyTextureStyleTrace(GREY_TEXTURE_TRACE.version);

export function withGreyTextureStyleTrace(style: GeneratorSettings['style'], version?: GreyTextureVersion) {
  return `${style};${getGreyTextureStyleTrace(version)}`;
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isInsideReadableBand(x: number, y: number, columns: number, rows: number) {
  const marginX = Math.max(1, Math.floor(columns * 0.04));
  const marginY = Math.max(1, Math.floor(rows * 0.04));
  return x >= marginX && x < columns - marginX && y >= marginY && y < rows - marginY;
}

/** Returns deterministic fragile grey micro-texture cells for the legacy square pattern. */
export function getFragileTextureCells(settings: GeneratorSettings): FragileTextureCell[] {
  return getFragileTextureCellsForGrid(settings, settings.gridSize, settings.gridSize, 'dotvera:v2:square-gray-noise');
}

/** Returns deterministic fragile grey micro-texture cells for the QR-adjacent rectangular pattern. */
export function getRectangularFragileTextureCells(settings: GeneratorSettings): FragileTextureCell[] {
  return getFragileTextureCellsForGrid(settings, RECT_PATTERN_COLUMNS, RECT_PATTERN_ROWS, 'dotvera:v2:rect-gray-noise');
}

function getFragileTextureCellsForGrid(
  settings: GeneratorSettings,
  columns: number,
  rows: number,
  namespace: string,
): FragileTextureCell[] {
  const payloadKey = settings.payload ?? settings.qrPayload ?? settings.seed;
  const seedHash = hashSeed(`${namespace}:${settings.seed}:${payloadKey}`);
  const trace = getGreyTextureTrace(settings.greyTextureVersion);
  const cells: FragileTextureCell[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!isInsideReadableBand(x, y, columns, rows)) continue;

      const selector = (x * 73856093 + y * 19349663 + seedHash) >>> 0;
      if (selector % 6 > 4) continue;

      const grayRange = trace.gray.max - trace.gray.min;
      const gray = trace.gray.min + ((selector >>> 8) % Math.max(1, grayRange));
      const alphaSteps = Math.max(1, Math.round((trace.alpha.max - trace.alpha.min) * 100) + 1);
      const alpha = trace.alpha.min + (((selector >>> 15) % alphaSteps) / 100);
      const sizeRatio = ((selector >>> 21) & 1) === 0 ? trace.sizeRatio[0] : trace.sizeRatio[1];
      cells.push({x, y, gray, alpha, sizeRatio, variant: 'noise', thickness: 1});
    }
  }

  return cells;
}
