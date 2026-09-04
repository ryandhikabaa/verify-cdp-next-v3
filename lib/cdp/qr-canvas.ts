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
	ctx.drawImage(image, 0, 0, qrSize, qrSize);
}
