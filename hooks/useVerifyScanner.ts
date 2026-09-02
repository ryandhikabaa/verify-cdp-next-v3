'use client';

import {useEffect, useRef, useState} from 'react';
import {BrowserQRCodeReader} from '@zxing/browser';
import {BarcodeFormat, DecodeHintType} from '@zxing/library';
import {
  RECT_PATTERN_COLUMNS,
  RECT_PATTERN_DOT_DENSITY,
  RECT_PATTERN_ROWS,
  RECT_PATTERN_SAMPLE_RATIO,
} from '@/lib/cdp';
import {decodeV3Matrix} from '@/lib/cdp/v3-matrix';
import {API_BASE, VERIFY_ROI_RATIO} from '@/lib/app-constants';
import {ApiClientError, fetchApi} from '@/lib/api-client';
import type {PatternDoc, VerifyStatus} from '@/lib/types';
import {usePatternLibrary} from '@/hooks/usePatternLibrary';

type VerifyApiResult = {
  status_result: VerifyStatus;
  notes: string | null;
};

const qrHints = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
  [DecodeHintType.TRY_HARDER, true],
]);
const qrCodeReader = new BrowserQRCodeReader(qrHints);
type Point2D = {x: number; y: number};

type QrDetectionPreview = {
  qrDetected: boolean;
  qrValue: string | null;
  qrFormat: string | null;
  qrBounds: Record<string, unknown> | null;
  patternCropBounds: Record<string, unknown> | null;
  qrDataUrl: string | null;
  patternDataUrl: string | null;
  leftPatternDataUrl: string | null;
  rightPatternDataUrl: string | null;
  compositeDataUrl: string | null;
  patternCellBits: number[] | null;
  patternCellConfidence: number | null;
  patternPayloadText?: string | null;
  patternPayloadValid?: boolean;
  leftPatternCellBits: number[] | null;
  leftPatternPayloadText?: string | null;
  leftPatternPayloadValid?: boolean;
  rightPatternCellBits: number[] | null;
  rightPatternPayloadText?: string | null;
  rightPatternPayloadValid?: boolean;
};

type RectDecodeResult = {
  text: string;
  isValid: boolean;
  bitVotes: number[];
  confidence: number;
};

type ScannerDebugInfo = {
  time: string;
  videoSize: string;
  roiSize: string;
  stage: string;
  qrDetected: boolean;
  qrValue: string | null;
  leftDetected: boolean;
  leftValid: boolean;
  leftPayload: string | null;
  rightDetected: boolean;
  rightValid: boolean;
  rightPayload: string | null;
  combinedPayload: string | null;
  confidence: number | null;
  captureDataUrl: string | null;
  qrCropDataUrl: string | null;
  leftCropDataUrl: string | null;
  rightCropDataUrl: string | null;
};

// Enable expensive crop previews only explicitly with `?debugCrop=1`.
// Keeping this opt-in prevents debug image encoding from blocking normal scans.
const ENABLE_SCANNER_DEBUG = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('debugCrop') === '1';
const MAX_SCAN_CANVAS_DIMENSION = 960;

// Fixed scan cadence. Reverted from an adaptive 300/500ms scheme: the decode
// pipeline (ZXing across several input variants plus anchored pattern crops)
// saturates the main thread when fired every 300ms, which starves the camera
// pipeline of compositing time and makes frames arrive stale/soft — net
// slower and less reliable than a relaxed cadence. 700ms keeps scanning
// responsive while leaving decode headroom on low-end phones.
const SCAN_INTERVAL_MS = 700;

function calculateObjectCoverVisibleSource(video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect();
  const displayWidth = Math.max(1, rect.width);
  const displayHeight = Math.max(1, rect.height);
  const videoWidth = Math.max(1, video.videoWidth);
  const videoHeight = Math.max(1, video.videoHeight);
  const displayAspect = displayWidth / displayHeight;
  const videoAspect = videoWidth / videoHeight;

  if (videoAspect > displayAspect) {
    const visibleWidth = videoHeight * displayAspect;
    return {
      x: (videoWidth - visibleWidth) / 2,
      y: 0,
      width: visibleWidth,
      height: videoHeight,
    };
  }

  const visibleHeight = videoWidth / displayAspect;
  return {
    x: 0,
    y: (videoHeight - visibleHeight) / 2,
    width: videoWidth,
    height: visibleHeight,
  };
}

function buildWebDeviceId() {
  if (typeof navigator === 'undefined') {
    return 'WEB-UNKNOWN-CLIENT';
  }

  const platform = (navigator.platform || 'unknown').replace(/[^a-zA-Z0-9]+/g, '-').toUpperCase();
  const language = (navigator.language || 'xx').replace(/[^a-zA-Z0-9]+/g, '-').toUpperCase();
  const agentSeed = `${navigator.userAgent}|${platform}|${language}`;
  const compactSeed = Array.from(agentSeed).reduce((accumulator, char) => {
    return (accumulator * 31 + char.charCodeAt(0)) % 1000000007;
  }, 7);

  return `WEB-${platform}-${language}-${compactSeed}`;
}

function getBrowserLocation() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve<{latitude: number | null; longitude: number | null}>({latitude: null, longitude: null});
  }

  return new Promise<{latitude: number | null; longitude: number | null}>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve({latitude: null, longitude: null});
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 60000,
      },
    );
  });
}

function distanceBetween(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function normalizeVector(vector: Point2D, fallback: Point2D) {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.0001) return fallback;
  return {x: vector.x / length, y: vector.y / length};
}

function orthogonalizeYAxis(xUnit: Point2D, yHint: Point2D) {
  const candidateA = {x: -xUnit.y, y: xUnit.x};
  const candidateB = {x: xUnit.y, y: -xUnit.x};
  const dotA = candidateA.x * yHint.x + candidateA.y * yHint.y;
  const chosen = Math.abs(dotA) >= Math.abs(candidateB.x * yHint.x + candidateB.y * yHint.y) ? candidateA : candidateB;
  return normalizeVector(chosen, {x: 0, y: 1});
}

