import {decodeV3Payload, encodeV3Payload, type V3DecodedPayload} from './v3-payload';

export const V3_MATRIX_ROWS = 64;
export const V3_MATRIX_COLUMNS = 32;
export const V3_MATRIX_BITS = V3_MATRIX_ROWS * V3_MATRIX_COLUMNS;
const CODEWORD_BITS = 256;
const SPREAD_STEP = 17;

type V3Matrix = number[][];

function maskBit(index: number): number {
  let value = (index + 0x9e3779b9) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x45d9f3b) >>> 0;
  value ^= value >>> 16;
  return value & 1;
}

function codewordBit(codeword: Uint8Array, index: number): number {
  return (codeword[index >>> 3] >>> (7 - (index & 7))) & 1;
}

function cellBitIndex(cell: number): number { return (cell * SPREAD_STEP) % CODEWORD_BITS; }

export function generateV3Matrix(payload: string): V3Matrix {
  const codeword = encodeV3Payload(payload);
  return Array.from({length: V3_MATRIX_ROWS}, (_, row) =>
    Array.from({length: V3_MATRIX_COLUMNS}, (_, column) => {
      const cell = row * V3_MATRIX_COLUMNS + column;
      return codewordBit(codeword, cellBitIndex(cell)) ^ maskBit(cell);
    }),
  );
}

export function decodeV3Matrix(matrix: V3Matrix): V3DecodedPayload {
  if (!Array.isArray(matrix) || matrix.length !== V3_MATRIX_ROWS || matrix.some((row) => !Array.isArray(row) || row.length !== V3_MATRIX_COLUMNS)) {
    throw new Error(`V3 matrix harus berukuran ${V3_MATRIX_ROWS}x${V3_MATRIX_COLUMNS}.`);
  }
  const votes = new Int16Array(CODEWORD_BITS);
  matrix.forEach((row, y) => row.forEach((value, x) => {
    if (value !== 0 && value !== 1) throw new Error('V3 matrix hanya boleh berisi nilai 0 atau 1.');
    const cell = y * V3_MATRIX_COLUMNS + x;
    votes[cellBitIndex(cell)] += (value ^ maskBit(cell)) === 1 ? 1 : -1;
  }));
  const codeword = new Uint8Array(CODEWORD_BITS / 8);
  for (let bit = 0; bit < CODEWORD_BITS; bit++) if (votes[bit] > 0) codeword[bit >>> 3] |= 1 << (7 - (bit & 7));
  return decodeV3Payload(codeword);
}

export function corruptV3Matrix(matrix: V3Matrix, cells: number[]): V3Matrix {
  return matrix.map((row) => row.slice()).map((row, y) => row.map((value, x) => {
    const cell = y * V3_MATRIX_COLUMNS + x;
    return cells.includes(cell) ? value ^ 1 : value;
  }));
}
