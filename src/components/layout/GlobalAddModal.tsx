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

export const GlobalAddModal: React.FC = () => {
    const pathname = usePathname();
    const { isGlobalAddOpen, closeGlobalAdd } = useAddItem();

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

            // Reload the page to refresh wardrobe if on wardrobe page
            if (typeof window !== 'undefined' && window.location.pathname === '/wardrobe') {
                window.location.reload();
            }

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
        try {
            const { base64: payload, mimeType } = parseDataUrl(base64, 'image/webp');
            const response = await apiFetch("/api/wardrobe/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: payload, mimeType }),
                signal: options?.signal
            });

            if (!response.ok) throw new Error("Analysis failed");

            const result = await response.json();
            if (result.success && result.data) {
                return result.data as Partial<ClothingItem>;
            }
            return null;
        } catch (error) {
            console.error("Error analyzing image:", error);
            toast.error("Stylist couldn't scan that photo. You can fill details manually.");
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
