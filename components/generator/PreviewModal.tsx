'use client';

import {X} from 'lucide-react';
import {useEffect, useRef} from 'react';
import type {GeneratorSettings, PatternPreview} from '@/lib/types';
import {CDP_PAYLOAD_CHARS, CDP_RENDER_SCALE, generateRectangularCDPMatrix, normalizeCDPSettings, renderRectangularCDPToCanvas, renderThreePartCompositeToCanvas} from '@/lib/cdp';
import QRCode from 'qrcode';

const LOCKED_QR_PAYLOAD = 'https://puragroup.com';

function resolvePayloads(settings: GeneratorSettings) {
  const sanitizePayload = (value: string | undefined) => (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CDP_PAYLOAD_CHARS);
  const serialPayload = settings.seed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CDP_PAYLOAD_CHARS * 2);
  const payload1 = sanitizePayload(settings.payload1 ?? settings.payload) || serialPayload.slice(0, CDP_PAYLOAD_CHARS);
  return {
    payload1,
    payload2: sanitizePayload(settings.payload2) || serialPayload.slice(CDP_PAYLOAD_CHARS, CDP_PAYLOAD_CHARS * 2),
    payloadQr: LOCKED_QR_PAYLOAD,
  };
}

/** Shows a fullscreen preview of the currently selected pattern settings. */
export function PreviewModal({settings, preview, onClose}: {settings?: GeneratorSettings | null; preview?: PatternPreview | null; onClose: () => void}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageMode = Boolean(preview?.image_data);

  useEffect(() => {
    if (imageMode || !settings || !canvasRef.current) return;

    void (async () => {
      const normalized = normalizeCDPSettings(settings);
      const renderSettings = {
        ...normalized,
        dotSize: normalized.dotSize * CDP_RENDER_SCALE,
      };
      const leftPatternCanvas = document.createElement('canvas');
      const rightPatternCanvas = document.createElement('canvas');

      const qrCanvas = document.createElement('canvas');
      const {payload1, payload2, payloadQr} = resolvePayloads(normalized);
      const qrSize = renderSettings.gridSize * renderSettings.dotSize;
      const qrMarginModules = 1;
      const qrModel = QRCode.create(payloadQr, {
        errorCorrectionLevel: 'M',
      });
      const qrModuleCount = qrModel.modules.size;
      await QRCode.toCanvas(qrCanvas, payloadQr, {
        errorCorrectionLevel: 'M',
        margin: qrMarginModules,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: qrSize,
      });

      const qrContentHeight = Math.max(
        1,
        Math.round(qrCanvas.height * (qrModuleCount / (qrModuleCount + qrMarginModules * 2))),
      );

      renderRectangularCDPToCanvas(generateRectangularCDPMatrix({...normalized, payload: payload1}), leftPatternCanvas, {...renderSettings, payload: payload1}, {
        targetHeight: qrContentHeight,
      });
      renderRectangularCDPToCanvas(generateRectangularCDPMatrix({...normalized, payload: payload2}), rightPatternCanvas, {...renderSettings, payload: payload2}, {
        targetHeight: qrContentHeight,
      });

      renderThreePartCompositeToCanvas(leftPatternCanvas, qrCanvas, rightPatternCanvas, canvasRef.current!, {
        top: payload1,
        bottom: payload2,
      });
    })();
  }, [imageMode, settings]);

  const title = preview?.id ?? settings?.seed ?? 'Preview';
  const density = preview?.density ?? settings?.dotDensity;
  const size = preview?.size ?? settings?.gridSize;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#0a0d15] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-mono text-sm font-black uppercase tracking-wider text-emerald-300">Preview: {title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
          {imageMode ? (
            <img src={preview?.image_data} alt={title} className="w-full max-w-[340px] [image-rendering:pixelated]" />
          ) : (
            <canvas ref={canvasRef} className="w-full max-w-[340px] [image-rendering:pixelated]" />
          )}
        </div>
        <div className="mt-4 text-center text-xs text-slate-400">
          Resolusi: {size}x{size} | Density: {((density ?? 0) * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
