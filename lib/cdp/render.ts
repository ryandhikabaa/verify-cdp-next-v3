import type {GeneratorSettings, RectangularPatternMatrix} from '@/lib/types';
import {RECT_PATTERN_COLUMNS, RECT_PATTERN_ROWS} from './constants';
import {getFragileTextureCells, getRectangularFragileTextureCells} from './fragile-noise';

export type CompositeLayoutMetadata = {
  layoutVersion: 'qr-pattern-v2' | 'three-part-v2.1';
  qrPosition: 'left' | 'center';
  patternPosition: 'right';
  leftPosition?: 'left';
  rightPosition?: 'right';
  leftWidthPx?: number;
  leftHeightPx?: number;
  rightWidthPx?: number;
  rightHeightPx?: number;
  qrWidthPx: number;
  qrHeightPx: number;
  patternWidthPx: number;
  patternHeightPx: number;
  gapPx: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
  footerHeightPx: number;
};

export type CanvasContentBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Renders a generated CDP matrix into a canvas with production markers. */
export function renderCDPToCanvas(matrix: number[][], canvas: HTMLCanvasElement, settings: GeneratorSettings): void {
  const borderSize = settings.addMarkers ? Math.max(12, Math.floor(settings.gridSize * settings.dotSize * 0.15)) : 0;
  const totalSize = settings.gridSize * settings.dotSize + borderSize * 2;

  canvas.width = totalSize;
  canvas.height = totalSize;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalSize, totalSize);

  for (const cell of getFragileTextureCells(settings)) {
    drawFragileTextureCell(ctx, borderSize, cell, settings.dotSize);
  }

  ctx.fillStyle = '#000000';
  const radiusCells = settings.gridSize / 2;

  for (let y = 0; y < settings.gridSize; y++) {
    for (let x = 0; x < settings.gridSize; x++) {
      if (matrix[y][x] !== 0) continue;
      const dx = x + 0.5 - settings.gridSize / 2;
      const dy = y + 0.5 - settings.gridSize / 2;
      const inCircle = dx * dx + dy * dy <= radiusCells * radiusCells;
      if (inCircle) {
        ctx.fillRect(borderSize + x * settings.dotSize, borderSize + y * settings.dotSize, settings.dotSize, settings.dotSize);
      }
    }
  }

  if (!settings.addMarkers) return;

  const padding = Math.max(3, Math.floor(totalSize * 0.03));
  const markerSize = Math.floor(borderSize * 1.08);
  const thickness = Math.max(4, Math.floor(markerSize * 0.15));

  drawCornerMarker(ctx, padding, padding, markerSize, thickness, 'top-left');
  drawCornerMarker(ctx, totalSize - padding, padding, markerSize, thickness, 'top-right');
  drawCornerMarker(ctx, padding, totalSize - padding, markerSize, thickness, 'bottom-left');
}

/** Renders the pattern into a display canvas with a safe footer for the seed label. */
export function renderCDPDisplayToCanvas(matrix: number[][], canvas: HTMLCanvasElement, settings: GeneratorSettings): void {
  const squareCanvas = document.createElement('canvas');
  renderCDPToCanvas(matrix, squareCanvas, settings);
  renderCanvasWithFooter(squareCanvas, canvas, settings.seed);
}

