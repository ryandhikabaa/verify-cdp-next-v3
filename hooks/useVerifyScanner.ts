'use client';

import {useEffect, useRef, useState} from 'react';
import {BrowserQRCodeReader} from '@zxing/browser';
import {
  RECT_PATTERN_COLUMNS,
  RECT_PATTERN_DOT_DENSITY,
  RECT_PATTERN_ROWS,
  RECT_PATTERN_SAMPLE_RATIO,
  STANDARD_CDP_SETTINGS,
  bitsToString,
  decryptPayloadToSeed,
  decodeAndAlignPattern,
  getFooterHeight,
  getStaticMaskBit,
  normalizeCDPSettings,
} from '@/lib/cdp';
import {CDP_SPREAD_X, CDP_SPREAD_Y, CDP_TOTAL_BITS} from '@/lib/cdp/constants';
import {API_BASE, VERIFY_ROI_RATIO} from '@/lib/app-constants';
import {ApiClientError, fetchApi} from '@/lib/api-client';
import {isLikelyLegacyPayload} from '@/lib/verifier-core';
import type {PatternDoc, VerifyStatus} from '@/lib/types';
import {usePatternLibrary} from '@/hooks/usePatternLibrary';

type VerifyApiResult = {
  status_result: VerifyStatus;
  notes: string | null;
};

const qrCodeReader = new BrowserQRCodeReader();
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

const MIN_SCAN_RAW_SCORE = 0.08;
const MIN_SCAN_SHARPNESS = 2.5;
const MIN_SCAN_CONTRAST = 6;
const MIN_STABLE_VALID_FRAMES = 1;
const MAX_CHECKSUM_RECOVERY_FRAMES = 6; 
const ENABLE_SCANNER_DEBUG = false;

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

function isFrameReliable(frame: ReturnType<typeof decodeAndAlignPattern>) {
  const payloadHint = (frame.rawPayloadText ?? frame.id ?? '').trim();
  const hasPayloadHint = payloadHint.length > 0;

  if (!frame.anchorsFound && !hasPayloadHint) {
    return {ok: false, message: 'Kode belum terbaca. Pastikan seluruh kode berada di dalam kotak.'};
  }

  if (frame.rawScore < MIN_SCAN_RAW_SCORE && !hasPayloadHint) {
    return {ok: false, message: 'Kode belum terlihat jelas. Dekatkan kamera dan pastikan seluruh kode terlihat.'};
  }

  if (frame.sharpness < MIN_SCAN_SHARPNESS && !hasPayloadHint) {
    return {ok: false, message: 'Gambar terlalu blur. Tahan perangkat lebih stabil lalu fokus ulang.'};
  }

  if (frame.contrast < MIN_SCAN_CONTRAST && !hasPayloadHint) {
    return {ok: false, message: 'Pencahayaan kurang sesuai. Hindari pantulan cahaya dan coba kembali.'};
  }

  return {
    ok: true,
    message: hasPayloadHint
      ? 'Kode mulai terbaca. Tahan posisi perangkat.'
      : frame.reason,
  };
}

function recoverPayloadFromVotes(voteHistory: number[][]) {
  if (voteHistory.length === 0) return {text: '', isValid: false};

  const totals = new Array(voteHistory[0].length).fill(0);
  for (const votes of voteHistory) {
    for (let index = 0; index < votes.length; index++) {
      totals[index] += votes[index];
    }
  }

  const recoveredBits = totals.map((value) => (value > 0 ? 1 : 0));
  return bitsToString(recoveredBits);
}

