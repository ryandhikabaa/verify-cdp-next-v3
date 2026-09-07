export const V3_LOCKED_QR_MODULE_COUNT = 25;
export const V3_LOCKED_QR_MARGIN_MODULES = 1;

export function loadQrImage(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('QR image tidak dapat dibaca.'));
		image.src = dataUrl;
	});
}

export async function renderApiQrToCanvas(dataUrl: string, canvas: HTMLCanvasElement, qrSize: number) {
	const image = await loadQrImage(dataUrl);
	canvas.width = qrSize;
	canvas.height = qrSize;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas QR tidak tersedia.');
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, qrSize, qrSize);

	// API images may contain a larger quiet zone than the former local QR.
	// Crop only the outer white border, then restore the locked one-module margin.
	const sourceCanvas = document.createElement('canvas');
	const sourceSize = Math.max(image.naturalWidth, image.naturalHeight);
	sourceCanvas.width = sourceSize;
	sourceCanvas.height = sourceSize;
	const sourceContext = sourceCanvas.getContext('2d', {willReadFrequently: true});
	if (!sourceContext) throw new Error('Canvas sumber QR tidak tersedia.');
	sourceContext.fillStyle = '#fff';
	sourceContext.fillRect(0, 0, sourceSize, sourceSize);
	sourceContext.drawImage(image, 0, 0, sourceSize, sourceSize);
	const pixels = sourceContext.getImageData(0, 0, sourceSize, sourceSize).data;
	let minX = sourceSize;
	let minY = sourceSize;
	let maxX = -1;
	let maxY = -1;
	for (let y = 0; y < sourceSize; y += 1) {
		for (let x = 0; x < sourceSize; x += 1) {
			const offset = (y * sourceSize + x) * 4;
			const alpha = pixels[offset + 3];
			const isDark = alpha > 0 && Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 245;
			if (!isDark) continue;
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}
	if (maxX < 0) throw new Error('QR image kosong.');

	const contentWidth = maxX - minX + 1;
	const contentHeight = maxY - minY + 1;
	const contentSize = Math.max(contentWidth, contentHeight);
	const centerX = (minX + maxX + 1) / 2;
	const centerY = (minY + maxY + 1) / 2;
	const margin = contentSize / V3_LOCKED_QR_MODULE_COUNT * V3_LOCKED_QR_MARGIN_MODULES;
	const cropSize = contentSize + margin * 2;
	const cropX = centerX - cropSize / 2;
	const cropY = centerY - cropSize / 2;
	ctx.drawImage(sourceCanvas, cropX, cropY, cropSize, cropSize, 0, 0, qrSize, qrSize);
}