function addPoint(a: Point2D, b: Point2D): Point2D {
  return {x: a.x + b.x, y: a.y + b.y};
}

function scalePoint(point: Point2D, scale: number): Point2D {
  return {x: point.x * scale, y: point.y * scale};
}

function orderQrPoints(points: Point2D[]) {
  const topLeft = points.reduce((best, point) => (point.x + point.y < best.x + best.y ? point : best));
  const remaining = points.filter((point) => point !== topLeft);
  const [candidateA, candidateB] = remaining;
  const topRight = candidateA.x >= candidateB.x ? candidateA : candidateB;
  const bottomLeft = candidateA.x >= candidateB.x ? candidateB : candidateA;

  return {topLeft, topRight, bottomLeft};
}

function sampleParallelogramRegion(
  sourceCanvas: HTMLCanvasElement,
  origin: Point2D,
  xAxis: Point2D,
  yAxis: Point2D,
  width: number,
  height: number,
) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Let the browser's native canvas compositor perform the affine sampling.
  // The previous implementation read the complete frame and copied every
  // destination pixel in JavaScript; with a detected QR this ran several
  // times per scan and blocked slider/input events on the main thread.
  const determinant = xAxis.x * yAxis.y - xAxis.y * yAxis.x;
  if (Math.abs(determinant) < 0.0001) return null;
  const inverseA = yAxis.y / determinant;
  const inverseB = -xAxis.y / determinant;
  const inverseC = -yAxis.x / determinant;
  const inverseD = xAxis.x / determinant;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(
    inverseA,
    inverseB,
    inverseC,
    inverseD,
    -inverseA * origin.x - inverseC * origin.y,
    -inverseB * origin.x - inverseD * origin.y,
  );
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas;
}

function buildPatternBounds(origin: Point2D, xUnit: Point2D, yUnit: Point2D, width: number, height: number) {
  const topRight = addPoint(origin, scalePoint(xUnit, width));
  const bottomLeft = addPoint(origin, scalePoint(yUnit, height));
  return {
    topLeft: origin,
    topRight,
    bottomLeft,
    bottomRight: addPoint(topRight, scalePoint(yUnit, height)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** Picks the luminance threshold that maximizes between-class variance (Otsu). */
function computeOtsuThreshold(cellMeans: number[]) {
  const histogram = new Array(256).fill(0);
  for (const mean of cellMeans) histogram[Math.max(0, Math.min(255, Math.round(mean)))]++;
  const total = cellMeans.length;
  const weightedTotal = histogram.reduce((sum, count, value) => sum + count * value, 0);
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = -1;
  let threshold = 128;
  for (let value = 0; value < 256; value++) {
    backgroundWeight += histogram[value];
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += value * histogram[value];
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      threshold = value;
    }
  }
  return threshold;
}

function decodeV3PatternCanvas(patternCanvas: HTMLCanvasElement): RectDecodeResult {
  // Small prints: when the anchored crop leaves fewer than ~4 px per row
  // cell, per-cell sampling fights sensor noise on every cell and Otsu has
  // almost no separation left to work with. Upscale nearest-neighbour first:
  // it replicates pixels without inventing intermediate greys, so cell edges
  // stay hard and the threshold search keeps its contrast. Larger crops skip
  // this entirely.
  const MIN_CELL_PX = 4;
  const cellHeightPx = patternCanvas.height / RECT_PATTERN_ROWS;
  let workCanvas = patternCanvas;
  if (cellHeightPx > 0 && cellHeightPx < MIN_CELL_PX) {
    const upscaleScale = Math.min(4, MIN_CELL_PX / cellHeightPx);
    const upscaleCanvas = document.createElement('canvas');
    upscaleCanvas.width = Math.max(1, Math.round(patternCanvas.width * upscaleScale));
    upscaleCanvas.height = Math.max(1, Math.round(patternCanvas.height * upscaleScale));
    const upscaleContext = upscaleCanvas.getContext('2d', {willReadFrequently: true});
    if (upscaleContext) {
      upscaleContext.imageSmoothingEnabled = false;
      upscaleContext.drawImage(patternCanvas, 0, 0, upscaleCanvas.width, upscaleCanvas.height);
      workCanvas = upscaleCanvas;
    }
  }
  const context = workCanvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('V3 pattern canvas context unavailable.');
  const width = workCanvas.width;
  const height = workCanvas.height;
  const pixels = context.getImageData(0, 0, width, height).data;

  // Sample a centered window inside each carrier cell instead of a single
  // pixel. One-pixel sampling flips whole cells on sensor noise, JPEG
  // artifacts, or a crop that is shifted by a fraction of a cell.
  const cellWidth = width / 32;
  const cellHeight = height / 64;
  const sampleWidth = Math.max(2, Math.floor(cellWidth * RECT_PATTERN_SAMPLE_RATIO));
  const sampleHeight = Math.max(2, Math.floor(cellHeight * RECT_PATTERN_SAMPLE_RATIO));
  const cellMeans: number[] = [];
  for (let row = 0; row < 64; row++) {
    for (let column = 0; column < 32; column++) {
      const startX = Math.max(0, Math.floor(column * cellWidth + (cellWidth - sampleWidth) / 2));
      const startY = Math.max(0, Math.floor(row * cellHeight + (cellHeight - sampleHeight) / 2));
      const endX = Math.min(width, startX + sampleWidth);
      const endY = Math.min(height, startY + sampleHeight);
      let sum = 0;
      let count = 0;
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const offset = (y * width + x) * 4;
          sum += 0.299 * pixels[offset] + 0.587 * pixels[offset + 1] + 0.114 * pixels[offset + 2];
          count++;
        }
      }
      cellMeans.push(count > 0 ? sum / count : 128);
    }
  }

  // A fixed 160 cut fails as soon as lighting is uneven across the print
  // (shadow, glare, warm indoor light). Otsu adapts to each frame's own
  // black/white distribution; small prints straddle the cut, so walk a
  // symmetric ±15/±30 band outward from Otsu (worst case five decodes, and
  // only when earlier cuts fail validation).
  const otsu = computeOtsuThreshold(cellMeans);
  let confidenceSum = 0;
  for (const mean of cellMeans) confidenceSum += Math.min(1, Math.abs(mean - otsu) / 96);
  const confidence = confidenceSum / Math.max(1, cellMeans.length);

  // V3 renderer uses matrix value 0 for a black carrier cell and 1 for a
  // white cell. Preserve that convention when converting camera pixels;
  // inverting it makes every sampled V3 bit wrong before mask/repetition
  // decoding can run.
  const buildMatrix = (threshold: number) => Array.from({length: 64}, (_, row) =>
    Array.from({length: 32}, (_, column) => {
      const mean = cellMeans[row * 32 + column];
      return (mean <= threshold ? 0 : 1) as 0 | 1;
    }));
  for (const threshold of [otsu, otsu - 15, otsu + 15, otsu - 30, otsu + 30]) {
    const matrix = buildMatrix(threshold);
    const sampledCells = matrix.flat();
    try {
      const decoded = decodeV3Matrix(matrix);
      return {text: decoded.payload, isValid: true, bitVotes: sampledCells, confidence};
    } catch {
      // Try the next bounded threshold.
    }
  }
  // A geometrically valid crop is still exposed for diagnostics even when
  // this frame fails RS/CRC validation, so the UI never misreports a crop
  // failure as a missing pattern.
  return {text: '', isValid: false, bitVotes: buildMatrix(otsu).flat(), confidence};
}