function distanceBetween(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

  function getMaxForwardSpanWithinCanvas(
    sourceCanvas: HTMLCanvasElement,
    origin: Point2D,
    xUnit: Point2D,
    yUnit: Point2D,
    height: number,
  ): number {
    const corners = [origin, addPoint(origin, scalePoint(yUnit, height))];
    const candidates: number[] = [];

    for (const corner of corners) {
      if (Math.abs(xUnit.x) > 1e-6) {
        const limitX = xUnit.x > 0 ? sourceCanvas.width - 1 : 0;
        candidates.push((limitX - corner.x) / xUnit.x);
      }

      if (Math.abs(xUnit.y) > 1e-6) {
        const limitY = xUnit.y > 0 ? sourceCanvas.height - 1 : 0;
        candidates.push((limitY - corner.y) / xUnit.y);
      }
    }

    const positiveCandidates = candidates.filter((value) => Number.isFinite(value) && value > 0);
    if (positiveCandidates.length === 0) {
      return 0;
    }

    return Math.max(0, Math.min(...positiveCandidates));
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

  const sourceCtx = sourceCanvas.getContext('2d', {willReadFrequently: true});
  if (!sourceCtx) return null;

  const sourceImage = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const targetImage = ctx.createImageData(canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const sampleX = origin.x + xAxis.x * (x + 0.5) + yAxis.x * (y + 0.5);
      const sampleY = origin.y + xAxis.y * (x + 0.5) + yAxis.y * (y + 0.5);
      const srcX = Math.max(0, Math.min(sourceCanvas.width - 1, Math.round(sampleX)));
      const srcY = Math.max(0, Math.min(sourceCanvas.height - 1, Math.round(sampleY)));
      const sourceIndex = (srcY * sourceCanvas.width + srcX) * 4;
      const targetIndex = (y * canvas.width + x) * 4;

      targetImage.data[targetIndex] = sourceImage.data[sourceIndex];
      targetImage.data[targetIndex + 1] = sourceImage.data[sourceIndex + 1];
      targetImage.data[targetIndex + 2] = sourceImage.data[sourceIndex + 2];
      targetImage.data[targetIndex + 3] = sourceImage.data[sourceIndex + 3];
    }
  }

  ctx.putImageData(targetImage, 0, 0);

  return canvas;
}

function normalizePatternCanvas(sourceCanvas: HTMLCanvasElement, scale = 8) {
  const canvas = document.createElement('canvas');
  canvas.width = RECT_PATTERN_COLUMNS * scale;
  canvas.height = RECT_PATTERN_ROWS * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, 0, 0, canvas.width, canvas.height);

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

function decodeRectangularPatternCanvas(patternCanvas: HTMLCanvasElement): RectDecodeResult {
  const width = patternCanvas.width;
  const height = patternCanvas.height;
  const ctx = patternCanvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) {
    return {text: '', isValid: false, bitVotes: Array(CDP_TOTAL_BITS).fill(0), confidence: 0};
  }

  const image = ctx.getImageData(0, 0, width, height).data;
  const bitVotes = new Int32Array(CDP_TOTAL_BITS);
  const cellWidth = width / RECT_PATTERN_COLUMNS;
  const cellHeight = height / RECT_PATTERN_ROWS;
  const cellMeans: number[] = [];

  for (let y = 0; y < RECT_PATTERN_ROWS; y++) {
    for (let x = 0; x < RECT_PATTERN_COLUMNS; x++) {
      // Use an exact half-open core window. The previous inclusive radius loop
      // sampled 5/8 of an 8px cell and reached adjacent cells too easily when
      // the camera crop was shifted by a fraction of a cell.
      const sampleWidth = Math.max(2, Math.floor(cellWidth * RECT_PATTERN_SAMPLE_RATIO));
      const sampleHeight = Math.max(2, Math.floor(cellHeight * RECT_PATTERN_SAMPLE_RATIO));
      const startX = Math.max(0, Math.floor(x * cellWidth + (cellWidth - sampleWidth) / 2));
      const startY = Math.max(0, Math.floor(y * cellHeight + (cellHeight - sampleHeight) / 2));
      const endX = Math.min(width, startX + sampleWidth);
      const endY = Math.min(height, startY + sampleHeight);
      let localSum = 0;
      let localCount = 0;

      for (let sampleY = startY; sampleY < endY; sampleY++) {
        for (let sampleX = startX; sampleX < endX; sampleX++) {
          const index = (sampleY * width + sampleX) * 4;
          localSum += 0.299 * image[index] + 0.587 * image[index + 1] + 0.114 * image[index + 2];
          localCount++;
        }
      }

      const localMean = localCount > 0 ? localSum / localCount : 128;
      cellMeans.push(localMean);
    }
  }

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

  let confidenceSum = 0;
  let cellIndex = 0;
  for (let y = 0; y < RECT_PATTERN_ROWS; y++) {
    for (let x = 0; x < RECT_PATTERN_COLUMNS; x++) {
      const cellMean = cellMeans[cellIndex++];
      const scannedBit = cellMean <= threshold ? 0 : 1;
      confidenceSum += Math.min(1, Math.abs(cellMean - threshold) / 96);
      const axialMask = getStaticMaskBit(x + 11, y + 7);
      const rawBit = scannedBit ^ axialMask;
      const bitIndex = (x * CDP_SPREAD_X + y * CDP_SPREAD_Y + (x * y % 17)) % CDP_TOTAL_BITS;
      bitVotes[bitIndex] += rawBit === 1 ? 1 : -1;
    }
  }

  const finalBits = Array.from(bitVotes, (vote) => (vote > 0 ? 1 : 0));
  const decoded = bitsToString(finalBits);
  return {
    text: decoded.text,
    isValid: decoded.isValid,
    bitVotes: Array.from(bitVotes),
    confidence: confidenceSum / Math.max(1, total),
  };
}