/** Renders the native rectangular v2 pattern without legacy markers or footer. */
export function renderRectangularCDPToCanvas(
  matrix: RectangularPatternMatrix,
  canvas: HTMLCanvasElement,
  settings: GeneratorSettings,
  options?: {targetHeight?: number},
): void {
  const rows = matrix.rows || RECT_PATTERN_ROWS;
  const columns = matrix.columns || RECT_PATTERN_COLUMNS;
  const targetHeight = options?.targetHeight ?? rows * settings.dotSize;
  const dotHeight = Math.max(1, targetHeight / rows);
  const width = Math.max(1, Math.round(columns * dotHeight));
  const height = Math.max(1, Math.round(rows * dotHeight));

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (const cell of getRectangularFragileTextureCells(settings)) {
    drawFragileTextureCell(ctx, 0, cell, dotHeight);
  }

  ctx.fillStyle = '#000000';
  // Preserve the original solid-cell appearance. Every black payload cell fills
  // its complete grid area, while the matrix still carries the same payload.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (matrix.cells[y]?.[x] !== 0) continue;
      const startX = Math.round(x * dotHeight);
      const startY = Math.round(y * dotHeight);
      const endX = Math.round((x + 1) * dotHeight);
      const endY = Math.round((y + 1) * dotHeight);
      ctx.fillRect(
        startX,
        startY,
        Math.max(1, endX - startX),
        Math.max(1, endY - startY),
      );
    }
  }
}

