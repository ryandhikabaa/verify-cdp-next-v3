export {
	STANDARD_CDP_SETTINGS,
	RECT_PATTERN_ROWS,
	RECT_PATTERN_COLUMNS,
	RECT_PATTERN_DOT_DENSITY,
	RECT_PATTERN_SAMPLE_RATIO,
	CDP_PAYLOAD_CHARS,
	CDP_PREVIEW_RENDER_SCALE,
	CDP_RENDER_SCALE,
} from './constants';
export {encryptSeedToPayload, decryptPayloadToSeed, withEncryptedPayload, CDP_SEED_REGEX, getEncryptionConfigSummary} from './encryption';
export {normalizeCDPSettings} from './settings';
export {getMulberry32, getStaticMaskBit} from './mask';
export {GREY_TEXTURE_STYLE_TRACE, GREY_TEXTURE_TRACE, GREY_TEXTURE_TRACES, getFragileTextureCells, getGreyTextureStyleTrace, getGreyTextureTrace, getRectangularFragileTextureCells, withGreyTextureStyleTrace} from './fragile-noise';
export {stringToBits, bitsToString} from './bit-encoding';
export {generateCDPMatrix, generateRectangularCDPMatrix, decodeRectangularCDPMatrix} from './matrix';
export {renderCDPToCanvas} from './render';
export {renderCDPDisplayToCanvas, renderRectangularCDPToCanvas, renderCanvasWithFooter, getFooterHeight, getCanvasContentBounds, getCompositeLayoutMetadata, renderCompositeQrPatternToCanvas, getThreePartCompositeLayoutMetadata, renderThreePartCompositeToCanvas} from './render';
export type {CanvasContentBounds, CompositeLayoutMetadata} from './render';
export {decodeAndAlignPattern} from './decode';
export {calculateSimilarity} from './similarity';
