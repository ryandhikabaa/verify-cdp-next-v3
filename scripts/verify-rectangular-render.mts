import assert from 'node:assert/strict';
import {createCanvas} from 'canvas';
import {decodeRectangularCDPMatrix, generateRectangularCDPMatrix} from '../lib/cdp/matrix';
import {renderRectangularCDPToCanvas} from '../lib/cdp/render';
import {getStaticMaskBit} from '../lib/cdp/mask';
import {bitsToString} from '../lib/cdp/bit-encoding';
import {CDP_SPREAD_X, CDP_SPREAD_Y, CDP_TOTAL_BITS, RECT_PATTERN_COLUMNS, RECT_PATTERN_ROWS} from '../lib/cdp/constants';

const settings = {
  gridSize: 64, dotDensity: 0.45, dotSize: 4, seed: 'RENDERTEST01',
  style: 'stochastic_noise' as const, addMarkers: false, greyTextureVersion: 'grey-v3' as const,
};

function decodeRendered(canvas: ReturnType<typeof createCanvas>) {
  const ctx = canvas.getContext('2d');
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const means: number[] = [];
  for (let y = 0; y < RECT_PATTERN_ROWS; y++) for (let x = 0; x < RECT_PATTERN_COLUMNS; x++) {
    const x0 = Math.floor(x * canvas.width / RECT_PATTERN_COLUMNS + canvas.width / RECT_PATTERN_COLUMNS * 0.25);
    const x1 = Math.ceil((x + 1) * canvas.width / RECT_PATTERN_COLUMNS - canvas.width / RECT_PATTERN_COLUMNS * 0.25);
    const y0 = Math.floor(y * canvas.height / RECT_PATTERN_ROWS + canvas.height / RECT_PATTERN_ROWS * 0.25);
    const y1 = Math.ceil((y + 1) * canvas.height / RECT_PATTERN_ROWS - canvas.height / RECT_PATTERN_ROWS * 0.25);
    let sum = 0; let count = 0;
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = (py * canvas.width + px) * 4;
      sum += 0.299 * image[i] + 0.587 * image[i + 1] + 0.114 * image[i + 2]; count++;
    }
    means.push(sum / count);
  }
  const threshold = (Math.min(...means) + Math.max(...means)) / 2;
  const votes = new Int32Array(CDP_TOTAL_BITS);
  let index = 0;
  for (let y = 0; y < RECT_PATTERN_ROWS; y++) for (let x = 0; x < RECT_PATTERN_COLUMNS; x++) {
    const scanned = means[index++] <= threshold ? 0 : 1;
    const raw = scanned ^ getStaticMaskBit(x + 11, y + 7);
    const bit = (x * CDP_SPREAD_X + y * CDP_SPREAD_Y + (x * y % 17)) % CDP_TOTAL_BITS;
    votes[bit] += raw ? 1 : -1;
  }
  return bitsToString(Array.from(votes, (vote) => vote > 0 ? 1 : 0));
}

for (const payload of ['LEFT1234567', 'RIGHT765432']) {
  const matrix = generateRectangularCDPMatrix({...settings, payload});
  const canvas = createCanvas(320, 640);
  renderRectangularCDPToCanvas(matrix, canvas as unknown as HTMLCanvasElement, {...settings, payload}, {targetHeight: 640});
  assert.equal(canvas.width / canvas.height, 0.5);
  assert.deepEqual(decodeRectangularCDPMatrix(matrix), {text: payload, isValid: true});
  assert.deepEqual(decodeRendered(canvas), {text: payload, isValid: true});
}
console.log('Rectangular render round-trip OK');
