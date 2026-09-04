import {STANDARD_CDP_SETTINGS, normalizeCDPSettings} from '@/lib/cdp';
import type {GeneratorSettings, GreyTextureVersion, PatternDoc, PatternStyle} from '@/lib/types';

const PATTERN_STYLES = new Set<PatternStyle>(['stochastic_noise', 'halftone_grid', 'error_diffusion']);
const GREY_TEXTURE_VERSIONS = new Set<GreyTextureVersion>(['grey-v1', 'grey-v2', 'grey-v3']);

/** Extracts the render style from a metadata-extended stored style string. */
export function getStoredPatternStyle(style: string | undefined, fallback: PatternStyle): PatternStyle {
  const baseStyle = style?.split(';', 1)[0];
  return baseStyle && PATTERN_STYLES.has(baseStyle as PatternStyle) ? (baseStyle as PatternStyle) : fallback;
}

/** Extracts the grey texture version from metadata-extended stored style strings. */
export function getStoredGreyTextureVersion(style: string | undefined, fallback: GreyTextureVersion): GreyTextureVersion {
  const tokens = style?.split(';').slice(1) ?? [];
  const version = tokens.find((token) => GREY_TEXTURE_VERSIONS.has(token as GreyTextureVersion));
  return version ? (version as GreyTextureVersion) : fallback;
}

/** Converts a stored document back into normalized generator settings. */
export function docToSettings(doc: PatternDoc, current: GeneratorSettings): GeneratorSettings {
  const serial = doc.id.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const payload1 = doc.payload_1 ?? doc.pattern_payload ?? doc.payload ?? serial.slice(0, 12);
  const payload2 = doc.payload_2 ?? serial.slice(12, 24);
  const payloadQr = doc.payload_qr ?? doc.qr_payload;
  return normalizeCDPSettings({
    ...current,
    seed: doc.id,
    payload: payload1,
    payload1,
    payload2,
    payloadQr,
    qrPayload: payloadQr,
    qr_hvalue: doc.qr_hvalue,
    qr_secret1: doc.qr_secret1,
    qr_secret2: doc.qr_secret2,
    qr_image: doc.qr_image,
    dotDensity: doc.density,
    gridSize: STANDARD_CDP_SETTINGS.gridSize,
    dotSize: STANDARD_CDP_SETTINGS.dotSize,
    style: getStoredPatternStyle(doc.style, current.style),
    greyTextureVersion: doc.grey_texture_version ?? getStoredGreyTextureVersion(doc.style, current.greyTextureVersion ?? STANDARD_CDP_SETTINGS.greyTextureVersion ?? 'grey-v3'),
    addMarkers: false,
  });
}

export const RANDOM_SEED_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const RANDOM_SEED_FINAL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789';

/** Generates a secure random seed while avoiding the trailing zero used as encryption padding. */
export function makeRandomSeed(length: number) {
  const safeLength = Math.min(Math.max(Math.trunc(length), 1), 24);
  const bytes = new Uint8Array(safeLength * 2);
  let seed = '';

  while (seed.length < safeLength) {
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      const alphabet = seed.length === safeLength - 1 ? RANDOM_SEED_FINAL_ALPHABET : RANDOM_SEED_ALPHABET;
      const limit = 256 - (256 % alphabet.length);
      if (byte < limit) seed += alphabet[byte % alphabet.length];
      if (seed.length === safeLength) break;
    }
  }

  return seed;
}

/** Sanitizes a generated filename before download. */
export function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9-]/g, '_');
}

/** Loads a stored pattern image into a canvas for similarity comparison. */
export function canvasFromDataUrl(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error('Failed to load stored pattern image'));
    image.src = dataUrl;
  });
}
