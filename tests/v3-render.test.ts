import assert from 'node:assert/strict';
import test from 'node:test';
import {createCanvas} from 'canvas';
import {getV3QrPatternLayoutMetadata, renderV3QrPatternToCanvas} from '../lib/cdp/render';

test('V3 layout uses one QR-module gap and equal-height content', () => {
  const layout = getV3QrPatternLayoutMetadata(290, 290, 320, 290, 21, 1);
  assert.equal(layout.gapPx, 13);
  assert.equal(layout.rightMarginPx, 13);
  assert.equal(layout.patternX, 303);
  assert.equal(layout.contentWidthPx, 636);
  assert.equal(layout.contentHeightPx, 437);
});

test('V3 renderer preserves dimensions and places QR before pattern', () => {
  const qr = createCanvas(20, 20);
  const pattern = createCanvas(30, 20);
  const target = createCanvas(1, 1);
  const qrContext = qr.getContext('2d');
  const patternContext = pattern.getContext('2d');
  qrContext.fillStyle = '#000'; qrContext.fillRect(0, 0, 20, 20);
  patternContext.fillStyle = '#000'; patternContext.fillRect(0, 0, 30, 20);
  const layout = renderV3QrPatternToCanvas(qr as unknown as HTMLCanvasElement, pattern as unknown as HTMLCanvasElement, target as unknown as HTMLCanvasElement, 18, 1);
  assert.equal(target.width, layout.contentWidthPx);
  assert.equal(target.height, layout.contentHeightPx);
  assert.equal(target.width, 52);
  assert.equal(target.height, 124);
  assert.equal(layout.rightMarginPx, 1);
  const edgePixel = target.getContext('2d').getImageData(target.width - 1, 10, 1, 1).data;
  assert.equal(edgePixel[0], 255);
  assert.equal(edgePixel[1], 255);
  assert.equal(edgePixel[2], 255);
});

test('V3 layout rejects invalid QR geometry', () => {
  assert.throws(() => getV3QrPatternLayoutMetadata(100, 100, 100, 100, 0));
});