async function detectQrAnchoredPreview(sourceCanvas: HTMLCanvasElement): Promise<QrDetectionPreview | null> {
  try {
    // Mobile camera frames often contain a visually clear but relatively small
    // QR. Give ZXing one native-resolution attempt and one enlarged attempt;
    // this changes only the decoder input, not the camera preview or crop
    // geometry. Avoid arbitrary image processing pipelines here because they
    // can reduce the finder-pattern contrast.
    let qrResult;
    let qrResultScale = 1;
    let qrResultOffset = {x: 0, y: 0};
    const qrInputs: Array<{canvas: HTMLCanvasElement; scale: number; offset: Point2D}> = [
      {canvas: sourceCanvas, scale: 1, offset: {x: 0, y: 0}},
    ];

    // The V3 contract places QR on the left and the dense rectangular pattern
    // on the right. Do not ask the QR detector to classify both unrelated
    // regions as one barcode image: the pattern can dominate binarization and
    // make a perfectly readable QR fail detection. The left ROI is deliberately
    // broad so it remains safe for perspective and framing variation. The QR
    // itself can occupy roughly three quarters of the ROI in the physical V3
    // layout; using a narrow crop here would cut its right finder/data modules
    // before ZXing gets a chance to decode it.
    const qrRegionCanvas = document.createElement('canvas');
    const qrRegionWidth = Math.max(1, Math.round(sourceCanvas.width * 0.72));
    qrRegionCanvas.width = qrRegionWidth;
    qrRegionCanvas.height = sourceCanvas.height;
    const qrRegionContext = qrRegionCanvas.getContext('2d');
    if (qrRegionContext) {
      qrRegionContext.drawImage(sourceCanvas, 0, 0, qrRegionWidth, sourceCanvas.height, 0, 0, qrRegionWidth, sourceCanvas.height);
      qrInputs.push({canvas: qrRegionCanvas, scale: 1, offset: {x: 0, y: 0}});

      // ZXing's QR reader is substantially more reliable when the input has a
      // real white quiet zone. The generated V3 composition places the pattern
      // close to the QR, so provide that quiet zone explicitly while retaining
      // the original-coordinate offset for perspective calculations.
      const quietZone = Math.max(8, Math.round(Math.min(qrRegionWidth, sourceCanvas.height) * 0.08));
      const isolatedQrCanvas = document.createElement('canvas');
      isolatedQrCanvas.width = qrRegionWidth + quietZone * 2;
      isolatedQrCanvas.height = sourceCanvas.height + quietZone * 2;
      const isolatedQrContext = isolatedQrCanvas.getContext('2d');
      if (isolatedQrContext) {
        isolatedQrContext.fillStyle = '#ffffff';
        isolatedQrContext.fillRect(0, 0, isolatedQrCanvas.width, isolatedQrCanvas.height);
        isolatedQrContext.drawImage(qrRegionCanvas, quietZone, quietZone);
        qrInputs.push({canvas: isolatedQrCanvas, scale: 1, offset: {x: -quietZone, y: -quietZone}});
      }

      const enlargedQrCanvas = document.createElement('canvas');
      enlargedQrCanvas.width = qrRegionWidth * 2;
      enlargedQrCanvas.height = sourceCanvas.height * 2;
      const enlargedQrContext = enlargedQrCanvas.getContext('2d');
      if (enlargedQrContext) {
        enlargedQrContext.imageSmoothingEnabled = false;
        enlargedQrContext.drawImage(qrRegionCanvas, 0, 0, enlargedQrCanvas.width, enlargedQrCanvas.height);
        qrInputs.push({canvas: enlargedQrCanvas, scale: 2, offset: {x: 0, y: 0}});
      }
    }

    for (const input of qrInputs) {
      try {
        qrResult = qrCodeReader.decodeFromCanvas(input.canvas);
        qrResultScale = input.scale;
        qrResultOffset = input.offset;
        break;
      } catch {
        // Try the next known-safe input representation.
      }
    }
    if (!qrResult) return null;
    const resultPoints = qrResult.getResultPoints();
    if (!resultPoints || resultPoints.length < 3) return null;

    const orderedPoints = orderQrPoints(resultPoints.slice(0, 3).map((point) => ({x: point.getX() / qrResultScale + qrResultOffset.x, y: point.getY() / qrResultScale + qrResultOffset.y})));
    const qrXSpan = distanceBetween(orderedPoints.topLeft, orderedPoints.topRight);
    const qrYSpan = distanceBetween(orderedPoints.topLeft, orderedPoints.bottomLeft);
    const qrSize = Math.max(qrXSpan, qrYSpan);

    const xUnit = normalizeVector(
      {x: orderedPoints.topRight.x - orderedPoints.topLeft.x, y: orderedPoints.topRight.y - orderedPoints.topLeft.y},
      {x: 1, y: 0},
    );
    const yHint = normalizeVector(
      {x: orderedPoints.bottomLeft.x - orderedPoints.topLeft.x, y: orderedPoints.bottomLeft.y - orderedPoints.topLeft.y},
      {x: 0, y: 1},
    );
    const yUnit = orthogonalizeYAxis(xUnit, yHint);

    const moduleSize = qrSize / 18;
    // Generator renders the locked QR payload without quiet-zone margin.
    // For this URL ZXing reports finder centers about 18 modules apart
    // (version-2 QR, 25 modules wide), so the outer QR edge is 3.5 modules
    // from each reported finder center. The previous one-module quiet-zone
    // assumption made the verifier crop CDP areas too far outside the code.
    const qrPaddingX = moduleSize * 3.5;
    const qrPaddingY = moduleSize * 3.5;
    const normalizedQrSpan = Math.max(qrXSpan, qrYSpan);
    const qrOrigin = addPoint(
      orderedPoints.topLeft,
      addPoint(scalePoint(xUnit, -qrPaddingX), scalePoint(yUnit, -qrPaddingY)),
    );
    const qrWidth = normalizedQrSpan + qrPaddingX * 2;
    const qrHeight = normalizedQrSpan + qrPaddingY * 2;

    // `qrHeight` is already the 25-module symbol height: ZXing finder centres
    // are 18 modules apart and the 3.5-module expansion on both sides reaches
    // the symbol edges, not the outer one-module quiet-zone edges. Applying
    // 25/27 again here shrinks both pattern axes by 7.4%, clipping its right
    // and bottom edges. The renderer makes the pattern exactly as tall as the
    // QR symbol excluding its quiet zone, so use this height directly.
    const patternHeight = qrHeight;
    const patternWidth = patternHeight * (RECT_PATTERN_COLUMNS / RECT_PATTERN_ROWS);

    // The QR crop is only needed for optional diagnostics. Avoid resampling a
    // second large region on every frame during normal scanning.
    const qrCanvas = ENABLE_SCANNER_DEBUG
      ? sampleParallelogramRegion(
        sourceCanvas,
        qrOrigin,
        scalePoint(xUnit, qrWidth / Math.max(1, Math.round(qrWidth))),
        scalePoint(yUnit, qrHeight / Math.max(1, Math.round(qrHeight))),
        qrWidth,
        qrHeight,
      )
      : null;

    // V3 has exactly one pattern, anchored to the right of the QR. Keep the
    // legacy two-sided search below isolated for old samples only.
    // `qrOrigin + qrWidth` is the right edge of the 25-module QR symbol. The
    // generated canvas then has one quiet-zone module plus one explicit layout
    // gap module before the pattern starts. Search bounded corrections on
    // both axes — half-module shifts first, then full modules, then diagonal
    // combinations — because perspective and finder-center estimation also
    // misplace the pattern vertically, not only horizontally. Each candidate
    // costs a crop+decode only when every earlier candidate failed, so the
    // success path still decodes exactly once.
    const v3GapPx = Math.max(1, Math.round(moduleSize * 2));
    const v3OffsetCandidates: Array<{dx: number; dy: number}> = [
      {dx: 0, dy: 0},
      {dx: -0.5, dy: 0}, {dx: 0.5, dy: 0}, {dx: 0, dy: -0.5}, {dx: 0, dy: 0.5},
      {dx: -0.5, dy: -0.5}, {dx: 0.5, dy: -0.5}, {dx: -0.5, dy: 0.5}, {dx: 0.5, dy: 0.5},
      {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1},
    ];
    const v3Origins = v3OffsetCandidates.map(({dx, dy}) =>
      addPoint(
        addPoint(qrOrigin, scalePoint(xUnit, qrWidth + v3GapPx + moduleSize * dx)),
        scalePoint(yUnit, moduleSize * dy),
      ),
    );
    let primaryV3Preview: QrDetectionPreview | null = null;
    for (const [candidateIndex, v3PatternOrigin] of v3Origins.entries()) {
      const v3PatternCanvas = sampleParallelogramRegion(
        sourceCanvas,
        v3PatternOrigin,
        scalePoint(xUnit, patternWidth / Math.max(1, Math.round(patternWidth))),
        scalePoint(yUnit, patternHeight / Math.max(1, Math.round(patternHeight))),
        patternWidth,
        patternHeight,
      );
      if (!v3PatternCanvas) continue;
      try {
        const v3Decode = decodeV3PatternCanvas(v3PatternCanvas);
        const qrCornerTopRight = addPoint(qrOrigin, scalePoint(xUnit, qrWidth));
        const qrCornerBottomLeft = addPoint(qrOrigin, scalePoint(yUnit, qrHeight));
        const qrCornerBottomRight = addPoint(qrCornerTopRight, scalePoint(yUnit, qrHeight));
        const preview = {
          qrDetected: true, qrValue: qrResult.getText()?.trim() || null,
          qrFormat: qrResult.getBarcodeFormat()?.toString() || 'QR_CODE',
          qrBounds: {topLeft: qrOrigin, topRight: qrCornerTopRight, bottomLeft: qrCornerBottomLeft, bottomRight: qrCornerBottomRight, width: Math.round(qrWidth), height: Math.round(qrHeight)},
          patternCropBounds: {layout: 'v3-qr-pattern', right: buildPatternBounds(v3PatternOrigin, xUnit, yUnit, patternWidth, patternHeight)},
          qrDataUrl: ENABLE_SCANNER_DEBUG ? qrCanvas?.toDataURL('image/png') ?? null : null,
          patternDataUrl: ENABLE_SCANNER_DEBUG ? v3PatternCanvas.toDataURL('image/png') : null,
          leftPatternDataUrl: null, rightPatternDataUrl: ENABLE_SCANNER_DEBUG ? v3PatternCanvas.toDataURL('image/png') : null,
          compositeDataUrl: null, patternCellBits: v3Decode.bitVotes, patternCellConfidence: v3Decode.confidence,
          patternPayloadText: v3Decode.text, patternPayloadValid: v3Decode.isValid,
          leftPatternCellBits: null, leftPatternPayloadText: null, leftPatternPayloadValid: false,
          rightPatternCellBits: v3Decode.bitVotes, rightPatternPayloadText: v3Decode.text, rightPatternPayloadValid: v3Decode.isValid,
        };
        if (candidateIndex === 0) primaryV3Preview = preview;
        // The first geometry is the renderer's exact geometry. Only pay for
        // bounded correction offsets when the exact crop fails validation.
        if (v3Decode.isValid) return preview;
      } catch { /* Try the next bounded V3 anchor candidate. */ }
    }

    // If no correction candidate passes V3 validation, expose the exact
    // renderer-derived geometry—not the final (+1 module) search candidate.
    // Returning the last candidate made debug crops consistently shift right
    // and clip the pattern's left edge.
    if (primaryV3Preview) return primaryV3Preview;

    // QR detection and pattern decoding are separate stages. A valid QR anchor
    // must remain visible in diagnostics even when the estimated pattern crop
    // is outside the frame or does not pass V3 validation; otherwise every crop
    // error is incorrectly reported as "QR belum terdeteksi".
    return {
      qrDetected: true,
      qrValue: qrResult.getText()?.trim() || null,
      qrFormat: qrResult.getBarcodeFormat()?.toString() || 'QR_CODE',
      qrBounds: {
        topLeft: qrOrigin,
        topRight: addPoint(qrOrigin, scalePoint(xUnit, qrWidth)),
        bottomLeft: addPoint(qrOrigin, scalePoint(yUnit, qrHeight)),
        bottomRight: addPoint(addPoint(qrOrigin, scalePoint(xUnit, qrWidth)), scalePoint(yUnit, qrHeight)),
        width: Math.round(qrWidth),
        height: Math.round(qrHeight),
      },
      patternCropBounds: null,
      qrDataUrl: ENABLE_SCANNER_DEBUG ? qrCanvas?.toDataURL('image/png') ?? null : null,
      patternDataUrl: null,
      leftPatternDataUrl: null,
      rightPatternDataUrl: null,
      compositeDataUrl: null,
      patternCellBits: null,
      patternCellConfidence: null,
      patternPayloadText: null,
      patternPayloadValid: false,
      leftPatternCellBits: null,
      leftPatternPayloadText: null,
      leftPatternPayloadValid: false,
      rightPatternCellBits: null,
      rightPatternPayloadText: null,
      rightPatternPayloadValid: false,
    };
  } catch (error) {
    console.warn('QR detection preview gagal diproses dengan ZXing.', error);
    return null;
  }
}

