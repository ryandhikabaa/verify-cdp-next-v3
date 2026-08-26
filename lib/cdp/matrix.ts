import type {GeneratorSettings, RectangularPatternMatrix} from '@/lib/types';
import {CDP_SPREAD_X, CDP_SPREAD_Y, CDP_TOTAL_BITS, RECT_PATTERN_COLUMNS, RECT_PATTERN_ROWS} from './constants';
import {stringToBits} from './bit-encoding';
import {bitsToString} from './bit-encoding';
import {getMulberry32, getStaticMaskBit} from './mask';

/** Generates the deterministic 64x64 CDP matrix for a given seed and style. */
export function generateCDPMatrix(settings: GeneratorSettings): number[][] {
  const size = settings.gridSize;
  const matrix: number[][] = [];
  const dataBits = stringToBits(settings.payload ?? settings.seed);
  const random = getMulberry32(`${settings.seed}:${settings.style}:${settings.dotDensity}`);

  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      const bitIndex = (x * CDP_SPREAD_X + y * CDP_SPREAD_Y) % CDP_TOTAL_BITS;
      const rawBit = dataBits[bitIndex];
      const maskBit = getStaticMaskBit(x, y);

      let finalBit = rawBit ^ maskBit;
      const chaos = getStaticMaskBit(y * 3, x * 7);

      if (settings.style === 'stochastic_noise' && chaos && random() > 0.6) {
        finalBit = random() < settings.dotDensity ? 0 : 1;
      } else if (settings.style === 'halftone_grid') {
        const isGrid = x % 2 === 0 && y % 2 === 0;
        if (!isGrid && random() > 0.7) {
          finalBit = random() < settings.dotDensity ? 0 : 1;
        }
      }

      row.push(finalBit);
    }
    matrix.push(row);
  }

  return matrix;
}

/** Generates a deterministic rectangular pattern matrix for the v2 QR-side layout. */
export function generateRectangularCDPMatrix(settings: GeneratorSettings): RectangularPatternMatrix {
  const rows = RECT_PATTERN_ROWS;
  const columns = RECT_PATTERN_COLUMNS;
  const cells: number[][] = [];
  const dataBits = stringToBits(settings.payload ?? settings.seed);

  for (let y = 0; y < rows; y++) {
    const row: number[] = [];
    for (let x = 0; x < columns; x++) {
      const bitIndex = (x * CDP_SPREAD_X + y * CDP_SPREAD_Y + (x * y % 17)) % CDP_TOTAL_BITS;
      const rawBit = dataBits[bitIndex];
      const axialMask = getStaticMaskBit(x + 11, y + 7);

      // Every rectangular cell must remain a reversible payload carrier.
      // Visual styles cannot overwrite bits before the seed is decoded.
      row.push(rawBit ^ axialMask);
    }
    cells.push(row);
  }

  return {rows, columns, cells};
}

/** Reconstructs a rectangular matrix without image sampling. Used as the
 * generator contract check: it must recover the exact payload deterministically. */
export function decodeRectangularCDPMatrix(matrix: RectangularPatternMatrix): {text: string; isValid: boolean} {
  const votes = new Int32Array(CDP_TOTAL_BITS);
  for (let y = 0; y < RECT_PATTERN_ROWS; y++) {
    for (let x = 0; x < RECT_PATTERN_COLUMNS; x++) {
      const encodedBit = matrix.cells[y]?.[x];
      if (encodedBit !== 0 && encodedBit !== 1) return {text: '', isValid: false};
      const rawBit = encodedBit ^ getStaticMaskBit(x + 11, y + 7);
      const bitIndex = (x * CDP_SPREAD_X + y * CDP_SPREAD_Y + (x * y % 17)) % CDP_TOTAL_BITS;
      votes[bitIndex] += rawBit === 1 ? 1 : -1;
    }
  }

  return bitsToString(Array.from(votes, (vote) => (vote > 0 ? 1 : 0)));
}
