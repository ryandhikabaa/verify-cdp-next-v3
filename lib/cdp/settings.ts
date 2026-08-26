import type {GeneratorSettings} from '@/lib/types';
import {STANDARD_CDP_SETTINGS} from './constants';

/** Normalizes generator settings to the fixed production CDP profile. */
export function normalizeCDPSettings(settings: Partial<GeneratorSettings>): GeneratorSettings {
  return {
    ...STANDARD_CDP_SETTINGS,
    ...settings,
    gridSize: STANDARD_CDP_SETTINGS.gridSize,
    dotDensity: STANDARD_CDP_SETTINGS.dotDensity,
    dotSize: STANDARD_CDP_SETTINGS.dotSize,
    style: STANDARD_CDP_SETTINGS.style,
    greyTextureVersion: settings.greyTextureVersion ?? STANDARD_CDP_SETTINGS.greyTextureVersion,
    addMarkers: STANDARD_CDP_SETTINGS.addMarkers,
  };
}
