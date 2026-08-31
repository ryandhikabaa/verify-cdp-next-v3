import type {PatternStyle} from '@/lib/types';

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';
// Keep the camera working region wide enough for the V3 QR + right pattern
// composition. A narrow ROI made the QR appear visibly present but reduced its
// sampled module size enough for ZXing to reject it on mobile cameras.
export const VERIFY_ROI_RATIO = 0.92;

export const PATTERN_STYLES: Array<{id: PatternStyle; label: string; description: string}> = [
  {
    id: 'stochastic_noise',
    label: 'Stochastic',
    description: 'Acuan utama: noise tinggi, sensitif terhadap hasil salinan.',
  },
  {
    id: 'halftone_grid',
    label: 'Halftone',
    description: 'Dot semi-teratur agar lebih nyaman dipindai kamera HP.',
  },
  {
    id: 'error_diffusion',
    label: 'Diffusion',
    description: 'Distribusi dot merata dengan randomness terstruktur.',
  },
];
