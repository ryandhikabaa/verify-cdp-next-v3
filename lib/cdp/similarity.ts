import type {GeneratorSettings, SimilarityResult} from '@/lib/types';
import {CDP_MIN_VALID_SIMILARITY, CDP_SIMILARITY_SIZE} from './constants';

/** Compares a reference canvas and a scan using Pearson correlation. */
export function calculateSimilarity(
  refCanvas: HTMLCanvasElement,
  scanCanvas: HTMLCanvasElement,
  _settings: GeneratorSettings,
): SimilarityResult {
  const refCtx = refCanvas.getContext('2d', {willReadFrequently: true});
  const scanCtx = scanCanvas.getContext('2d', {willReadFrequently: true});
  if (!refCtx || !scanCtx) return {score: 0, isValid: false, status: 'COUNTERFEIT'};

  const cmpW = CDP_SIMILARITY_SIZE;
  const cmpH = CDP_SIMILARITY_SIZE;

  const cmpRefCanvas = document.createElement('canvas');
  cmpRefCanvas.width = cmpW;
  cmpRefCanvas.height = cmpH;
  const cmpRefCtx = cmpRefCanvas.getContext('2d');
  cmpRefCtx!.imageSmoothingEnabled = true;
  cmpRefCtx!.imageSmoothingQuality = 'high';
  cmpRefCtx!.drawImage(refCanvas, 0, 0, refCanvas.width, refCanvas.height, 0, 0, cmpW, cmpH);

  const cmpScanCanvas = document.createElement('canvas');
  cmpScanCanvas.width = cmpW;
  cmpScanCanvas.height = cmpH;
  const cmpScanCtx = cmpScanCanvas.getContext('2d');
  cmpScanCtx!.imageSmoothingEnabled = true;
  cmpScanCtx!.imageSmoothingQuality = 'high';
  cmpScanCtx!.drawImage(scanCanvas, 0, 0, scanCanvas.width, scanCanvas.height, 0, 0, cmpW, cmpH);

  const refData = cmpRefCtx!.getImageData(0, 0, cmpW, cmpH).data;
  const scanData = cmpScanCtx!.getImageData(0, 0, cmpW, cmpH).data;

  const refLum = new Float32Array(cmpW * cmpH);
  const scanLum = new Float32Array(cmpW * cmpH);
  for (let i = 0; i < refLum.length; i++) {
    refLum[i] = 255 - (refData[i * 4] * 0.299 + refData[i * 4 + 1] * 0.587 + refData[i * 4 + 2] * 0.114);
    scanLum[i] = 255 - (scanData[i * 4] * 0.299 + scanData[i * 4 + 1] * 0.587 + scanData[i * 4 + 2] * 0.114);
  }

  let refSum = 0;
  let scanSum = 0;
  for (let i = 0; i < cmpW * cmpH; i++) {
    refSum += refLum[i];
    scanSum += scanLum[i];
  }
  const refMean = refSum / (cmpW * cmpH);
  const scanMean = scanSum / (cmpW * cmpH);

  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;
  for (let i = 0; i < cmpW * cmpH; i++) {
    const refDiff = refLum[i] - refMean;
    const scanDiff = scanLum[i] - scanMean;
    numerator += refDiff * scanDiff;
    denominatorA += refDiff * refDiff;
    denominatorB += scanDiff * scanDiff;
  }

  const score = denominatorA === 0 || denominatorB === 0 ? 0 : numerator / Math.sqrt(denominatorA * denominatorB);
  const isValid = score > CDP_MIN_VALID_SIMILARITY;

  return {
    score,
    isValid,
    status: isValid ? 'AUTHENTIC' : 'COUNTERFEIT',
  };
}
