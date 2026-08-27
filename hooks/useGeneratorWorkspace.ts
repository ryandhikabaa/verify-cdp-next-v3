'use client';

import JSZip from 'jszip';
import QRCode from 'qrcode';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {usePatternLibrary} from '@/hooks/usePatternLibrary';
import {CDP_PREVIEW_RENDER_SCALE, CDP_RENDER_SCALE, generateV3Matrix, normalizeCDPSettings, renderRectangularCDPToCanvas, renderV3QrPatternToCanvas, STANDARD_CDP_SETTINGS, validateV3Payload, withEncryptedPayload, withGreyTextureStyleTrace} from '@/lib/cdp';
import {ApiClientError, fetchApi} from '@/lib/api-client';
import {API_BASE} from '@/lib/app-constants';
import {docToSettings, makeRandomSeed, sanitizeFilename} from '@/lib/pattern-helpers';
import type {BatchPattern, GeneratorSettings, PatternDoc, PatternPreview} from '@/lib/types';

const MAX_BATCH_COUNT = 100;
const MAX_SEED_LENGTH = 24;
const LIVE_PREVIEW_DEBOUNCE_MS = 120;
const PAYLOAD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOCKED_QR_PAYLOAD = 'https://puragroup.com';

type PayloadDraft = {payload: string};

function isFilled(value: string | undefined) {
  return Boolean(value?.trim());
}

function resolveV3Payload(settings: GeneratorSettings) { return validateV3Payload(settings.payload ?? settings.payload1 ?? settings.seed); }

function makeRandomPayload() {
  const bytes = new Uint8Array(24);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (byte) => PAYLOAD_ALPHABET[byte % PAYLOAD_ALPHABET.length]).join('');
}

function sanitizeCdpPayload(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
}

function waitForLoadingPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function sanitizePayloadDraft(draft: PayloadDraft): PayloadDraft {
  return {payload: sanitizeCdpPayload(draft.payload)};
}

function getPayloadDraftError(draft: PayloadDraft) {
  const sanitized = sanitizePayloadDraft(draft);
  if (!sanitized.payload) return 'Payload V3 wajib diisi terlebih dahulu.';
  return null;
}

function applyPayloadDraftToSettings(settings: GeneratorSettings, draft: PayloadDraft): GeneratorSettings {
  const sanitized = sanitizePayloadDraft(draft);
  return {
    ...settings,
    payload: sanitized.payload,
    payload1: undefined,
    payload2: undefined,
    qrPayload: LOCKED_QR_PAYLOAD,
    payloadQr: LOCKED_QR_PAYLOAD,
  };
}

async function makeManualSettingsForSeed(baseSettings: GeneratorSettings, seed: string, draft: PayloadDraft) {
  return applyPayloadDraftToSettings(normalizeCDPSettings({...baseSettings, seed}), draft);
}

function makeAutomaticBatchBase(settings: GeneratorSettings): GeneratorSettings {
  return {
    ...settings,
    payload: undefined,
    payload1: undefined,
    payload2: '',
    payloadQr: undefined,
    qrPayload: undefined,
  };
}