function drawFragileTextureCell(
  ctx: CanvasRenderingContext2D,
  borderSize: number,
  cell: ReturnType<typeof getFragileTextureCells>[number],
  dotSize: number,
) {
  const gray = Math.round(cell.gray);
  const cellSize = Math.max(1, Math.floor(dotSize * cell.sizeRatio));
  const inset = Math.max(0, Math.floor((dotSize - cellSize) / 2));
  const x = Math.round(borderSize + cell.x * dotSize + inset);
  const y = Math.round(borderSize + cell.y * dotSize + inset);

  ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${cell.alpha})`;
  ctx.fillRect(x, y, Math.max(1, Math.round(cellSize)), Math.max(1, Math.round(cellSize)));
}

/** Detects the tight non-white content bounds of a rendered canvas. */
export function getCanvasContentBounds(canvas: HTMLCanvasElement): CanvasContentBounds {
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) {
    return {x: 0, y: 0, width: canvas.width, height: canvas.height};
  }

  const {width, height} = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const isWhite = data[index] > 245 && data[index + 1] > 245 && data[index + 2] > 245 && data[index + 3] > 0;
      if (isWhite) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return {x: 0, y: 0, width, height};
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/** Renders an already aligned square scan into a display canvas with a footer label. */
export function renderCanvasWithFooter(sourceCanvas: HTMLCanvasElement, targetCanvas: HTMLCanvasElement, seed: string): void {
  const footerHeight = getFooterHeight(sourceCanvas.width);
  const bottomCrop = Math.floor(sourceCanvas.width * 0.045);
  const visibleSquareHeight = Math.max(1, sourceCanvas.height - bottomCrop);

  targetCanvas.width = sourceCanvas.width;
  targetCanvas.height = visibleSquareHeight + footerHeight;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0);

  drawFooterSeedLabel(ctx, seed, sourceCanvas.width, visibleSquareHeight, footerHeight);
}

export function getFooterHeight(squareSize: number): number {
  return Math.max(44, Math.floor(squareSize * 0.12));
}

export function getTwoLineFooterHeight(squareSize: number): number {
  return Math.max(72, Math.floor(squareSize * 0.2));
}

export function getCompositeLayoutMetadata(qrWidth: number, qrHeight: number, patternCanvas: HTMLCanvasElement): CompositeLayoutMetadata {
  const gapPx = Math.max(24, Math.floor(Math.min(qrWidth, patternCanvas.width) * 0.08));
  const contentWidth = qrWidth + gapPx + patternCanvas.width;
  const contentHeight = Math.max(qrHeight, patternCanvas.height);
  const footerHeightPx = getFooterHeight(contentWidth);
  return {
    layoutVersion: 'qr-pattern-v2',
    qrPosition: 'left',
    patternPosition: 'right',
    qrWidthPx: qrWidth,
    qrHeightPx: qrHeight,
    patternWidthPx: patternCanvas.width,
    patternHeightPx: patternCanvas.height,
    gapPx,
    canvasWidthPx: contentWidth,
    canvasHeightPx: contentHeight + footerHeightPx,
    footerHeightPx,
  };
}

export function renderCompositeQrPatternToCanvas(
  qrCanvas: HTMLCanvasElement,
  patternCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  seed?: string,
) {
  const layout = getCompositeLayoutMetadata(qrCanvas.width, qrCanvas.height, patternCanvas);
  targetCanvas.width = layout.canvasWidthPx;
  targetCanvas.height = layout.canvasHeightPx;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return layout;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  const qrContentBounds = getCanvasContentBounds(qrCanvas);
  const contentHeight = layout.canvasHeightPx - layout.footerHeightPx;
  const patternOffsetX = layout.qrWidthPx + layout.gapPx;
  const centeredQrOffsetY = Math.floor((contentHeight - layout.qrHeightPx) / 2);
  const centeredPatternOffsetY = centeredQrOffsetY + qrContentBounds.y + Math.floor((qrContentBounds.height - layout.patternHeightPx) / 2);

  ctx.drawImage(qrCanvas, 0, centeredQrOffsetY);
  ctx.drawImage(patternCanvas, patternOffsetX, centeredPatternOffsetY);

  if (seed?.trim()) {
    drawFooterSeedLabel(ctx, seed, layout.canvasWidthPx, contentHeight, layout.footerHeightPx);
  }

  return layout;
}

export function getThreePartCompositeLayoutMetadata(
  leftCanvas: HTMLCanvasElement,
  qrWidth: number,
  qrHeight: number,
  rightCanvas: HTMLCanvasElement,
  options?: {gapRatio?: number},
): CompositeLayoutMetadata {
  const gapRatio = options?.gapRatio ?? 0.085;
  const gapPx = Math.max(22, Math.floor(Math.min(qrWidth, leftCanvas.width, rightCanvas.width) * gapRatio));
  const contentWidth = leftCanvas.width + gapPx + qrWidth + gapPx + rightCanvas.width;
  const contentHeight = Math.max(leftCanvas.height, qrHeight, rightCanvas.height);
  const footerHeightPx = getTwoLineFooterHeight(contentWidth);
  return {
    layoutVersion: 'three-part-v2.1',
    leftPosition: 'left',
    qrPosition: 'center',
    rightPosition: 'right',
    patternPosition: 'right',
    leftWidthPx: leftCanvas.width,
    leftHeightPx: leftCanvas.height,
    qrWidthPx: qrWidth,
    qrHeightPx: qrHeight,
    rightWidthPx: rightCanvas.width,
    rightHeightPx: rightCanvas.height,
    patternWidthPx: rightCanvas.width,
    patternHeightPx: rightCanvas.height,
    gapPx,
    canvasWidthPx: contentWidth,
    canvasHeightPx: contentHeight + footerHeightPx,
    footerHeightPx,
  };
}

export function renderThreePartCompositeToCanvas(
  leftCanvas: HTMLCanvasElement,
  qrCanvas: HTMLCanvasElement,
  rightCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  footerLabel?: string | {top: string; bottom: string},
  options?: {gapRatio?: number},
) {
  const layout = getThreePartCompositeLayoutMetadata(leftCanvas, qrCanvas.width, qrCanvas.height, rightCanvas, options);
  targetCanvas.width = layout.canvasWidthPx;
  targetCanvas.height = layout.canvasHeightPx;

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return layout;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

  const contentHeight = layout.canvasHeightPx - layout.footerHeightPx;
  const centeredQrOffsetY = Math.floor((contentHeight - layout.qrHeightPx) / 2);
  const centeredPatternOffsetY = Math.floor((contentHeight - layout.patternHeightPx) / 2);
  const qrOffsetX = layout.leftWidthPx! + layout.gapPx;
  const rightOffsetX = qrOffsetX + layout.qrWidthPx + layout.gapPx;

  ctx.drawImage(leftCanvas, 0, centeredPatternOffsetY);
  ctx.drawImage(qrCanvas, qrOffsetX, centeredQrOffsetY);
  ctx.drawImage(rightCanvas, rightOffsetX, centeredPatternOffsetY);

  if (typeof footerLabel === 'object') {
    drawFooterTwoLineLabel(ctx, footerLabel.top, footerLabel.bottom, layout.canvasWidthPx, contentHeight, layout.footerHeightPx);
  } else if (footerLabel?.trim()) {
    drawFooterSeedLabel(ctx, footerLabel, layout.canvasWidthPx, contentHeight, layout.footerHeightPx);
  }

  return layout;
}

function drawFooterTwoLineLabel(
  ctx: CanvasRenderingContext2D,
  topLabel: string,
  bottomLabel: string,
  width: number,
  squareHeight: number,
  footerHeight: number,
) {
  const top = topLabel.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const bottom = bottomLabel.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!top && !bottom) return;

  const horizontalPadding = Math.max(18, Math.floor(width * 0.14));
  const availableWidth = width - horizontalPadding * 2;
  const maxFontSize = Math.max(30, Math.floor(width * 0.075));
  let fontSize = maxFontSize;

  ctx.save();
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;

  while (fontSize > 10 && Math.max(ctx.measureText(top).width, ctx.measureText(bottom).width) > availableWidth) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  }

  const centerX = width / 2;
  const lineGap = Math.max(4, Math.floor(fontSize * 0.2));
  const centerY = squareHeight + Math.floor(footerHeight * 0.5);
  if (top) ctx.fillText(top, centerX, centerY - Math.floor(fontSize * 0.32) - lineGap, availableWidth);
  if (bottom) ctx.fillText(bottom, centerX, centerY + Math.floor(fontSize * 0.58) + lineGap, availableWidth);
  ctx.restore();
}

/** Draws the seed label inside the footer area below the square marker canvas. */
function drawFooterSeedLabel(
  ctx: CanvasRenderingContext2D,
  seed: string,
  width: number,
  squareHeight: number,
  footerHeight: number,
) {
  if (!seed.trim()) return;

  const horizontalPadding = Math.max(18, Math.floor(width * 0.14));
  const availableWidth = width - horizontalPadding * 2;
  const maxFontSize = Math.max(48, Math.floor(width * 0.095));
  const baselineY = squareHeight + Math.floor(footerHeight * 0.72);

  ctx.save();
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const label = seed.trim().toUpperCase();
  let fontSize = maxFontSize;
  ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;

  while (fontSize > 12 && ctx.measureText(label).width > availableWidth) {
    fontSize -= 1;
    ctx.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
  }

  const centerX = width / 2;
  ctx.fillText(label, centerX, baselineY, availableWidth);
  ctx.restore();
}

/** Draws one thick L-shaped alignment corner at the requested corner. */
function drawCornerMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  thickness: number,
  corner: 'top-left' | 'top-right' | 'bottom-left',
) {
  ctx.fillStyle = '#000000';
  const cap = Math.max(2, Math.floor(thickness * 0.9));
  const capInset = Math.max(1, Math.floor(cap * 0.35));
  const notchSize = Math.max(1, cap - capInset);

  switch (corner) {
    case 'top-left':
      ctx.fillRect(x, y, size, thickness);
      ctx.fillRect(x, y, thickness, size);
      ctx.fillRect(x, y, thickness + cap, thickness + cap);
      ctx.clearRect(x + capInset, y + capInset, notchSize, notchSize);
      break;
    case 'top-right':
      ctx.fillRect(x - size, y, size, thickness);
      ctx.fillRect(x - thickness, y, thickness, size);
      ctx.fillRect(x - thickness - cap, y, thickness + cap, thickness + cap);
      ctx.clearRect(x - capInset - notchSize, y + capInset, notchSize, notchSize);
      break;
    case 'bottom-left':
      ctx.fillRect(x, y - thickness, size, thickness);
      ctx.fillRect(x, y - size, thickness, size);
      ctx.fillRect(x, y - thickness - cap, thickness + cap, thickness + cap);
      ctx.clearRect(x + capInset, y - capInset - notchSize, notchSize, notchSize);
      break;
  }
}
