import { apiFetch } from "@/lib/api";
import { clientLogger } from "@/lib/clientLogger";

export interface ImageProcessOptions {
    maxWidth?: number;
    quality?: number;
    onProgress?: (status: string, percent: number) => void;
}

/**
 * Internal helper to resize image using Canvas
 */
const resizeImage = async (source: Blob | string, maxWidth: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxWidth) {
                if (width > height) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                } else {
                    width = Math.round(width * (maxWidth / height));
                    height = maxWidth;
                }
            }

            clientLogger.image.info(`Resizing canvas: ${img.width}x${img.height} → ${width}x${height}`);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas blob conversion failed"));
            }, 'image/png');
        };

        img.onerror = (err) => reject(err);

        if (source instanceof Blob) {
            img.src = URL.createObjectURL(source);
        } else {
            img.src = source;
        }
    });
};

/**
 * Internal helper to convert Blob to optimized WebP Base64
 */
const convertToWebP = async (source: Blob, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL('image/webp', quality);
            clientLogger.image.info(`WebP conversion complete: ${Math.round(dataUrl.length / 1024)} KB base64`);
            resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(source);
    });
};

export const processImageUpload = async (file: File, options: ImageProcessOptions = {}): Promise<string> => {
    const {
        maxWidth = 1024,
        quality = 0.8,
        onProgress
    } = options;

    clientLogger.image.info(`processImageUpload invoked for "${file.name}"`, {
        sizeBytes: file.size,
        sizeKb: Math.round(file.size / 1024),
        type: file.type,
        maxWidth,
        quality,
    });

    try {
        onProgress?.('OPTIMIZING', 15);

        // 1. Resize first for fast processing and optimal payload size
        const intermediateBlob = await resizeImage(file, maxWidth);
        let processedBlob: Blob = intermediateBlob;

        onProgress?.('PROCESSING', 45);

        // 2. Natively apply background removal via edge route
        try {
            const intermediateDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(intermediateBlob);
            });

            const res = await apiFetch('/api/wardrobe/remove-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: intermediateDataUrl }),
            });

            if (res.ok) {
                const json = await res.json();
                if (json.success && json.image) {
                    const byteString = atob(json.image.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    processedBlob = new Blob([ab], { type: 'image/png' });
                    clientLogger.image.success(`Native background cutout applied via ${json.provider || 'server provider'}`);
                } else {
                    clientLogger.image.info('Background cutout unavailable or skipped; preserving original image');
                }
            }
        } catch (bgError) {
            clientLogger.image.warn('Native background removal skipped gracefully:', bgError);
        }

        onProgress?.('COMPRESSING', 85);

        // 3. Final compression to WebP
        const finalBase64 = await convertToWebP(processedBlob, quality);

        onProgress?.('DONE', 100);
        clientLogger.image.success(`Image pipeline succeeded for "${file.name}"`, {
            outputLength: finalBase64.length,
        });
        return finalBase64;

    } catch (error) {
        clientLogger.image.error("Image pipeline error:", error);
        throw error;
    }
};
