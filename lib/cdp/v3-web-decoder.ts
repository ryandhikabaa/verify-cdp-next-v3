import {
  RECT_PATTERN_COLUMNS,
  RECT_PATTERN_ROWS,
  RECT_PATTERN_SAMPLE_RATIO,
} from './constants';
import {decodeV3Matrix} from './v3-matrix';

export type Point2D = {x: number; y: number};

export type RectDecodeResult = {
  text: string;
  isValid: boolean;
  bitVotes: number[];
  confidence: number;
};

type CanvasLike = HTMLCanvasElement;

export function distanceBetween(a: Point2D, b: Point2D) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function normalizeVector(vector: Point2D, fallback: Point2D) {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.0001) return fallback;
  return {x: vector.x / length, y: vector.y / length};
}

export function orthogonalizeYAxis(xUnit: Point2D, yHint: Point2D) {
  const candidateA = {x: -xUnit.y, y: xUnit.x};
  const candidateB = {x: xUnit.y, y: -xUnit.x};
  const dotA = candidateA.x * yHint.x + candidateA.y * yHint.y;
  const chosen = Math.abs(dotA) >= Math.abs(candidateB.x * yHint.x + candidateB.y * yHint.y) ? candidateA : candidateB;
  return normalizeVector(chosen, {x: 0, y: 1});
}

export function addPoint(a: Point2D, b: Point2D): Point2D {
  return {x: a.x + b.x, y: a.y + b.y};
}

export function scalePoint(point: Point2D, scale: number): Point2D {
  return {x: point.x * scale, y: point.y * scale};
}

export function orderQrPoints(points: Point2D[]) {
  const topLeft = points.reduce((best, point) => (point.x + point.y < best.x + best.y ? point : best));
  const remaining = points.filter((point) => point !== topLeft);
  const [candidateA, candidateB] = remaining;
  const topRight = candidateA.x >= candidateB.x ? candidateA : candidateB;
  const bottomLeft = candidateA.x >= candidateB.x ? candidateB : candidateA;

  return {topLeft, topRight, bottomLeft};
}

export function buildPatternBounds(origin: Point2D, xUnit: Point2D, yUnit: Point2D, width: number, height: number) {
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

export function sampleParallelogramRegion(
  sourceCanvas: CanvasLike,
  origin: Point2D,
  xAxis: Point2D,
  yAxis: Point2D,
  width: number,
  height: number,
  createCanvas: () => CanvasLike = () => document.createElement('canvas'),
) {
  const canvas = createCanvas();
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

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

export function decodeV3PatternCanvas(patternCanvas: CanvasLike): RectDecodeResult {
  const minCellPx = 4;
  const cellHeightPx = patternCanvas.height / RECT_PATTERN_ROWS;
  let workCanvas = patternCanvas;
  if (cellHeightPx > 0 && cellHeightPx < minCellPx) {
    const upscaleScale = Math.min(4, minCellPx / cellHeightPx);
    const upscaleCanvas = typeof document !== 'undefined'
      ? document.createElement('canvas')
      : (new (patternCanvas.constructor as {new (): CanvasLike})());
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

  const cellWidth = width / RECT_PATTERN_COLUMNS;
  const cellHeight = height / RECT_PATTERN_ROWS;
  const sampleWidth = Math.max(2, Math.floor(cellWidth * RECT_PATTERN_SAMPLE_RATIO));
  const sampleHeight = Math.max(2, Math.floor(cellHeight * RECT_PATTERN_SAMPLE_RATIO));
  const cellMeans: number[] = [];
  for (let row = 0; row < RECT_PATTERN_ROWS; row++) {
    for (let column = 0; column < RECT_PATTERN_COLUMNS; column++) {
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

  const otsu = computeOtsuThreshold(cellMeans);
  let confidenceSum = 0;
  for (const mean of cellMeans) confidenceSum += Math.min(1, Math.abs(mean - otsu) / 96);
  const confidence = confidenceSum / Math.max(1, cellMeans.length);

  const buildMatrix = (threshold: number) => Array.from({length: RECT_PATTERN_ROWS}, (_, row) =>
    Array.from({length: RECT_PATTERN_COLUMNS}, (_, column) => {
      const mean = cellMeans[row * RECT_PATTERN_COLUMNS + column];
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

  return {text: '', isValid: false, bitVotes: buildMatrix(otsu).flat(), confidence};
}

export function getV3PatternOffsetCandidates() {
  return [
    {dx: 0, dy: 0},
    {dx: -0.5, dy: 0}, {dx: 0.5, dy: 0}, {dx: 0, dy: -0.5}, {dx: 0, dy: 0.5},
    {dx: -0.5, dy: -0.5}, {dx: 0.5, dy: -0.5}, {dx: -0.5, dy: 0.5}, {dx: 0.5, dy: 0.5},
    {dx: -1, dy: 0}, {dx: 1, dy: 0}, {dx: 0, dy: -1}, {dx: 0, dy: 1},
  ];
}

export function computeV3PatternOrigins(
  qrOrigin: Point2D,
  xUnit: Point2D,
  yUnit: Point2D,
  qrWidth: number,
  moduleSize: number,
) {
  const v3GapPx = Math.max(1, Math.round(moduleSize * 2));
  return getV3PatternOffsetCandidates().map(({dx, dy}) =>
    addPoint(
      addPoint(qrOrigin, scalePoint(xUnit, qrWidth + v3GapPx + moduleSize * dx)),
      scalePoint(yUnit, moduleSize * dy),
    ),
  );
}