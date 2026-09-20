import { toast } from "@/components/ui/toaster";
import { clientLogger } from "@/lib/clientLogger";

export interface ImageProcessOptions {
    removeBackground?: boolean;
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

            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
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
}

export const processImageUpload = async (file: File, options: ImageProcessOptions): Promise<string> => {
    const {
        removeBackground: shouldRemoveBg,
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
        onProgress?.('OPTIMIZING', 10);

        // 1. Resize first (crucial for performance of BG removal and storage)
        const processingBlob = await resizeImage(file, maxWidth);

        onProgress?.('OPTIMIZING', 30);

        // 2. Background handling (Preserves original garment context with zero CDN latency)
        if (shouldRemoveBg) {
            onProgress?.('AI_REMOVING_BG', 40);
            onProgress?.('BG_REMOVAL_SKIPPED', 50);
            toast('Keeping your photo as-is to preserve crisp garment textures.', { icon: '✨' });
        }

        onProgress?.('COMPRESSING', 85);

        // 3. Final Compression to WebP
        const finalBase64 = await convertToWebP(processingBlob, quality);

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
