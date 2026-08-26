import assert from 'node:assert/strict';
import {createCanvas} from 'canvas';
import {generateRectangularCDPMatrix, decodeRectangularCDPMatrix} from '../lib/cdp/matrix';
import {renderRectangularCDPToCanvas, renderThreePartCompositeToCanvas} from '../lib/cdp/render';
import type {GeneratorSettings} from '../lib/types';

const settings: GeneratorSettings = {
  gridSize: 64, dotDensity: 0.45, dotSize: 4, seed: 'COMPOSITETEST',
  style: 'stochastic_noise', addMarkers: false, greyTextureVersion: 'grey-v3',
};
const leftPayload = 'LEFT1234567';
const rightPayload = 'RIGHT765432';
const left = createCanvas(1, 1);
const right = createCanvas(1, 1);
const qr = createCanvas(640, 640);
const target = createCanvas(1, 1);

renderRectangularCDPToCanvas(generateRectangularCDPMatrix({...settings, payload: leftPayload}), left as unknown as HTMLCanvasElement, {...settings, payload: leftPayload}, {targetHeight: 640});
renderRectangularCDPToCanvas(generateRectangularCDPMatrix({...settings, payload: rightPayload}), right as unknown as HTMLCanvasElement, {...settings, payload: rightPayload}, {targetHeight: 640});
const layout = renderThreePartCompositeToCanvas(left as unknown as HTMLCanvasElement, qr as unknown as HTMLCanvasElement, right as unknown as HTMLCanvasElement, target as unknown as HTMLCanvasElement, {top: leftPayload, bottom: rightPayload});

assert.equal(layout.leftWidthPx, 320);
assert.equal(layout.rightWidthPx, 320);
assert.equal(layout.leftHeightPx, 640);
assert.equal(layout.rightHeightPx, 640);
assert.equal(layout.leftPosition, 'left');
assert.equal(layout.qrPosition, 'center');
assert.equal(layout.rightPosition, 'right');
assert.equal(layout.canvasWidthPx, 320 + layout.gapPx + 640 + layout.gapPx + 320);

function crop(x: number, y: number, width: number, height: number) {
  const output = createCanvas(width, height);
  output.getContext('2d').drawImage(target, x, y, width, height, 0, 0, width, height);
  return output;
}

function assertSamePixels(first: ReturnType<typeof createCanvas>, second: ReturnType<typeof createCanvas>) {
  assert.equal(first.width, second.width);
  assert.equal(first.height, second.height);
  const firstPixels = first.getContext('2d').getImageData(0, 0, first.width, first.height).data;
  const secondPixels = second.getContext('2d').getImageData(0, 0, second.width, second.height).data;
  assert.deepEqual(Array.from(firstPixels), Array.from(secondPixels));
}
const contentHeight = layout.canvasHeightPx - layout.footerHeightPx;
const patternY = Math.floor((contentHeight - layout.patternHeightPx) / 2);
const qrX = layout.leftWidthPx! + layout.gapPx;
const rightX = qrX + layout.qrWidthPx + layout.gapPx;
const leftCrop = crop(0, patternY, layout.leftWidthPx!, layout.leftHeightPx!);
const rightCrop = crop(rightX, patternY, layout.rightWidthPx!, layout.rightHeightPx!);
assertSamePixels(left, leftCrop);
assertSamePixels(right, rightCrop);

assert.deepEqual(decodeRectangularCDPMatrix(generateRectangularCDPMatrix({...settings, payload: leftPayload})), {text: leftPayload, isValid: true});
assert.deepEqual(decodeRectangularCDPMatrix(generateRectangularCDPMatrix({...settings, payload: rightPayload})), {text: rightPayload, isValid: true});
assert.equal(leftCrop.width, left.width);
assert.equal(rightCrop.width, right.width);
console.log('Three-part composite layout round-trip OK');
console.log({left: {x: 0, y: patternY, width: leftCrop.width, height: leftCrop.height}, right: {x: rightX, y: patternY, width: rightCrop.width, height: rightCrop.height}, layout});
