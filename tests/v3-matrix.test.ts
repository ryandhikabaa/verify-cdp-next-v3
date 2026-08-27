import assert from 'node:assert/strict';
import test from 'node:test';
import {corruptV3Matrix, decodeV3Matrix, generateV3Matrix, V3_MATRIX_COLUMNS, V3_MATRIX_ROWS} from '../lib/cdp/v3-matrix';

test('V3 matrix round trips payloads deterministically', () => {
  const payload = 'abc-09_ABCDEFGHIJKLMNOP';
  const first = generateV3Matrix(payload);
  assert.deepEqual(first, generateV3Matrix(payload));
  assert.equal(first.length, V3_MATRIX_ROWS);
  assert.equal(first[0].length, V3_MATRIX_COLUMNS);
  assert.deepEqual(decodeV3Matrix(first).payload, payload);
});

test('V3 matrix recovers five corrupted carrier cells', () => {
  const matrix = generateV3Matrix('ABCDEFGHIJKLMNOPQRSTUVWX');
  const decoded = decodeV3Matrix(corruptV3Matrix(matrix, [0, 71, 511, 1024, 2047]));
  assert.equal(decoded.payload, 'ABCDEFGHIJKLMNOPQRSTUVWX');
});

test('V3 matrix tolerates controlled noise below the repetition majority', () => {
  const payload = 'ABCDEFGHIJKLMNOPQRSTUVWX';
  const matrix = generateV3Matrix(payload);
  const noisyCells = Array.from({length: 3}, (_, bit) => bit * 17);
  const decoded = decodeV3Matrix(corruptV3Matrix(matrix, noisyCells));
  assert.equal(decoded.payload, payload);
});

test('V3 matrix round trips empty, short, and maximum payloads', () => {
  for (const payload of ['', 'A', '0-_', 'ABCDEFGHIJKLMNOPQRSTUVWX']) {
    assert.equal(decodeV3Matrix(generateV3Matrix(payload)).payload, payload);
  }
});

test('V3 matrix rejects invalid dimensions and cell values', () => {
  assert.throws(() => decodeV3Matrix([]));
  const matrix = generateV3Matrix('A');
  matrix[0][0] = 2;
  assert.throws(() => decodeV3Matrix(matrix));
});

test('V3 matrix rejects invalid payload capacity and alphabet', () => {
  assert.throws(() => generateV3Matrix('ABCDEFGHIJKLMNOPQRSTUVWXY'));
  assert.throws(() => generateV3Matrix('payload with spaces'));
});