async function detectQrAnchoredPreview(sourceCanvas: HTMLCanvasElement): Promise<QrDetectionPreview | null> {
  try {
    const qrResult = qrCodeReader.decodeFromCanvas(sourceCanvas);
    const resultPoints = qrResult.getResultPoints();
    if (!resultPoints || resultPoints.length < 3) return null;

    const orderedPoints = orderQrPoints(resultPoints.slice(0, 3).map((point) => ({x: point.getX(), y: point.getY()})));
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

    const patternHeight = qrHeight;
    const patternWidth = patternHeight * (RECT_PATTERN_COLUMNS / RECT_PATTERN_ROWS);
    const expectedGap = Math.round(patternWidth * 0.075);
    const gapCandidates = Array.from(new Set([
      expectedGap,
      Math.round(expectedGap - moduleSize * 0.75),
      Math.round(expectedGap + moduleSize * 0.75),
      Math.round(expectedGap - moduleSize * 1.5),
      Math.round(expectedGap + moduleSize * 1.5),
    ])).filter((value) => value > 0);

    const qrCanvas = sampleParallelogramRegion(
      sourceCanvas,
      qrOrigin,
      scalePoint(xUnit, qrWidth / Math.max(1, Math.round(qrWidth))),
      scalePoint(yUnit, qrHeight / Math.max(1, Math.round(qrHeight))),
      qrWidth,
      qrHeight,
    );
    if (!qrCanvas) return null;

    // Finder points provide an approximate anchor, but a sub-cell error can
    // corrupt a 32x64 decode. Try nearby positions and let the pattern checksum
    // select the candidate; the QR content is never used as payload.
    const decodeAnchoredPattern = (estimatedOrigin: Point2D) => {
      const offsetCandidates = [
        {x: 0, y: 0},
        {x: -0.75, y: 0},
        {x: 0.75, y: 0},
        {x: 0, y: -0.75},
        {x: 0, y: 0.75},
      ];
      let patternOrigin = estimatedOrigin;
      let normalizedPatternCanvas: HTMLCanvasElement | null = null;
      let rectDecode: RectDecodeResult | null = null;

      for (const offset of offsetCandidates) {
        const candidateOrigin = addPoint(
          estimatedOrigin,
          addPoint(scalePoint(xUnit, moduleSize * offset.x), scalePoint(yUnit, moduleSize * offset.y)),
        );
        const candidateCanvas = sampleParallelogramRegion(
          sourceCanvas,
          candidateOrigin,
          scalePoint(xUnit, patternWidth / Math.max(1, Math.round(patternWidth))),
          scalePoint(yUnit, patternHeight / Math.max(1, Math.round(patternHeight))),
          patternWidth,
          patternHeight,
        );
        if (!candidateCanvas) continue;
        const candidateNormalized = normalizePatternCanvas(candidateCanvas);
        if (!candidateNormalized) continue;
        const candidateDecode = decodeRectangularPatternCanvas(candidateNormalized);

        if (!rectDecode || candidateDecode.confidence > rectDecode.confidence || candidateDecode.isValid) {
          patternOrigin = candidateOrigin;
          normalizedPatternCanvas = candidateNormalized;
          rectDecode = candidateDecode;
        }
        if (candidateDecode.isValid) break;
      }

      if (!normalizedPatternCanvas || !rectDecode) return null;
      return {origin: patternOrigin, canvas: normalizedPatternCanvas, decode: rectDecode};
    };

    let bestPatternPair: {
      gapPx: number;
      leftPatternOrigin: Point2D;
      rightPatternOrigin: Point2D;
      leftPattern: NonNullable<ReturnType<typeof decodeAnchoredPattern>>;
      rightPattern: NonNullable<ReturnType<typeof decodeAnchoredPattern>>;
      score: number;
    } | null = null;

    const inwardOffsetCandidates = [moduleSize, moduleSize * 1.75];
    const verticalOffsetCandidates = [0, moduleSize * 0.75, -moduleSize * 0.75];

    for (const candidateGapPx of gapCandidates) {
      for (const inwardOffset of inwardOffsetCandidates) {
        for (const verticalOffset of verticalOffsetCandidates) {
          const candidateLeftOrigin = addPoint(
            qrOrigin,
            addPoint(scalePoint(xUnit, -(candidateGapPx + patternWidth) + inwardOffset), scalePoint(yUnit, verticalOffset)),
          );
          const candidateRightOrigin = addPoint(
            qrOrigin,
            addPoint(scalePoint(xUnit, qrWidth + candidateGapPx - inwardOffset), scalePoint(yUnit, verticalOffset)),
          );
          const maxLeftPatternWidth = getMaxForwardSpanWithinCanvas(sourceCanvas, candidateLeftOrigin, xUnit, yUnit, patternHeight);
          const maxRightPatternWidth = getMaxForwardSpanWithinCanvas(sourceCanvas, candidateRightOrigin, xUnit, yUnit, patternHeight);
          if (maxLeftPatternWidth < patternWidth + 2 || maxRightPatternWidth < patternWidth + 2) continue;

          const candidateLeftPattern = decodeAnchoredPattern(candidateLeftOrigin);
          const candidateRightPattern = decodeAnchoredPattern(candidateRightOrigin);
          if (!candidateLeftPattern || !candidateRightPattern) continue;

          const score =
            (candidateLeftPattern.decode.isValid ? 2 : 0) +
            (candidateRightPattern.decode.isValid ? 2 : 0) +
            candidateLeftPattern.decode.confidence +
            candidateRightPattern.decode.confidence;
          if (!bestPatternPair || score > bestPatternPair.score) {
            bestPatternPair = {
              gapPx: candidateGapPx,
              leftPatternOrigin: candidateLeftOrigin,
              rightPatternOrigin: candidateRightOrigin,
              leftPattern: candidateLeftPattern,
              rightPattern: candidateRightPattern,
              score,
            };
          }
          if (candidateLeftPattern.decode.isValid && candidateRightPattern.decode.isValid) break;
        }
        if (bestPatternPair?.leftPattern.decode.isValid && bestPatternPair.rightPattern.decode.isValid) break;
      }
      if (bestPatternPair?.leftPattern.decode.isValid && bestPatternPair.rightPattern.decode.isValid) break;
    }

    if (!bestPatternPair) return null;
    const {gapPx, leftPatternOrigin, leftPattern, rightPattern} = bestPatternPair;
    const leftPayloadText = leftPattern.decode.text.trim();
    const rightPayloadText = rightPattern.decode.text.trim();
    const combinedPayloadText = leftPayloadText && rightPayloadText ? `${leftPayloadText}${rightPayloadText}` : '';

    // Keep the narrow pattern crop above exclusively for decoding. The
    // evidence crop follows the generated composite layout and includes the
    // QR, rectangular pattern, and seed footer in one image.
    const compositeWidth = patternWidth + gapPx + qrWidth + gapPx + patternWidth;
    const compositeContentHeight = Math.max(qrHeight, moduleSize + patternHeight);
    const compositeFooterHeight = getFooterHeight(compositeWidth);
    const compositeHeight = compositeContentHeight + compositeFooterHeight;
    const compositeCanvas = sampleParallelogramRegion(
      sourceCanvas,
      leftPatternOrigin,
      scalePoint(xUnit, compositeWidth / Math.max(1, Math.round(compositeWidth))),
      scalePoint(yUnit, compositeHeight / Math.max(1, Math.round(compositeHeight))),
      compositeWidth,
      compositeHeight,
    );
    const qrCornerTopRight = addPoint(qrOrigin, scalePoint(xUnit, qrWidth));
    const qrCornerBottomLeft = addPoint(qrOrigin, scalePoint(yUnit, qrHeight));
    const qrCornerBottomRight = addPoint(qrCornerTopRight, scalePoint(yUnit, qrHeight));

    return {
      qrDetected: true,
      qrValue: qrResult.getText()?.trim() || null,
      qrFormat: qrResult.getBarcodeFormat()?.toString() || 'QR_CODE',
      qrBounds: {
        topLeft: qrOrigin,
        topRight: qrCornerTopRight,
        bottomLeft: qrCornerBottomLeft,
        bottomRight: qrCornerBottomRight,
        width: Math.round(qrWidth),
        height: Math.round(qrHeight),
      },
      patternCropBounds: {
        layout: 'three-part-v2.1',
        left: buildPatternBounds(leftPattern.origin, xUnit, yUnit, patternWidth, patternHeight),
        right: buildPatternBounds(rightPattern.origin, xUnit, yUnit, patternWidth, patternHeight),
      },
      qrDataUrl: ENABLE_SCANNER_DEBUG ? qrCanvas.toDataURL('image/png') : null,
      patternDataUrl: ENABLE_SCANNER_DEBUG ? compositeCanvas?.toDataURL('image/png') ?? null : null,
      leftPatternDataUrl: ENABLE_SCANNER_DEBUG ? leftPattern.canvas.toDataURL('image/png') : null,
      rightPatternDataUrl: ENABLE_SCANNER_DEBUG ? rightPattern.canvas.toDataURL('image/png') : null,
      compositeDataUrl: ENABLE_SCANNER_DEBUG ? compositeCanvas?.toDataURL('image/png') ?? null : null,
      patternCellBits: [...leftPattern.decode.bitVotes, ...rightPattern.decode.bitVotes],
      patternCellConfidence: Math.min(leftPattern.decode.confidence, rightPattern.decode.confidence),
      patternPayloadText: combinedPayloadText,
      patternPayloadValid: leftPattern.decode.isValid && rightPattern.decode.isValid,
      leftPatternCellBits: leftPattern.decode.bitVotes,
      leftPatternPayloadText: leftPayloadText,
      leftPatternPayloadValid: leftPattern.decode.isValid,
      rightPatternCellBits: rightPattern.decode.bitVotes,
      rightPatternPayloadText: rightPayloadText,
      rightPatternPayloadValid: rightPattern.decode.isValid,
    };
  } catch (error) {
    console.warn('QR detection preview gagal diproses dengan ZXing.', error);
    return null;
  }
}