/** Manages camera lifecycle, scan loop, and verification verdict state. */
export function useVerifyScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSessionRef = useRef(0);
  const scanGenerationRef = useRef(0);
  const scanLockRef = useRef(false);
  const zoomRequestRef = useRef<{track: MediaStreamTrack; value: number} | null>(null);
  const zoomApplyLockRef = useRef(false);
  const zoomBusyUntilRef = useRef(0);
  const previousMatchResultRef = useRef(false);
  const [scanMode, setScanMode] = useState<'auto' | 'manual'>('auto');
  const [isScanning, setIsScanning] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [zoomRange, setZoomRange] = useState<{min: number; max: number; step: number} | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(true);
  const [matchResult, setMatchResult] = useState<{
    doc: PatternDoc;
    score: number;
    status: VerifyStatus;
    checksumValid?: boolean;
    decodedLookupId?: string;
    verdictSource?: 'qr-anchor-v1' | 'qr-anchor-v2.1' | 'qr-anchor-v3' | 'legacy-payload';
    qrDetected?: boolean;
    qrValue?: string | null;
    qrFormat?: string | null;
    scanDataUrl: string;
    payloadMode?: 'legacy' | 'encrypted' | 'three-part' | 'unknown';
    rawPayloadText?: string;
    decryptSucceeded?: boolean;
    notes?: string | null;
    responseMessage?: string;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [scannerMessage, setScannerMessage] = useState('Posisikan seluruh kode di dalam kotak, lalu tahan perangkat tetap stabil.');
  const [scannerDebug, setScannerDebug] = useState<ScannerDebugInfo | null>(null);
  const [focusBox, setFocusBox] = useState<{x: number; y: number} | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const patternLibrary = usePatternLibrary(API_BASE);

  useEffect(() => {
    void patternLibrary.loadPatterns();
  }, [patternLibrary.loadPatterns]);

  useEffect(() => {
    if (previousMatchResultRef.current && !matchResult) {
      setScannerMessage('Siap memindai ulang. Posisikan seluruh kode di dalam kotak.');
    }
    previousMatchResultRef.current = Boolean(matchResult);
  }, [matchResult]);

  useEffect(() => {
    void startCamera();
    return () => stopCamera(false);
  }, []);

  useEffect(() => {
    let scanInterval: ReturnType<typeof setInterval>;
    if (scanMode === 'auto' && cameraReady && !matchResult && patternLibrary.docsList.length > 0 && !errorMsg) {
      scanInterval = setInterval(() => {
        // Camera drivers can briefly block the main thread while applying a
        // hardware zoom. Do not compete with that operation by starting a
        // synchronous QR/pattern decode at the same time.
        if (Date.now() < zoomBusyUntilRef.current || zoomApplyLockRef.current) return;
        void handleScan();
      }, SCAN_INTERVAL_MS);
    }
    return () => clearInterval(scanInterval);
  }, [scanMode, cameraReady, matchResult, errorMsg, patternLibrary.docsList.length]);

  /** Starts the mobile camera with fallbacks and safe StrictMode cleanup. */
  const startCamera = async () => {
    const session = ++cameraSessionRef.current;
    scanGenerationRef.current++;
    const previousStream = streamRef.current;
    streamRef.current = null;
    previousStream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;

    setCameraStarting(true);
    setCameraReady(false);
    setHasFlash(false);
    setIsFlashOn(false);
    setCameraZoom(1);
    setZoomRange(null);
    setErrorMsg('');
    setScannerMessage('Mengaktifkan kamera...');

    const attempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: {exact: 'environment'},
          width: {ideal: 1280},
          height: {ideal: 1280},
        },
      },
      {audio: false, video: {facingMode: 'environment'}},
      {audio: false, video: {facingMode: {exact: 'environment'}}},
    ];

    let stream: MediaStream | null = null;
    let lastError: unknown = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Camera API tidak tersedia.', 'NotSupportedError');
      }

      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error) {
          lastError = error;
          if (error instanceof DOMException && error.name === 'NotAllowedError') throw error;
        }
      }
      if (!stream) throw lastError ?? new DOMException('Kamera tidak tersedia.', 'NotReadableError');

      if (session !== cameraSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.warn('Camera stream aktif, playback ditunda browser:', playError);
        }
      }

      const track = stream.getVideoTracks()[0];
      track.onended = () => {
        if (session !== cameraSessionRef.current) return;
        setCameraReady(false);
        setErrorMsg('Stream kamera berhenti. Tekan Coba Lagi untuk mengaktifkannya kembali.');
      };

      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities && (capabilities as any).torch) {
        setHasFlash(true);
        try {
          await track.applyConstraints({advanced: [{torch: true} as any]});
          setIsFlashOn(true);
        } catch (torchError) {
          console.warn('Flash default gagal diaktifkan:', torchError);
          setIsFlashOn(false);
        }
      }
      if (capabilities && (capabilities as any).zoom) {
        const zoomInfo = (capabilities as any).zoom;
        const minZoom = Number.isFinite(zoomInfo.min) ? zoomInfo.min : 1;
        const maxZoom = Number.isFinite(zoomInfo.max) ? zoomInfo.max : minZoom;
        const stepZoom = Number.isFinite(zoomInfo.step) && zoomInfo.step > 0 ? zoomInfo.step : 0.1;
        if (maxZoom > minZoom) {
          setZoomRange({min: minZoom, max: maxZoom, step: stepZoom});
          setCameraZoom(minZoom);
          await track.applyConstraints({advanced: [{zoom: minZoom} as any]}).catch(() => {});
        }
      }
      if (Array.isArray((capabilities as any).focusMode) && (capabilities as any).focusMode.includes('continuous')) {
        await track.applyConstraints({advanced: [{focusMode: 'continuous'} as any]}).catch(() => {});
      }

      setCameraReady(true);
      setScannerMessage('Kamera siap. Posisikan seluruh kode di dalam kotak.');
    } catch (err) {
      console.error('Kamera gagal diakses:', err);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (session !== cameraSessionRef.current) return;

      const errorName = err instanceof DOMException ? err.name : '';
      const messages: Record<string, string> = {
        NotAllowedError: 'Izin kamera ditolak. Aktifkan izin kamera pada pengaturan browser, lalu tekan Coba Lagi.',
        NotFoundError: 'Kamera tidak ditemukan pada perangkat ini.',
        NotReadableError: 'Kamera sedang dipakai aplikasi atau tab lain. Tutup kamera lain, lalu tekan Coba Lagi.',
        AbortError: 'Kamera gagal dimulai. Tutup tab lain yang memakai kamera, lalu coba kembali.',
        OverconstrainedError: 'Mode kamera yang diminta tidak didukung perangkat ini.',
        SecurityError: 'Akses kamera memerlukan koneksi HTTPS yang dipercaya browser.',
        NotSupportedError: 'Browser ini tidak menyediakan Camera API.',
      };
      setErrorMsg(messages[errorName] ?? 'Kamera gagal dimulai. Tutup aplikasi kamera lain lalu tekan Coba Lagi.');
      setScannerMessage('Kamera belum dapat digunakan. Periksa izin kamera lalu coba kembali.');
      setCameraReady(false);
    } finally {
      if (session === cameraSessionRef.current) setCameraStarting(false);
    }
  };

  /** Stops the active camera stream and optionally resets visible state. */
  const stopCamera = (updateState = true) => {
    cameraSessionRef.current++;
    scanGenerationRef.current++;
    zoomRequestRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (updateState) {
      setCameraReady(false);
      setCameraStarting(false);
      setHasFlash(false);
      setIsFlashOn(false);
      setCameraZoom(1);
      setZoomRange(null);
    }
  };

  /** Applies native optical/digital camera zoom when supported. */
  const setCameraZoomLevel = async (nextZoom: number) => {
    if (!streamRef.current || !zoomRange) return;
    const clampedZoom = Math.min(zoomRange.max, Math.max(zoomRange.min, nextZoom));
    const roundedZoom = Math.round(clampedZoom / zoomRange.step) * zoomRange.step;
    const track = streamRef.current.getVideoTracks()[0];
    zoomRequestRef.current = {track, value: roundedZoom};
    // Pause decoding for the complete interaction window. This is important
    // on mobile browsers where applyConstraints() and canvas/ZXing work share
    // the camera thread and can otherwise make the page appear frozen.
    zoomBusyUntilRef.current = Date.now() + 900;
    setCameraZoom(roundedZoom);
    if (zoomApplyLockRef.current) return;

    zoomApplyLockRef.current = true;
    try {
      while (zoomRequestRef.current) {
        const request = zoomRequestRef.current;
        zoomRequestRef.current = null;
        zoomBusyUntilRef.current = 0;
        try {
          await track.applyConstraints({advanced: [{zoom: request.value} as any]});
        } catch (error) {
          // A rapid slider interaction can invalidate an intermediate request;
          // keep the UI responsive and let the newest request win.
          if (zoomRequestRef.current === null) console.warn('Failed to change camera zoom:', error);
        }
      }
    } finally {
      zoomApplyLockRef.current = false;
    }
  };

  /** Toggles torch mode when the current camera supports it. */
  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const newFlashState = !isFlashOn;
      await track.applyConstraints({advanced: [{torch: newFlashState} as any]});
      setIsFlashOn(newFlashState);
    } catch (err) {
      console.error('Failed to toggle flash:', err);
    }
  };

  /** Triggers visual and native focus nudges on tap when supported. */
  const triggerFocus = async (event: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;

    const rect = video.getBoundingClientRect();
    setFocusBox({x: event.clientX - rect.left, y: event.clientY - rect.top});
    setTimeout(() => setFocusBox(null), 800);

    const track = streamRef.current.getVideoTracks()[0];
    const capabilities = track.getCapabilities ? track.getCapabilities() : {};
    try {
      if (capabilities && (capabilities as any).focusMode) {
        await track.applyConstraints({advanced: [{focusMode: 'single-shot'} as any]});
      } else if (capabilities && (capabilities as any).focusDistance) {
        const focusInfo = (capabilities as any).focusDistance;
        await track.applyConstraints({advanced: [{focusDistance: focusInfo.max || 1.0} as any]});
        setTimeout(async () => {
          await track.applyConstraints({advanced: [{focusDistance: focusInfo.min || 0.1} as any]});
        }, 100);
      }
    } catch {
      // Ignored if unsupported by the browser or hardware.
    }
  };

  /** Captures the current ROI, decodes the pattern, and computes the final verdict. */
  /** Submits one verified V3 payload to the API and records the verdict. */
  const submitV3Verification = async (args: {
    lookupId: string;
    scanDataUrl: string;
    qrPreview: QrDetectionPreview | null;
    scanGeneration: number;
    dbList: PatternDoc[];
    payloadMode: 'three-part';
  }) => {
    const {lookupId, scanDataUrl, qrPreview, scanGeneration, dbList, payloadMode} = args;
    const dbMatch = dbList.find((doc) => doc.id === lookupId);
    const {latitude, longitude} = await getBrowserLocation();
    const verifiedAt = new Date().toISOString();

    const verifyResponse = await fetchApi<VerifyApiResult>(`${API_BASE}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        id: lookupId,
        label: lookupId,
        deviceID: buildWebDeviceId(),
        image_data: scanDataUrl,
        latitude,
        longitude,
        qr_value: qrPreview?.qrValue ?? null,
        qr_format: qrPreview?.qrFormat ?? null,
        qr_detected: qrPreview?.qrDetected ?? false,
        qr_bounds: qrPreview?.qrBounds ?? null,
        pattern_crop_bounds: qrPreview?.patternCropBounds ?? null,
        layout_version: 'v3-qr-pattern',
        left_pattern_decode_payload: '',
        right_pattern_decode_payload: '',
        pattern_decode_payload: lookupId,
        decrypt_succeeded: false,
        payload_mode: payloadMode,
        checksum_valid: true,
        raw_payload_text: lookupId,
        created_at: verifiedAt,
        updated_at: verifiedAt,
      }),
    });

    if (scanGeneration !== scanGenerationRef.current) return;

    const status = verifyResponse.data.status_result;
    setMatchResult({
      doc: dbMatch || {id: lookupId, label: 'Counterfeit / Not Registered', density: RECT_PATTERN_DOT_DENSITY},
      score: 0,
      status,
      checksumValid: true,
      decodedLookupId: lookupId,
      verdictSource: qrPreview?.qrDetected ? 'qr-anchor-v3' : 'legacy-payload',
      qrDetected: qrPreview?.qrDetected ?? false,
      qrValue: qrPreview?.qrValue ?? null,
      qrFormat: qrPreview?.qrFormat ?? null,
      scanDataUrl,
      payloadMode,
      rawPayloadText: lookupId,
      decryptSucceeded: false,
      notes: verifyResponse.data.notes,
      responseMessage: verifyResponse.message,
    });
    setScannerMessage(
      status === 'AUTHENTIC'
        ? 'Verifikasi selesai. Produk dinyatakan autentik.'
        : 'Verifikasi selesai. Keaslian produk tidak dapat dikonfirmasi.',
    );
  };

  const handleScan = async () => {
    if (!videoRef.current || scanLockRef.current) return;
    const scanGeneration = scanGenerationRef.current;
    scanLockRef.current = true;
    setIsScanning(true);
    try {
      setScannerMessage('Membaca kode...');
      const video = videoRef.current;
      const visibleSource = calculateObjectCoverVisibleSource(video);
      // Keep capture geometry aligned with v1. The overlay is deliberately
      // conservative: enlarging this ROI reduces the effective QR/module
      // resolution after the canvas is resampled and makes the anchored crop
      // less reliable on phones using object-cover.
      const captureWidth = visibleSource.width * VERIFY_ROI_RATIO;
      const captureHeight = visibleSource.height * VERIFY_ROI_RATIO;
      const startX = Math.max(0, visibleSource.x + (visibleSource.width - captureWidth) / 2);
      const startY = Math.max(0, visibleSource.y + (visibleSource.height - captureHeight) / 2);

      const rawScanCanvas = document.createElement('canvas');
      const captureScale = Math.min(1, MAX_SCAN_CANVAS_DIMENSION / Math.max(captureWidth, captureHeight));
      rawScanCanvas.width = Math.max(1, Math.round(captureWidth * captureScale));
      rawScanCanvas.height = Math.max(1, Math.round(captureHeight * captureScale));
      const rawScanCtx = rawScanCanvas.getContext('2d', {willReadFrequently: true});
      if (!rawScanCtx) return;
      rawScanCtx.drawImage(video, startX, startY, captureWidth, captureHeight, 0, 0, rawScanCanvas.width, rawScanCanvas.height);

      const immediateDebug = {
        time: new Date().toLocaleTimeString('id-ID'),
        videoSize: `${video.videoWidth}×${video.videoHeight}`,
        roiSize: `${rawScanCanvas.width}×${rawScanCanvas.height}`,
        stage: 'Frame kamera tertangkap, membaca QR...',
        qrDetected: false,
        qrValue: null,
        leftDetected: false,
        leftValid: false,
        leftPayload: null,
        rightDetected: false,
        rightValid: false,
        rightPayload: null,
        combinedPayload: null,
        confidence: null,
        captureDataUrl: ENABLE_SCANNER_DEBUG ? rawScanCanvas.toDataURL('image/jpeg', 0.72) : null,
        qrCropDataUrl: null,
        leftCropDataUrl: null,
        rightCropDataUrl: null,
      };
      if (ENABLE_SCANNER_DEBUG) setScannerDebug(immediateDebug);

      const currentQrPreview = await detectQrAnchoredPreview(rawScanCanvas);
      if (scanGeneration !== scanGenerationRef.current) return;
      const debugBase = {
        time: new Date().toLocaleTimeString('id-ID'),
        videoSize: `${video.videoWidth}×${video.videoHeight}`,
        roiSize: `${rawScanCanvas.width}×${rawScanCanvas.height}`,
        qrDetected: Boolean(currentQrPreview?.qrDetected),
        qrValue: currentQrPreview?.qrValue ?? null,
        leftDetected: Boolean(currentQrPreview?.leftPatternCellBits?.length),
        leftValid: Boolean(currentQrPreview?.leftPatternPayloadValid),
        leftPayload: currentQrPreview?.leftPatternPayloadText ?? null,
        rightDetected: Boolean(currentQrPreview?.rightPatternCellBits?.length),
        rightValid: Boolean(currentQrPreview?.rightPatternPayloadValid),
        rightPayload: currentQrPreview?.rightPatternPayloadText ?? null,
        combinedPayload: currentQrPreview?.patternPayloadText ?? null,
        confidence: currentQrPreview?.patternCellConfidence ?? null,
        captureDataUrl: immediateDebug.captureDataUrl,
        qrCropDataUrl: ENABLE_SCANNER_DEBUG ? currentQrPreview?.qrDataUrl ?? null : null,
        leftCropDataUrl: ENABLE_SCANNER_DEBUG ? currentQrPreview?.leftPatternDataUrl ?? null : null,
        rightCropDataUrl: ENABLE_SCANNER_DEBUG ? currentQrPreview?.rightPatternDataUrl ?? null : null,
      };

      // Decode only pixels captured in this frame; never vote a stale crop.
      const qrPreview = currentQrPreview;

      const hasRectangularFrame = Boolean(qrPreview?.patternCellBits?.length);

      if (!qrPreview?.qrDetected) {
        setScannerMessage('Kode belum terbaca. Pastikan seluruh kode terlihat jelas di dalam kotak.');
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: 'QR belum terdeteksi'});
      } else if (!hasRectangularFrame) {
        setScannerMessage('QR sudah terdeteksi, tetapi pattern kanan belum ter-crop. Pastikan seluruh kode terlihat.');
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: 'QR terdeteksi, crop pattern belum terbaca'});
      } else {
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: qrPreview.patternPayloadValid ? 'QR + pattern valid' : 'Pattern ter-crop, checksum belum valid'});
      }

      if (!hasRectangularFrame || !qrPreview) {
        return;
      }

      const currentBitVotes = qrPreview.patternCellBits?.length ? qrPreview.patternCellBits : null;
      if (!currentBitVotes) {
        return;
      }
      // Single-frame verdict only: the current frame either decodes (RS + CRC
      // + repetition inside the codec) or it does not. No cross-frame pooling
      // — a decoded payload is submitted immediately.
      if (!qrPreview.patternPayloadValid) {
        const confidence = qrPreview.patternCellConfidence ?? 0;
        setScannerMessage(
          confidence < 0.25
            ? 'Kode masih kurang jelas. Dekatkan kamera dan hindari pantulan cahaya.'
            : 'Kode sedang dibaca. Tahan posisi tetap stabil.',
        );
        return;
      }

      setScannerMessage('Kode berhasil dibaca. Memeriksa keaslian...');

      const scanDataUrl = qrPreview?.compositeDataUrl || rawScanCanvas.toDataURL('image/jpeg', 0.82);
      // V3 payloads are validated by the matrix codec (RS + CRC) in
      // decodeV3PatternCanvas before this point. The legacy left/right chunk
      // fields stay empty and the API contract switches on layout_version.
      // The V3 payload lives in `patternPayloadText` — the legacy
      // left+right concatenation is always empty for this layout.
      const v3PayloadText = (qrPreview.patternPayloadText ?? '').trim();
      setScannerMessage('Menyelesaikan verifikasi...');
      await submitV3Verification({
        lookupId: v3PayloadText,
        scanDataUrl,
        qrPreview,
        scanGeneration,
        dbList: patternLibrary.docsList,
        payloadMode: 'three-part' as const,
      });
    } catch (error) {
      console.error('Verification scan failed:', error);
      setScannerMessage('Verifikasi belum dapat diselesaikan. Silakan coba kembali.');
      setErrorMsg(
        error instanceof ApiClientError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Verifikasi web gagal direkam ke server. Silakan coba lagi.',
      );
    } finally {
      scanLockRef.current = false;
      setIsScanning(false);
    }
  };

  return {
    videoRef,
    scanMode,
    setScanMode,
    isScanning,
    isFlashOn,
    hasFlash,
    cameraZoom,
    zoomRange,
    cameraReady,
    cameraStarting,
    matchResult,
    setMatchResult,
    errorMsg,
    scannerMessage,
    scannerDebug,
    focusBox,
    isCropModalOpen,
    setIsCropModalOpen,
    docsList: patternLibrary.docsList,
    startCamera,
    toggleFlash,
    setCameraZoomLevel,
    triggerFocus,
    handleScan,
  };
}
