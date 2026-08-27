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
export {decodeV3Payload, encodeV3Payload, validateV3Payload, V3_PAYLOAD_CONSTANTS} from './v3-payload';
export type {V3DecodedPayload, V3PayloadCodeword} from './v3-payload';
export {V3_MATRIX_BITS, V3_MATRIX_COLUMNS, V3_MATRIX_ROWS, corruptV3Matrix, decodeV3Matrix, generateV3Matrix} from './v3-matrix';
