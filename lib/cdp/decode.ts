import type {GeneratorSettings, ScanDecodeResult} from '@/lib/types';
import {CDP_SPREAD_X, CDP_SPREAD_Y, CDP_TOTAL_BITS} from './constants';
import {bitsToString} from './bit-encoding';
import {getStaticMaskBit} from './mask';
import {getFooterHeight} from './render';

/** Detects anchors, aligns the scan, and decodes the embedded CDP ID. */
export function decodeAndAlignPattern(
  sourceCanvas: HTMLCanvasElement,
  settings: GeneratorSettings,
): ScanDecodeResult {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const ctx = sourceCanvas.getContext('2d', {willReadFrequently: true});

  const size = settings.gridSize;
  const borderSize = settings.addMarkers ? Math.max(12, Math.floor(size * settings.dotSize * 0.15)) : 0;
  const targetSize = size * settings.dotSize + borderSize * 2;

  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = targetSize;
  fallbackCanvas.height = targetSize;
  const fallbackCtx = fallbackCanvas.getContext('2d', {willReadFrequently: true});
  if (fallbackCtx) {
    fallbackCtx.imageSmoothingEnabled = true;
    fallbackCtx.drawImage(sourceCanvas, 0, 0, width, height, 0, 0, targetSize, targetSize);
  }

  const failure = (reason: string): ScanDecodeResult => ({
    id: '',
    rawPayloadText: '',
    payloadMode: 'unknown',
    isValid: false,
    rawScore: 0,
    alignedCanvas: fallbackCanvas,
    alignedDisplayCanvas: fallbackCanvas,
    anchorsFound: false,
    reason,
    bitVotes: Array(CDP_TOTAL_BITS).fill(0),
    anchors: [],
    sharpness: 0,
    contrast: 0,
  });

  if (!ctx || !settings.addMarkers) return failure('Alignment marker tidak tersedia.');

  const imgData = ctx.getImageData(0, 0, width, height).data;
  const lumArray = new Uint8Array(width * height);
  let sumLum = 0;
  for (let i = 0; i < width * height; i++) {
    const lum = 0.299 * imgData[i * 4] + 0.587 * imgData[i * 4 + 1] + 0.114 * imgData[i * 4 + 2];
    lumArray[i] = lum;
    sumLum += lum;
  }

  const histogram = new Uint32Array(256);
  for (const lum of lumArray) histogram[lum]++;

  let backgroundSum = 0;
  let totalSum = 0;
  for (let i = 0; i < 256; i++) totalSum += i * histogram[i];

  let backgroundWeight = 0;
  let bestVariance = -1;
  let baseThreshold = Math.round(sumLum / (width * height));
  for (let i = 0; i < 256; i++) {
    backgroundWeight += histogram[i];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = width * height - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += i * histogram[i];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (totalSum - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      baseThreshold = i;
    }
  }

  const integralLum = new Uint32Array(width * height);
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += lumArray[y * width + x];
      integralLum[y * width + x] = rowSum + (y > 0 ? integralLum[(y - 1) * width + x] : 0);
    }
  }

  const windowRadius = Math.max(3, Math.floor(width * 0.05));
  const localThresholds = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const minX = Math.max(0, x - windowRadius);
      const minY = Math.max(0, y - windowRadius);
      const maxX = Math.min(width - 1, x + windowRadius);
      const maxY = Math.min(height - 1, y + windowRadius);

      let boxSum = integralLum[maxY * width + maxX];
      if (minY > 0) boxSum -= integralLum[(minY - 1) * width + maxX];
      if (minX > 0) boxSum -= integralLum[maxY * width + (minX - 1)];
      if (minX > 0 && minY > 0) boxSum += integralLum[(minY - 1) * width + (minX - 1)];

      const count = (maxX - minX + 1) * (maxY - minY + 1);
      const localMean = boxSum / count;
      const thresholdVal = Math.min(baseThreshold + 10, localMean * 0.92);
      localThresholds[y * width + x] = Math.max(10, Math.min(240, thresholdVal));
    }
  }

  type Component = {
    area: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    topLeftTip: {x: number; y: number; value: number};
    topRightTip: {x: number; y: number; value: number};
    bottomLeftTip: {x: number; y: number; value: number};
    quality: number;
  };

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  const components: Component[] = [];
  const minComponentSize = Math.max(5, Math.round(width * height * 0.00001));
  const maxComponentDimension = Math.min(width, height) * 0.35;

  for (let start = 0; start < lumArray.length; start++) {
    const thresh = localThresholds[start];
    if (visited[start] || lumArray[start] >= thresh) continue;
    visited[start] = 1;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let topLeftTip = {x: 0, y: 0, value: Number.POSITIVE_INFINITY};
    let topRightTip = {x: 0, y: 0, value: Number.NEGATIVE_INFINITY};
    let bottomLeftTip = {x: 0, y: 0, value: Number.NEGATIVE_INFINITY};

    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      const y = Math.floor(index / width);
      area++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x + y < topLeftTip.value) topLeftTip = {x, y, value: x + y};
      if (x - y > topRightTip.value) topRightTip = {x, y, value: x - y};
      if (y - x > bottomLeftTip.value) bottomLeftTip = {x, y, value: y - x};

      const neighbours = [index - 1, index + 1, index - width, index + width];
      for (const neighbour of neighbours) {
        if (neighbour < 0 || neighbour >= lumArray.length || visited[neighbour]) continue;
        const neighbourX = neighbour % width;
        const threshold = localThresholds[neighbour];
        if (Math.abs(neighbourX - x) > 1 || lumArray[neighbour] >= threshold) continue;
        visited[neighbour] = 1;
        queue[tail++] = neighbour;
      }
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const fill = area / (componentWidth * componentHeight);
    const aspect = componentWidth / componentHeight;
    if (
      area < minComponentSize ||
      componentWidth < 3 ||
      componentHeight < 3 ||
      componentWidth > maxComponentDimension ||
      componentHeight > maxComponentDimension ||
      aspect < 0.3 ||
      aspect > 3.0 ||
      fill < 0.05 ||
      fill > 0.85
    ) {
      continue;
    }

    const quality = Math.min(componentWidth, componentHeight)
      * (1 - Math.min(0.8, Math.abs(1 - aspect) * 0.45))
      * (1 - Math.min(0.7, Math.abs(0.32 - fill)));
    components.push({area, minX, minY, maxX, maxY, topLeftTip, topRightTip, bottomLeftTip, quality});
  }

  const candidates = components.sort((first, second) => second.quality - first.quality).slice(0, 40);
  let bestTriplet: {tl: Component; tr: Component; bl: Component; score: number} | null = null;

  for (const tlCandidate of candidates) {
    for (const trCandidate of candidates) {
      if (trCandidate === tlCandidate) continue;
      for (const blCandidate of candidates) {
        if (blCandidate === tlCandidate || blCandidate === trCandidate) continue;
        const tlPoint = tlCandidate.topLeftTip;
        const trPoint = trCandidate.topRightTip;
        const blPoint = blCandidate.bottomLeftTip;
        const top = {x: trPoint.x - tlPoint.x, y: trPoint.y - tlPoint.y};
        const left = {x: blPoint.x - tlPoint.x, y: blPoint.y - tlPoint.y};
        const topLength = Math.hypot(top.x, top.y);
        const leftLength = Math.hypot(left.x, left.y);
        if (topLength < width * 0.08 || leftLength < height * 0.08) continue;
        const sideRatio = topLength / leftLength;
        if (sideRatio < 0.4 || sideRatio > 2.5) continue;
        const cross = top.x * left.y - top.y * left.x;
        if (cross <= 0) continue;
        const orthogonality = Math.abs((top.x * left.x + top.y * left.y) / (topLength * leftLength));
        if (orthogonality > 0.6) continue;
        const componentSizes = [
          Math.hypot(tlCandidate.maxX - tlCandidate.minX, tlCandidate.maxY - tlCandidate.minY),
          Math.hypot(trCandidate.maxX - trCandidate.minX, trCandidate.maxY - trCandidate.minY),
          Math.hypot(blCandidate.maxX - blCandidate.minX, blCandidate.maxY - blCandidate.minY),
        ];
        if (Math.max(...componentSizes) / Math.min(...componentSizes) > 3.5) continue;
        const score = orthogonality * 2.6
          + Math.abs(Math.log(sideRatio))
          + Math.abs(Math.log(componentSizes[0] / componentSizes[1])) * 0.4
          + Math.abs(Math.log(componentSizes[0] / componentSizes[2])) * 0.4
          - (tlCandidate.quality + trCandidate.quality + blCandidate.quality) / (width * 2);
        if (!bestTriplet || score < bestTriplet.score) {
          bestTriplet = {tl: tlCandidate, tr: trCandidate, bl: blCandidate, score};
        }
      }
    }
  }

  if (!bestTriplet) return failure('Tiga komponen anchor tidak membentuk geometri L yang valid.');

  const tl = bestTriplet.tl.topLeftTip;
  const tr = bestTriplet.tr.topRightTip;
  const bl = bestTriplet.bl.bottomLeftTip;
  const topVector = {x: tr.x - tl.x, y: tr.y - tl.y};
  const leftVector = {x: bl.x - tl.x, y: bl.y - tl.y};
  const topLength = Math.hypot(topVector.x, topVector.y);
  const leftLength = Math.hypot(leftVector.x, leftVector.y);
  const sideRatio = topLength / leftLength;
  const normalizedDot = Math.abs((topVector.x * leftVector.x + topVector.y * leftVector.y) / (topLength * leftLength));
  const cross = topVector.x * leftVector.y - topVector.y * leftVector.x;
  if (
    topLength < width * 0.08 ||
    leftLength < height * 0.08 ||
    sideRatio < 0.4 ||
    sideRatio > 2.5 ||
    normalizedDot > 0.6 ||
    cross <= 0
  ) {
    return failure('Anchor ditemukan, tetapi geometrinya bukan pola CDP yang valid.');
  }

  const padding = Math.max(2, Math.floor(targetSize * 0.025));
  const tx1 = padding;
  const ty1 = padding;
  const tx2 = targetSize - padding;
  const ty2 = padding;
  const tx3 = padding;
  const ty3 = targetSize - padding;

  const denominator = tx1 * (ty2 - ty3) + tx2 * (ty3 - ty1) + tx3 * (ty1 - ty2);
  if (Math.abs(denominator) < 0.1) return failure('Transformasi anchor tidak dapat dihitung.');

  const a = (tl.x * (ty2 - ty3) + tr.x * (ty3 - ty1) + bl.x * (ty1 - ty2)) / denominator;
  const b = (tx1 * (tr.x - bl.x) + tx2 * (bl.x - tl.x) + tx3 * (tl.x - tr.x)) / denominator;
  const c = (tx1 * (ty2 * bl.x - ty3 * tr.x) + tx2 * (ty3 * tl.x - ty1 * bl.x) + tx3 * (ty1 * tr.x - ty2 * tl.x)) / denominator;
  const d = (tl.y * (ty2 - ty3) + tr.y * (ty3 - ty1) + bl.y * (ty1 - ty2)) / denominator;
  const e = (tx1 * (tr.y - bl.y) + tx2 * (bl.y - tl.y) + tx3 * (tl.y - tr.y)) / denominator;
  const f = (tx1 * (ty2 * bl.y - ty3 * tr.y) + tx2 * (ty3 * tl.y - ty1 * bl.y) + tx3 * (ty1 * tr.y - ty2 * tl.y)) / denominator;

  const alignedCanvas = document.createElement('canvas');
  alignedCanvas.width = targetSize;
  alignedCanvas.height = targetSize;
  const alignedCtx = alignedCanvas.getContext('2d', {willReadFrequently: true});
  const outImg = alignedCtx!.createImageData(targetSize, targetSize);

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const srcX = Math.round(a * x + b * y + c);
      const srcY = Math.round(d * x + e * y + f);
      const outIdx = (y * targetSize + x) * 4;
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const srcIdx = (srcY * width + srcX) * 4;
        outImg.data[outIdx] = imgData[srcIdx];
        outImg.data[outIdx + 1] = imgData[srcIdx + 1];
        outImg.data[outIdx + 2] = imgData[srcIdx + 2];
        outImg.data[outIdx + 3] = 255;
      } else {
        outImg.data[outIdx] = 255;
        outImg.data[outIdx + 1] = 255;
        outImg.data[outIdx + 2] = 255;
        outImg.data[outIdx + 3] = 255;
      }
    }
  }
  alignedCtx!.putImageData(outImg, 0, 0);

  const footerHeight = getFooterHeight(targetSize);
  const alignedDisplayCanvas = document.createElement('canvas');
  alignedDisplayCanvas.width = targetSize;
  alignedDisplayCanvas.height = targetSize + footerHeight;
  const alignedDisplayCtx = alignedDisplayCanvas.getContext('2d', {willReadFrequently: true});

  if (alignedDisplayCtx) {
    const displayImg = alignedDisplayCtx.createImageData(targetSize, targetSize + footerHeight);
    for (let y = 0; y < targetSize + footerHeight; y++) {
      for (let x = 0; x < targetSize; x++) {
        const srcX = Math.round(a * x + b * y + c);
        const srcY = Math.round(d * x + e * y + f);
        const outIdx = (y * targetSize + x) * 4;
        if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
          const srcIdx = (srcY * width + srcX) * 4;
          displayImg.data[outIdx] = imgData[srcIdx];
          displayImg.data[outIdx + 1] = imgData[srcIdx + 1];
          displayImg.data[outIdx + 2] = imgData[srcIdx + 2];
          displayImg.data[outIdx + 3] = 255;
        } else {
          displayImg.data[outIdx] = 255;
          displayImg.data[outIdx + 1] = 255;
          displayImg.data[outIdx + 2] = 255;
          displayImg.data[outIdx + 3] = 255;
        }
      }
    }
    alignedDisplayCtx.putImageData(displayImg, 0, 0);
  }

  let luminanceSum = 0;
  let luminanceSquaredSum = 0;
  let edgeSum = 0;
  let edgeSamples = 0;
  for (let y = 1; y < targetSize - 1; y++) {
    for (let x = 1; x < targetSize - 1; x++) {
      const index = (y * targetSize + x) * 4;
      const luminance = 0.299 * outImg.data[index] + 0.587 * outImg.data[index + 1] + 0.114 * outImg.data[index + 2];
      const rightIndex = (y * targetSize + x + 1) * 4;
      const bottomIndex = ((y + 1) * targetSize + x) * 4;
      const rightLuminance = 0.299 * outImg.data[rightIndex] + 0.587 * outImg.data[rightIndex + 1] + 0.114 * outImg.data[rightIndex + 2];
      const bottomLuminance = 0.299 * outImg.data[bottomIndex] + 0.587 * outImg.data[bottomIndex + 1] + 0.114 * outImg.data[bottomIndex + 2];
      luminanceSum += luminance;
      luminanceSquaredSum += luminance * luminance;
      edgeSum += Math.abs(luminance - rightLuminance) + Math.abs(luminance - bottomLuminance);
      edgeSamples += 2;
    }
  }

  const luminanceSamples = (targetSize - 2) * (targetSize - 2);
  const luminanceMean = luminanceSum / luminanceSamples;
  const contrast = Math.sqrt(Math.max(0, luminanceSquaredSum / luminanceSamples - luminanceMean ** 2));
  const sharpness = edgeSamples ? edgeSum / edgeSamples : 0;

  const bitVotes = new Int32Array(CDP_TOTAL_BITS);
  const radiusCells = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      if (dx * dx + dy * dy > radiusCells * radiusCells) continue;

      const px = borderSize + Math.floor(x * settings.dotSize + settings.dotSize / 2);
      const py = borderSize + Math.floor(y * settings.dotSize + settings.dotSize / 2);
      const radius = Math.floor(settings.dotSize * 1.5);
      let localSum = 0;
      let localCount = 0;

      for (let ny = -radius; ny <= radius; ny++) {
        for (let nx = -radius; nx <= radius; nx++) {
          const sx = px + nx;
          const sy = py + ny;
          if (sx >= 0 && sx < targetSize && sy >= 0 && sy < targetSize) {
            const idx = (sy * targetSize + sx) * 4;
            localSum += 0.299 * outImg.data[idx] + 0.587 * outImg.data[idx + 1] + 0.114 * outImg.data[idx + 2];
            localCount++;
          }
        }
      }

      const localThresholdVal = localCount > 0 ? (localSum / localCount) * 0.95 : baseThreshold;
      const outIdx = (py * targetSize + px) * 4;
      const lum = 0.299 * outImg.data[outIdx] + 0.587 * outImg.data[outIdx + 1] + 0.114 * outImg.data[outIdx + 2];
      const scannedBit = lum < localThresholdVal ? 0 : 1;
      const maskBit = getStaticMaskBit(x, y);
      const rawBit = scannedBit ^ maskBit;

      const bitIndex = (x * CDP_SPREAD_X + y * CDP_SPREAD_Y) % CDP_TOTAL_BITS;
      bitVotes[bitIndex] += rawBit === 1 ? 1 : -1;
    }
  }

  const finalBits: number[] = [];
  let confidenceScore = 0;
  for (let i = 0; i < CDP_TOTAL_BITS; i++) {
    finalBits.push(bitVotes[i] > 0 ? 1 : 0);
    confidenceScore += Math.abs(bitVotes[i]);
  }

  const result = bitsToString(finalBits);
  const rawPayloadText = result.text;
  const legacyPayloadPattern = /^[A-Z0-9]{1,12}$/;
  const payloadMode: 'legacy' | 'encrypted' | 'unknown' = result.isValid
    ? (legacyPayloadPattern.test(rawPayloadText) ? 'legacy' : 'encrypted')
    : 'unknown';
  const maxPossibleConfidence = (Math.PI * radiusCells * radiusCells) / CDP_TOTAL_BITS;
  const rawScore = confidenceScore / CDP_TOTAL_BITS / maxPossibleConfidence;

  return {
    id: result.text,
    rawPayloadText,
    payloadMode,
    isValid: result.isValid,
    rawScore,
    alignedCanvas,
    alignedDisplayCanvas,
    anchorsFound: true,
    reason: result.isValid ? 'ID berhasil didekode.' : 'Anchor valid, tetapi checksum ID belum cocok.',
    bitVotes: Array.from(bitVotes),
    anchors: [tl.x / width, tl.y / height, tr.x / width, tr.y / height, bl.x / width, bl.y / height],
    sharpness,
    contrast,
  };
}
