import assert from 'node:assert/strict';
import test from 'node:test';
import {createCanvas} from 'canvas';
import {
  computeV3PatternOrigins,
  decodeV3PatternCanvas,
  generateV3Matrix,
  renderRectangularCDPToCanvas,
  sampleParallelogramRegion,
  STANDARD_CDP_SETTINGS,
} from '../lib/cdp';

function renderPatternCanvas(payload: string, targetHeight?: number) {
  const patternCanvas = createCanvas(1, 1);
  renderRectangularCDPToCanvas(
    {
      rows: 64,
      columns: 32,
      cells: generateV3Matrix(payload),
    },
    patternCanvas as unknown as HTMLCanvasElement,
    STANDARD_CDP_SETTINGS,
    targetHeight ? {targetHeight} : undefined,
  );
  return patternCanvas;
}

test('Phase 5 decoder reads a directly rendered V3 pattern crop', () => {
  const payload = 'PHASE5-VERIFY-ABC123_xyz';
  const patternCanvas = renderPatternCanvas(payload, 192);
  const decoded = decodeV3PatternCanvas(patternCanvas as unknown as HTMLCanvasElement);

  assert.equal(decoded.isValid, true);
  assert.equal(decoded.text, payload);
  assert.equal(decoded.bitVotes.length, 64 * 32);
  assert.ok(decoded.confidence > 0.2);
});

test('Phase 5 decoder recovers a small-print crop after nearest-neighbour upscale', () => {
  const payload = 'tiny-print-phase5-AB_09';
  const patternCanvas = renderPatternCanvas(payload, 96);
  const decoded = decodeV3PatternCanvas(patternCanvas as unknown as HTMLCanvasElement);

  assert.equal(patternCanvas.height / 64 < 4, true);
  assert.equal(decoded.isValid, true);
  assert.equal(decoded.text, payload);
});

test('Phase 5 affine crop keeps payload readable under mild skew', () => {
  const payload = 'SKEW-TEST-phase5-XYZ_09';
  const patternCanvas = renderPatternCanvas(payload, 192);
  const sourceCanvas = createCanvas(320, 320);
  const sourceContext = sourceCanvas.getContext('2d');
  sourceContext.fillStyle = '#ffffff';
  sourceContext.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceContext.imageSmoothingEnabled = false;

  const origin = {x: 96, y: 58};
  const xAxis = {x: 1.03, y: 0.08};
  const yAxis = {x: -0.03, y: 1.02};
  sourceContext.setTransform(xAxis.x, xAxis.y, yAxis.x, yAxis.y, origin.x, origin.y);
  sourceContext.drawImage(patternCanvas, 0, 0);
  sourceContext.setTransform(1, 0, 0, 1, 0, 0);

  const cropped = sampleParallelogramRegion(
    sourceCanvas as unknown as HTMLCanvasElement,
    origin,
    xAxis,
    yAxis,
    patternCanvas.width,
    patternCanvas.height,
    () => createCanvas(1, 1) as unknown as HTMLCanvasElement,
  );

  assert.ok(cropped);
  const decoded = decodeV3PatternCanvas(cropped as HTMLCanvasElement);
  assert.equal(decoded.isValid, true);
  assert.equal(decoded.text, payload);
});

test('Phase 5 bounded offset candidates search vertical and diagonal corrections', () => {
  const origins = computeV3PatternOrigins(
    {x: 10, y: 20},
    {x: 1, y: 0},
    {x: 0, y: 1},
    50,
    10,
  );

  assert.equal(origins.length, 13);
  assert.deepEqual(origins[0], {x: 80, y: 20});
  assert.deepEqual(origins[3], {x: 80, y: 15});
  assert.deepEqual(origins[5], {x: 75, y: 15});
  assert.deepEqual(origins[12], {x: 80, y: 30});
});