/** Encapsulates generator state, persistence, downloads, and catalog coordination. */
export function useGeneratorWorkspace() {
  const [settings, setSettings] = useState<GeneratorSettings>(STANDARD_CDP_SETTINGS);
  const [payloadDraft, setPayloadDraft] = useState<PayloadDraft>(() => ({
    payload: sanitizeCdpPayload(STANDARD_CDP_SETTINGS.payload ?? '') || makeRandomPayload(),
  }));
  const [batchCount, setBatchCount] = useState(10);
  const [seedLength, setSeedLength] = useState(24);
  const [batchPatterns, setBatchPatterns] = useState<BatchPattern[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [previewImageData, setPreviewImageData] = useState('');
  const [previewSettings, setPreviewSettings] = useState<GeneratorSettings | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PatternPreview | null>(null);
  const [validationDialogMessage, setValidationDialogMessage] = useState('');
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const patternLibrary = usePatternLibrary(API_BASE);

  const generationError = useMemo(() => {
    if (seedLength < 1 || seedLength > MAX_SEED_LENGTH) return `Panjang seed harus 1 sampai ${MAX_SEED_LENGTH} karakter.`;
    const capacity = 35 * (36 ** (seedLength - 1));
    if (batchCount > capacity) return `Panjang ${seedLength} hanya menyediakan ${capacity.toLocaleString('id-ID')} seed yang kompatibel.`;
    return null;
  }, [batchCount, seedLength]);

  const createUniqueSeeds = useCallback((count: number) => {
    const existing = new Set(patternLibrary.docsList.map((doc) => doc.id.toUpperCase()));
    const generated = new Set<string>();
    const maxAttempts = Math.max(count * 200, 1000);
    let attempts = 0;
    while (generated.size < count && attempts < maxAttempts) {
      const seed = makeRandomSeed(seedLength);
      if (!existing.has(seed)) generated.add(seed);
      attempts += 1;
    }
    if (generated.size !== count) throw new Error('Ruang seed tidak cukup. Gunakan panjang seed yang lebih besar.');
    return [...generated];
  }, [patternLibrary.docsList, seedLength]);

  const handleSeedLengthChange = useCallback((value: number) => {
    const nextLength = Math.min(Math.max(Math.trunc(value), 1), MAX_SEED_LENGTH);
    const existing = new Set(patternLibrary.docsList.map((doc) => doc.id.toUpperCase()));
    let previewSeed = makeRandomSeed(nextLength);
    while (existing.has(previewSeed)) previewSeed = makeRandomSeed(nextLength);

    setSeedLength(nextLength);
    setSettings((current) => ({
      ...current,
      seed: previewSeed,
        qrPayload: LOCKED_QR_PAYLOAD,
          payloadQr: LOCKED_QR_PAYLOAD,
      payload: undefined,
      payload1: undefined,
      payload2: undefined,
    }));
  }, [patternLibrary.docsList]);

  const applyPayloadDraft = useCallback(() => {
    setSettings((current) => applyPayloadDraftToSettings(current, payloadDraft));
  }, [payloadDraft]);

  const randomizePayloadDraft = useCallback(() => {
    setPayloadDraft({
      payload: makeRandomPayload(),
    });
  }, []);

  const ensurePayloadDraftFilled = useCallback(() => {
    const payloadError = getPayloadDraftError(payloadDraft);
    if (!payloadError) return true;
    setValidationDialogMessage(payloadError);
    return false;
  }, [payloadDraft]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const encrypted = await withEncryptedPayload(settings);
        if (cancelled) return;
        setSettings((current) => {
          if (
            current.seed !== settings.seed
            || (current.payload === encrypted.payload && current.qrPayload === settings.seed)
          ) {
            return current;
          }
          return {
            ...current,
            payload: encrypted.payload,
            payload1: current.payload1 ?? encrypted.payload,
            qrPayload: LOCKED_QR_PAYLOAD,
            payloadQr: LOCKED_QR_PAYLOAD,
          };
        });
      } catch (error) {
        console.error('Failed to sync encrypted seed payload', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings.seed]);

  useEffect(() => {
    void patternLibrary.loadPatterns();
  }, [patternLibrary.loadPatterns]);

  /** Renders a pattern into an offscreen canvas for saving and downloading. */
  const renderCompositePattern = useCallback(async (patternSettings: GeneratorSettings, renderScale = CDP_RENDER_SCALE) => {
    const normalized = normalizeCDPSettings(patternSettings);
    const renderSettings = {
      ...normalized,
      dotSize: normalized.dotSize * renderScale,
    };
    const patternCanvas = document.createElement('canvas');
    const qrCanvas = document.createElement('canvas');
    const payload = resolveV3Payload(normalized);
    const payloadQr = LOCKED_QR_PAYLOAD;
    const safeQrPayload = payloadQr.trim() || normalized.seed;
    const qrSize = renderSettings.gridSize * renderSettings.dotSize;
    const qrMarginModules = 1;
    const qrModel = QRCode.create(safeQrPayload, {errorCorrectionLevel: 'M'});
    const qrModuleCount = qrModel.modules.size;
    await QRCode.toCanvas(qrCanvas, safeQrPayload, {
      errorCorrectionLevel: 'M',
      margin: qrMarginModules,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: qrSize,
    });
    const fixedPatternHeight = Math.max(1, Math.round(qrCanvas.height * (qrModuleCount / (qrModuleCount + qrMarginModules * 2))));
    renderRectangularCDPToCanvas({rows: 64, columns: 32, cells: generateV3Matrix(payload)}, patternCanvas, {...renderSettings, payload}, {
      targetHeight: fixedPatternHeight,
    });

    const compositeCanvas = document.createElement('canvas');
    const layout = renderV3QrPatternToCanvas(qrCanvas, patternCanvas, compositeCanvas, qrModuleCount, qrMarginModules);
    return {canvas: compositeCanvas, layout};
  }, []);

  const makeSettingsForSeed = useCallback(async (baseSettings: GeneratorSettings, seed: string) => {
    const payload = sanitizeCdpPayload(baseSettings.payload ?? baseSettings.payload1 ?? seed) || makeRandomPayload();
    return {
      ...normalizeCDPSettings({...baseSettings, seed}),
      payload,
      payload1: undefined,
      payload2: undefined,
      payloadQr: LOCKED_QR_PAYLOAD,
      qrPayload: LOCKED_QR_PAYLOAD,
    } satisfies GeneratorSettings;
  }, []);

  const buildPatternDocPayload = useCallback((patternSettings: GeneratorSettings, layout: Awaited<ReturnType<typeof renderCompositePattern>>['layout'], imageData: string) => {
    const payload = resolveV3Payload(patternSettings);
    const payloadQr = LOCKED_QR_PAYLOAD;
    const serial = payload || patternSettings.seed;
    return {
      id: serial,
      label: serial,
      density: patternSettings.dotDensity,
      size: patternSettings.gridSize,
      style: withGreyTextureStyleTrace(patternSettings.style, patternSettings.greyTextureVersion),
      payload,
      payload_1: payload,
      payload_2: null,
      payload_qr: payloadQr,
      qr_payload: payloadQr,
      pattern_payload: payload,
      pattern_seed: serial,
      layout_version: 'v3-qr-pattern',
      left_position: null,
      qr_position: 'left',
      right_position: 'right',
      pattern_position: 'right',
      left_width_px: null,
      left_height_px: null,
      qr_width_px: layout.qrWidthPx,
      qr_height_px: layout.qrHeightPx,
      right_width_px: layout.patternWidthPx,
      right_height_px: layout.patternHeightPx,
      pattern_width_px: layout.patternWidthPx,
      pattern_height_px: layout.patternHeightPx,
      gap_px: layout.gapPx,
      canvas_width_px: layout.contentWidthPx,
      canvas_height_px: layout.contentHeightPx,
      payload_2_fallback: null,
      image_data: imageData,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const livePreviewSettings = applyPayloadDraftToSettings(settings, sanitizePayloadDraft(payloadDraft));

    const timeoutId = window.setTimeout(() => void (async () => {
      try {
        const {canvas} = await renderCompositePattern(livePreviewSettings, CDP_PREVIEW_RENDER_SCALE);
        if (!cancelled) {
          setPreviewImageData(canvas.toDataURL('image/png'));
        }
      } catch (error) {
        console.error('Failed to render generator preview', error);
      }
    })(), LIVE_PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [payloadDraft, renderCompositePattern, settings]);

  /** Downloads a rendered pattern canvas as PNG. */
  const downloadCanvas = useCallback((canvas: HTMLCanvasElement, seed: string, gridSize: number) => {
    const link = document.createElement('a');
    link.download = `CDP_${sanitizeFilename(seed)}_${gridSize}x${gridSize}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  /** Downloads the currently active pattern preview. */
  const downloadCurrentPng = useCallback(() => {
    void (async () => {
      if (!ensurePayloadDraftFilled()) {
        return;
      }
      const encryptedSettings = await makeManualSettingsForSeed(settings, settings.seed, payloadDraft);
      const {canvas} = await renderCompositePattern(encryptedSettings);
      const payload = resolveV3Payload(encryptedSettings);
      downloadCanvas(canvas, payload || encryptedSettings.seed, encryptedSettings.gridSize);
    })();
  }, [downloadCanvas, ensurePayloadDraftFilled, payloadDraft, renderCompositePattern, settings]);

  /** Saves one newly generated random pattern. */
  const requestSaveCurrentPattern = useCallback(() => {
    if (generationError) {
      patternLibrary.setDbMessage(generationError);
      return;
    }

    if (!ensurePayloadDraftFilled()) {
      return;
    }

    setSaveConfirmOpen(true);
  }, [ensurePayloadDraftFilled, generationError, patternLibrary]);

  const saveCurrentPattern = useCallback(async () => {
    if (generationError) {
      patternLibrary.setDbMessage(generationError);
      return;
    }

    if (!ensurePayloadDraftFilled()) {
      return;
    }

    setIsSaving(true);
    setProcessingMessage('Sedang menyimpan pattern. Mohon tunggu sebentar...');
    try {
      setSaveConfirmOpen(false);
      await waitForLoadingPaint();
      const [newSeed] = createUniqueSeeds(1);
      const updatedSettings = await makeManualSettingsForSeed(settings, newSeed, payloadDraft);
      const {canvas, layout} = await renderCompositePattern(updatedSettings);
      const imageData = canvas.toDataURL('image/png');

      setSettings(updatedSettings);

      await fetchApi(`${API_BASE}/patterns`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(buildPatternDocPayload(updatedSettings, layout, imageData)),
      });
      await patternLibrary.loadPatterns();
      patternLibrary.setDbMessage(`Pattern ${resolveV3Payload(updatedSettings) || newSeed} tersimpan`);
    } catch (error) {
      console.error('Save pattern failed:', error);
      patternLibrary.setDbMessage(error instanceof ApiClientError ? error.message : 'Gagal menyimpan pattern ke database');
    } finally {
      setIsSaving(false);
      setProcessingMessage('');
    }
  }, [buildPatternDocPayload, createUniqueSeeds, ensurePayloadDraftFilled, generationError, makeSettingsForSeed, patternLibrary, payloadDraft, renderCompositePattern, settings]);

  /** Generates and stores a transactional batch of new patterns. */
  const requestGenerateBatch = useCallback(() => {
    if (generationError) {
      patternLibrary.setDbMessage(generationError);
      return;
    }

    if (!ensurePayloadDraftFilled()) {
      return;
    }

    setBatchConfirmOpen(true);
  }, [ensurePayloadDraftFilled, generationError, patternLibrary]);

  const generateBatch = useCallback(async () => {
    if (generationError) {
      patternLibrary.setDbMessage(generationError);
      return;
    }

    if (!ensurePayloadDraftFilled()) {
      return;
    }

    setIsSaving(true);
    setProcessingMessage('Sedang generate batch dan menyimpan data. Mohon tunggu sebentar...');
    try {
      setBatchConfirmOpen(false);
      await waitForLoadingPaint();
      const safeCount = Math.min(Math.max(batchCount || 1, 1), MAX_BATCH_COUNT);
      const seeds = createUniqueSeeds(safeCount);
      const batchBaseSettings = makeAutomaticBatchBase(settings);
      const generated = await Promise.all(seeds.map(async (seed) => {
        return {id: seed, settings: await makeSettingsForSeed(batchBaseSettings, seed)} satisfies BatchPattern;
      }));
      const docs = await Promise.all(generated.map(async (pattern) => {
        const {canvas, layout} = await renderCompositePattern(pattern.settings);
        return buildPatternDocPayload(pattern.settings, layout, canvas.toDataURL('image/png'));
      }));

      setBatchPatterns(generated);
      setSettings(generated[0].settings);

      await fetchApi(`${API_BASE}/patterns/batch`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          docs,
        }),
      });
      await patternLibrary.loadPatterns();
      patternLibrary.setDbMessage(`${generated.length} pattern massal tersimpan`);
    } catch (error) {
      console.error('Save batch failed:', error);
      patternLibrary.setDbMessage(error instanceof ApiClientError ? error.message : 'Pattern massal dibuat lokal, tapi gagal disimpan ke database');
    } finally {
      setIsSaving(false);
      setProcessingMessage('');
    }
  }, [batchCount, buildPatternDocPayload, createUniqueSeeds, ensurePayloadDraftFilled, generationError, makeSettingsForSeed, patternLibrary, payloadDraft, renderCompositePattern, settings]);

  /** Downloads every in-memory batch item one by one. */
  const downloadBatch = useCallback(() => {
    batchPatterns.forEach((pattern, index) => {
      window.setTimeout(() => {
        void (async () => {
          const {canvas} = await renderCompositePattern(pattern.settings);
          downloadCanvas(canvas, pattern.id, pattern.settings.gridSize);
        })();
      }, index * 120);
    });
  }, [batchPatterns, downloadCanvas, renderCompositePattern]);

  /** Downloads one stored pattern document as PNG. */
  const downloadDoc = useCallback((doc: PatternDoc) => {
    const docSettings = docToSettings(doc, settings);
    void (async () => {
      const {canvas} = await renderCompositePattern(docSettings);
      downloadCanvas(canvas, doc.id, docSettings.gridSize);
    })();
  }, [downloadCanvas, renderCompositePattern, settings]);

  /** Downloads the current multi-selection as PNG or ZIP. */
  const downloadSelectedDocs = useCallback(async () => {
    const docsToDownload = patternLibrary.docsList.filter((doc) => patternLibrary.selectedDocIds.includes(doc.id));
    if (docsToDownload.length === 0) return;
    if (docsToDownload.length === 1) {
      downloadDoc(docsToDownload[0]);
      return;
    }

    const zip = new JSZip();
    for (const doc of docsToDownload) {
      const docSettings = docToSettings(doc, settings);
      const {canvas} = await renderCompositePattern(docSettings);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (blob) {
        zip.file(`CDP_${sanitizeFilename(doc.id)}_${docSettings.gridSize}x${docSettings.gridSize}.png`, blob);
      }
    }

    const zipBlob = await zip.generateAsync({type: 'blob'});
    const link = document.createElement('a');
    link.download = `CDP_Selected_${docsToDownload.length}_patterns.zip`;
    link.href = URL.createObjectURL(zipBlob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, [downloadDoc, patternLibrary.docsList, patternLibrary.selectedDocIds, renderCompositePattern, settings]);

  return {
    settings,
    setSettings,
    payloadDraft,
    setPayloadDraft,
    applyPayloadDraft,
    randomizePayloadDraft,
    batchCount,
    setBatchCount,
    seedLength,
    setSeedLength: handleSeedLengthChange,
    generationError,
    batchPatterns,
    isSaving,
    previewImageData,
    previewSettings,
    setPreviewSettings,
    previewDoc,
    setPreviewDoc,
    validationDialogMessage,
    setValidationDialogMessage,
    saveConfirmOpen,
    setSaveConfirmOpen,
    batchConfirmOpen,
    setBatchConfirmOpen,
    processingMessage,
    patternLibrary,
    requestSaveCurrentPattern,
    requestGenerateBatch,
    saveCurrentPattern,
    generateBatch,
    downloadBatch,
    downloadCurrentPng,
    downloadDoc,
    downloadSelectedDocs,
  };
}