/**
 * Resolves the decoded seed from the provided frame.
 */

/** Manages camera lifecycle, scan loop, and verification verdict state. */
export function useVerifyScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraSessionRef = useRef(0);
  const scanGenerationRef = useRef(0);
  const scanLockRef = useRef(false);
  const previousMatchResultRef = useRef(false);
  const stableFrameRef = useRef<{id: string; count: number; voteHistory: number[][]}>({id: '', count: 0, voteHistory: []});
  const sidePayloadCacheRef = useRef<{
    qrKey: string;
    leftPayload: string;
    rightPayload: string;
    leftVotes: number[] | null;
    rightVotes: number[] | null;
    updatedAt: number;
  }>({qrKey: '', leftPayload: '', rightPayload: '', leftVotes: null, rightVotes: null, updatedAt: 0});
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
    verdictSource?: 'qr-anchor-v1' | 'qr-anchor-v2.1' | 'legacy-payload';
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

  async function resolveDecodedSeed(frame: ReturnType<typeof decodeAndAlignPattern>) {
    const rawPayloadText = frame.rawPayloadText ?? frame.id;

    if (isLikelyLegacyPayload(rawPayloadText)) {
      return {
        lookupId: rawPayloadText,
        rawPayloadText,
        payloadMode: 'legacy' as const,
        decryptSucceeded: false,
      };
    }

    try {
      const decryptedSeed = await decryptPayloadToSeed(rawPayloadText);
      return {
        lookupId: decryptedSeed,
        rawPayloadText,
        payloadMode: 'encrypted' as const,
        decryptSucceeded: true,
      };
    } catch (error) {
      console.warn('Payload decrypt gagal, fallback ke lookup legacy/plaintext.', error);
      return {
        lookupId: rawPayloadText || 'UNREADABLE_PAYLOAD',
        rawPayloadText,
        payloadMode: 'legacy' as const,
        decryptSucceeded: false,
      };
    }
  }
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
      stableFrameRef.current = {id: '', count: 0, voteHistory: []};
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
        void handleScan();
      }, 850);
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
    try {
      await track.applyConstraints({advanced: [{zoom: roundedZoom} as any]});
      setCameraZoom(roundedZoom);
    } catch (error) {
      console.error('Failed to change camera zoom:', error);
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
      rawScanCanvas.width = Math.max(1, Math.round(captureWidth));
      rawScanCanvas.height = Math.max(1, Math.round(captureHeight));
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
      const now = Date.now();
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

      const hasQrAnchor = Boolean(currentQrPreview?.qrDetected);
      const hasAnchoredRectangularFrame = Boolean(currentQrPreview?.patternCellBits?.length);
      const baseSettings = normalizeCDPSettings(STANDARD_CDP_SETTINGS);
      const frame = hasQrAnchor && hasAnchoredRectangularFrame
        ? null
        : decodeAndAlignPattern(rawScanCanvas, {...baseSettings, addMarkers: true});
      const reliability = frame ? isFrameReliable(frame) : {ok: true, message: ''};
      const qrBounds = qrPreview?.qrBounds;
      const qrBoundsRecord = qrBounds as Record<string, unknown> | null;
      const topLeft = qrBoundsRecord?.topLeft as {x?: number; y?: number} | undefined;
      const bottomRight = qrBoundsRecord?.bottomRight as {x?: number; y?: number} | undefined;
      const geometryKey = qrBounds
        ? `:${Math.round(topLeft?.x ?? 0)}:${Math.round(topLeft?.y ?? 0)}:${Math.round(bottomRight?.x ?? 0)}:${Math.round(bottomRight?.y ?? 0)}`
        : '';
      const qrCacheKey = qrPreview?.qrDetected ? `${qrPreview.qrValue || 'detected'}${geometryKey}` : '';
      if (qrCacheKey !== sidePayloadCacheRef.current.qrKey) {
        sidePayloadCacheRef.current = {qrKey: qrCacheKey, leftPayload: '', rightPayload: '', leftVotes: null, rightVotes: null, updatedAt: 0};
      }

      const currentLeftPayloadText = qrPreview?.leftPatternPayloadValid ? (qrPreview.leftPatternPayloadText ?? '').trim() : '';
      const currentRightPayloadText = qrPreview?.rightPatternPayloadValid ? (qrPreview.rightPatternPayloadText ?? '').trim() : '';
      if (qrCacheKey && currentLeftPayloadText) {
        sidePayloadCacheRef.current = {
          ...sidePayloadCacheRef.current,
          qrKey: qrCacheKey,
          leftPayload: currentLeftPayloadText,
          leftVotes: qrPreview?.leftPatternCellBits ?? sidePayloadCacheRef.current.leftVotes,
          updatedAt: now,
        };
      }
      if (qrCacheKey && currentRightPayloadText) {
        sidePayloadCacheRef.current = {
          ...sidePayloadCacheRef.current,
          qrKey: qrCacheKey,
          rightPayload: currentRightPayloadText,
          rightVotes: qrPreview?.rightPatternCellBits ?? sidePayloadCacheRef.current.rightVotes,
          updatedAt: now,
        };
      }
      // Never promote a cached payload to a current frame. The QR value is
      // intentionally shared by different printed samples, so that cache can
      // otherwise make pattern A appear after the camera has moved to Z.
      const leftPayloadText = currentLeftPayloadText;
      const rightPayloadText = currentRightPayloadText;
      const rectPayloadText = leftPayloadText && rightPayloadText ? `${leftPayloadText}${rightPayloadText}` : '';
      debugBase.leftDetected = Boolean(leftPayloadText);
      debugBase.leftValid = Boolean(leftPayloadText);
      debugBase.leftPayload = leftPayloadText || null;
      debugBase.rightDetected = Boolean(rightPayloadText);
      debugBase.rightValid = Boolean(rightPayloadText);
      debugBase.rightPayload = rightPayloadText || null;
      debugBase.combinedPayload = rectPayloadText || debugBase.combinedPayload;
      const rectangularPayloadHint = rectPayloadText;
      // Group invalid frames by their stable QR anchor instead of arbitrary
      // checksum-invalid bytes. QR identity never becomes the verified seed.
      const frameKey = qrPreview?.qrDetected ? `qr-anchor:${qrCacheKey}` : '';
      const hasPayloadHint = rectangularPayloadHint.length > 0;
      const hasRectangularFrame = Boolean(qrPreview?.patternCellBits?.length);

      if (!qrPreview?.qrDetected) {
        setScannerMessage('Kode belum terbaca. Pastikan seluruh kode terlihat jelas di dalam kotak.');
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: 'QR belum terdeteksi'});
      } else if (!hasRectangularFrame) {
        setScannerMessage('QR sudah terdeteksi, tetapi CDP kiri/kanan belum utuh. Pastikan seluruh kode lebar masuk ke kotak.');
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: 'QR terdeteksi, crop CDP belum terbaca'});
      } else if (!qrPreview.patternPayloadValid) {
        const confidence = qrPreview.patternCellConfidence ?? 0;
        setScannerMessage(
          confidence < 0.25
            ? 'Kode masih kurang jelas. Dekatkan kamera dan hindari pantulan cahaya.'
            : 'Kode sedang dibaca. Tahan posisi tetap stabil.',
        );
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: 'CDP terdeteksi, checksum belum valid'});
      } else {
        if (ENABLE_SCANNER_DEBUG) setScannerDebug({...debugBase, stage: 'QR + CDP kiri/kanan valid'});
      }

      if (!reliability.ok && !hasRectangularFrame) {
        stableFrameRef.current = {id: '', count: 0, voteHistory: []};
        if (qrPreview?.qrDetected) setScannerMessage(reliability.message);
        return;
      }

      // Invalid single-frame checksums must still contribute rectangular votes.
      if (!hasRectangularFrame || !qrPreview) {
        stableFrameRef.current = {id: '', count: 0, voteHistory: []};
        setScannerMessage('Kode belum terbaca secara utuh. Pastikan seluruh bagian kode berada di dalam kotak.');
        return;
      }

      const currentBitVotes = qrPreview.patternCellBits?.length ? qrPreview.patternCellBits : null;
      if (!currentBitVotes) {
        setScannerMessage('Kode sedang dibaca. Tahan posisi dan pastikan CDP kiri terlihat jelas.');
        return;
      }
      const nextVoteHistory = stableFrameRef.current.id === frameKey
        ? [...stableFrameRef.current.voteHistory, currentBitVotes].slice(-MAX_CHECKSUM_RECOVERY_FRAMES)
        : [currentBitVotes];

      if (stableFrameRef.current.id === frameKey) {
        stableFrameRef.current = {id: frameKey, count: stableFrameRef.current.count + 1, voteHistory: nextVoteHistory};
      } else {
        stableFrameRef.current = {id: frameKey, count: 1, voteHistory: nextVoteHistory};
      }

      const recoveredPayload = recoverPayloadFromVotes(stableFrameRef.current.voteHistory);
      const checksumReady = Boolean(rectPayloadText);

      if (!checksumReady && !hasPayloadHint) {
        setScannerMessage('Kode sedang dibaca. Tahan posisi dan pastikan seluruh kode terlihat.');
        return;
      }

      if (!checksumReady && hasPayloadHint) {
        setScannerMessage('Kode mulai terbaca. Jangan gerakkan kamera.');
        return;
      }

      if (stableFrameRef.current.count < MIN_STABLE_VALID_FRAMES) {
        setScannerMessage('Kode berhasil dibaca. Tahan posisi sebentar.');
        return;
      }

      setScannerMessage('Kode berhasil dibaca. Memeriksa keaslian...');

      const scanDataUrl = qrPreview?.compositeDataUrl || frame?.alignedDisplayCanvas.toDataURL('image/png') || rawScanCanvas.toDataURL('image/jpeg', 0.82);
      const frameForLookup = rectPayloadText
        ? {
        ...(frame ?? {}),
            id: rectPayloadText,
            rawPayloadText: rectPayloadText,
            isValid: true,
        bitVotes: qrPreview?.patternCellBits || frame?.bitVotes || [],
          }
        : checksumReady
        ? {
            ...frame,
            id: recoveredPayload.text,
            rawPayloadText: recoveredPayload.text,
            isValid: recoveredPayload.isValid,
          }
        : null;

      if (!frameForLookup?.isValid || !frameForLookup.rawPayloadText?.trim()) {
        setScannerMessage('Kode belum dapat dikenali. Tahan posisi dan coba kembali.');
        return;
      }

      const lookupId = rectPayloadText;
      const rawPayloadText = rectPayloadText;
      const payloadMode = 'three-part' as const;
      const decryptSucceeded = false;
      setScannerMessage('Kode berhasil dibaca. Memeriksa keaslian...');
      const dbMatch = patternLibrary.docsList.find((doc) => doc.id === lookupId);

      const {latitude, longitude} = await getBrowserLocation();
      const verifiedAt = new Date().toISOString();

      setScannerMessage('Menyelesaikan verifikasi...');

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
          layout_version: 'three-part-v2.1',
          left_pattern_decode_payload: leftPayloadText,
          right_pattern_decode_payload: rightPayloadText,
          pattern_decode_payload: rawPayloadText,
          decrypt_succeeded: decryptSucceeded,
          payload_mode: payloadMode,
          checksum_valid: Boolean(leftPayloadText && rightPayloadText),
          raw_payload_text: rawPayloadText,
          created_at: verifiedAt,
          updated_at: verifiedAt,
        }),
      });

      if (scanGeneration !== scanGenerationRef.current) return;

      const status = verifyResponse.data.status_result;
      const fallbackNotes = !frameForLookup.isValid
        ? 'Kode keamanan tidak dapat dikenali dengan baik.'
        : null;

      setMatchResult({
        doc: dbMatch || {id: lookupId, label: 'Counterfeit / Not Registered', density: RECT_PATTERN_DOT_DENSITY},
        score: 0,
        status,
        checksumValid: frameForLookup.isValid,
        decodedLookupId: lookupId,
        verdictSource: qrPreview?.qrDetected ? 'qr-anchor-v2.1' : 'legacy-payload',
        qrDetected: qrPreview?.qrDetected ?? false,
        qrValue: qrPreview?.qrValue ?? null,
        qrFormat: qrPreview?.qrFormat ?? null,
        scanDataUrl,
        payloadMode,
        rawPayloadText,
        decryptSucceeded,
        notes: fallbackNotes || verifyResponse.data.notes,
        responseMessage: verifyResponse.message,
      });
      setScannerMessage(
        status === 'AUTHENTIC'
          ? 'Verifikasi selesai. Produk dinyatakan autentik.'
          : 'Verifikasi selesai. Keaslian produk tidak dapat dikonfirmasi.',
      );
      stableFrameRef.current = {id: '', count: 0, voteHistory: []};
    } catch (error) {
      stableFrameRef.current = {id: '', count: 0, voteHistory: []};
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
