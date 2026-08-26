import {CDP_MASK_X, CDP_MASK_Y, CDP_MASK_Z} from './constants';

/** Builds a deterministic Mulberry32 PRNG from a string seed. */
export function getMulberry32(seedStr: string): () => number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    const char = seedStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }

  let a = Math.abs(hash) || 123456789;
  return function random() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns the deterministic XOR mask bit for a matrix coordinate. */
export function getStaticMaskBit(x: number, y: number): number {
  const val = Math.sin(x * CDP_MASK_X + y * CDP_MASK_Y) * CDP_MASK_Z;
  return val - Math.floor(val) > 0.5 ? 1 : 0;
}
