'use client';

import {X} from 'lucide-react';
import {useEffect, useRef} from 'react';
import type {GeneratorSettings, PatternPreview} from '@/lib/types';
import {CDP_RENDER_SCALE, generateV3Matrix, normalizeCDPSettings, renderRectangularCDPToCanvas, renderV3QrPatternToCanvas, validateV3Payload} from '@/lib/cdp';
import QRCode from 'qrcode';

const LOCKED_QR_PAYLOAD = 'https://puragroup.com';

function resolvePayload(settings: GeneratorSettings) {
  const payload = settings.payload ?? settings.payload1 ?? settings.seed;
  return validateV3Payload(payload);
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
      const patternCanvas = document.createElement('canvas');

      const qrCanvas = document.createElement('canvas');
      const payload = resolvePayload(normalized);
      const payloadQr = LOCKED_QR_PAYLOAD;
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

      const matrix = generateV3Matrix(payload);
      renderRectangularCDPToCanvas({rows: 64, columns: 32, cells: matrix}, patternCanvas, {...renderSettings, payload}, {
        targetHeight: qrContentHeight,
      });
      renderV3QrPatternToCanvas(qrCanvas, patternCanvas, canvasRef.current!, qrModuleCount, qrMarginModules);
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
