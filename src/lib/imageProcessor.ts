
import { removeBackground } from "@imgly/background-removal";
import { toast } from '@/components/ui/toaster';

export interface ImageProcessOptions {
    removeBackground: boolean;
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
                height *= maxWidth / width;
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Export as Blob
            canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas blob conversion failed"));
            }, 'image/png'); // Intermediate PNG
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
            // WebP Compression
            resolve(canvas.toDataURL('image/webp', quality));
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

    try {
        onProgress?.('OPTIMIZING', 10);

        // 1. Resize first (crucial for performance of BG removal and storage)
        let processingBlob = await resizeImage(file, maxWidth);
        
        onProgress?.('OPTIMIZING', 30);

        // 2. Remove Background (If requested)
        if (shouldRemoveBg) {
            onProgress?.('AI_REMOVING_BG', 40);
            try {
                // Public Path is required when loading from CDN/External sources
                const bgRemovedBlob = await removeBackground(processingBlob, {
                    publicPath: 'https://static.img.ly/background-removal-data/1.5.5/dist/',
                    progress: (key: string, current: number, total: number) => {
                        // Map internal progress to our 40-80 range
                        const percent = 40 + Math.round((current / total) * 40);
                        onProgress?.(`AI_PROCESSING`, percent);
                    }
                });
                processingBlob = bgRemovedBlob;
            } catch (error) {
                console.error("Background removal failed, falling back to original", error);
                // Fallback: continue with original image but warn?
                onProgress?.('BG_REMOVAL_FAILED', 50);
                toast.warning('Background removal unavailable. Continuing with original image.');
            }
        }

        onProgress?.('COMPRESSING', 85);

        // 3. Final Compression to WebP
        const finalBase64 = await convertToWebP(processingBlob, quality);

        onProgress?.('DONE', 100);
        return finalBase64;

    } catch (error) {
        console.error("Image pipeline error:", error);
        throw error;
    }
};
