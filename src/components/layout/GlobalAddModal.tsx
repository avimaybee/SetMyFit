"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { currentUser } from '@/lib/firebase/client';
import { apiFetch } from '@/lib/api';
import { uploadClothingImage } from '@/lib/uploads';
import { WardrobeItemForm } from '@/components/wardrobe/WardrobeItemForm';
import { ClothingItem, ClothingType } from '@/types/retro';
import { toast } from '@/components/ui/toaster';
import { useAddItem } from '@/contexts/AddItemContext';
import { dataUrlToFile, parseDataUrl } from '@/lib/utils';
import { clientLogger } from '@/lib/clientLogger';

export const GlobalAddModal: React.FC = () => {
    const pathname = usePathname();
    const { isGlobalAddOpen, closeGlobalAdd, notifyItemAdded } = useAddItem();

    // The wardrobe route renders its own add/edit modal so we avoid double stacks here.
    if (pathname?.startsWith('/wardrobe')) {
        return null;
    }

    const mapUiCategoryToDbType = (uiCategory: ClothingType): string => {
        switch (uiCategory) {
            case 'Shoes': return 'Footwear';
            default: return uiCategory;
        }
    };

    const handleAddItem = async (item: Partial<ClothingItem>, file?: File) => {
        let uploadToastId: string | null = null;
        try {
            const fbUser = await currentUser();
            if (!fbUser) {
                toast.error("Sign in first to add pieces to your closet.");
                return;
            }

            let imageUrl = item.image_url;
            let uploadFile = file;

            if (!uploadFile && imageUrl && imageUrl.startsWith('data:')) {
                try {
                    uploadFile = dataUrlToFile(imageUrl, 'wardrobe-item.webp');
                } catch (conversionError) {
                    console.error('Failed to convert data URL to file', conversionError);
                    toast.error("Couldn't read that photo format. Try a JPG or PNG.");
                    return;
                }
            }

            if (uploadFile) {
                uploadToastId = toast.loading('Uploading piece... 0%');
                const uploadResult = await uploadClothingImage(uploadFile, fbUser.uid, {
                    onProgress: (percent) => {
                        if (!uploadToastId) return;
                        toast.loading(`Uploading piece... ${percent}%`, { id: uploadToastId });
                    },
                });
                if (!uploadResult.success || !uploadResult.url) {
                    throw new Error(uploadResult.error || "Failed to upload image");
                }
                imageUrl = uploadResult.url;
            }

            const payload = {
                name: item.name,
                type: mapUiCategoryToDbType(item.category as ClothingType),
                category: "General",
                material: item.material,
                color: "Unknown",
                season_tags: item.season_tags,
                dress_code: item.dress_code,
                image_url: imageUrl,
                insulation_value: item.insulation_value,
                is_favorite: item.is_favorite,
                style_tags: item.style_tags,
                pattern: item.pattern,
                fit: item.fit,
            };

            const response = await apiFetch("/api/wardrobe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("API Error Response:", errorData);
                throw new Error(errorData.error || "Failed to create item");
            }

            toast.success("Saved to your closet.");
            closeGlobalAdd();
            notifyItemAdded();

        } catch (err) {
            console.error("Error adding item:", err);
            const errorMessage = err instanceof Error ? err.message : "Couldn't add that piece. Try again.";
            toast.error(errorMessage);
        } finally {
            if (uploadToastId) {
                toast.dismiss(uploadToastId);
            }
        }
    };

    const handleAnalyzeImage = async (base64: string, options?: { signal?: AbortSignal }): Promise<Partial<ClothingItem> | null> => {
        clientLogger.visionAI.info('Dispatching image to /api/wardrobe/analyze', {
            dataUrlLength: base64.length,
            approxKb: Math.round(base64.length / 1024),
        });
        const startTime = performance.now();
        try {
            const { base64: payload, mimeType } = parseDataUrl(base64, 'image/webp');
            const response = await apiFetch("/api/wardrobe/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: payload, mimeType }),
                signal: options?.signal
            });

            const elapsedMs = Math.round(performance.now() - startTime);

            if (!response.ok) {
                clientLogger.visionAI.error(`Analysis HTTP error: ${response.status}`, { elapsedMs });
                throw new Error(`Analysis failed with status ${response.status}`);
            }

            const result = await response.json();
            if (result.success && result.data) {
                clientLogger.visionAI.success(`AI vision attributes extracted successfully in ${elapsedMs}ms`, result.data);
                return result.data as Partial<ClothingItem>;
            }

            if (!result.success) {
                clientLogger.visionAI.warn(`AI vision service returned error: ${result.error || result.message} — Reason: ${result.reason || 'None'}`, {
                    reason: result.reason,
                    isCreditsDepleted: result.isCreditsDepleted,
                    isKeySuspended: result.isKeySuspended,
                    elapsedMs,
                });
                if (result.isCreditsDepleted) {
                    toast.error("Google Gemini API credits are depleted. Please add credits at ai.studio/projects or use a free-tier API key.", { duration: 8000 });
                } else if (result.isKeySuspended) {
                    toast.error("Gemini API key is currently suspended. Please configure a valid key in Cloudflare secrets.", { duration: 6000 });
                } else if (result.message) {
                    toast.error(result.message, { duration: 5000 });
                }

                if (result.fallbackData) {
                    clientLogger.visionAI.info("Pre-filling form with smart defaults:", result.fallbackData);
                    return result.fallbackData as Partial<ClothingItem>;
                }
            }

            return null;
        } catch (error) {
            clientLogger.visionAI.error("Error during image analysis dispatch:", error);
            return null;
        }
    };

    return (
        <WardrobeItemForm
            isOpen={isGlobalAddOpen}
            onClose={closeGlobalAdd}
            onSave={handleAddItem}
            onAnalyzeImage={handleAnalyzeImage}
        />
    );
};
