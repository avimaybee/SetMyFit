"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { currentUser } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
import { uploadClothingImage } from "@/lib/uploads";
import { WardrobeGrid } from "@/components/wardrobe/WardrobeGrid";
import { ClothingItem, ClothingType } from "@/types/retro";
import { IClothingItem } from "@/types";
import { toast } from "@/components/ui/toaster";
import { useAddItem } from "@/contexts/AddItemContext";
import { dataUrlToFile, parseDataUrl } from "@/lib/utils";
import { ListSkeleton } from "@/components/ui/skeletons";

export default function WardrobePage() {
    const [items, setItems] = useState<ClothingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadFailed, setLoadFailed] = useState(false);
    const { isGlobalAddOpen, openGlobalAdd, closeGlobalAdd } = useAddItem();
    // Serialize saves + favorite toggles to prevent duplicates and races.
    const savingRef = useRef(false);
    const favoriteInFlightRef = useRef<Set<string>>(new Set());

    const fetchWardrobe = useCallback(async () => {
        try {
            setLoading(true);
            setLoadFailed(false);
            const fbUser = await currentUser();
            if (!fbUser) return;

            const response = await apiFetch("/api/wardrobe");
            if (response.status === 401) {
                toast.error("Session expired. Please sign in again.");
                return;
            }
            if (!response.ok) throw new Error("Failed to fetch wardrobe");

            const data = await response.json();
            if (data.success && data.data) {
                const mappedItems: ClothingItem[] = (data.data as IClothingItem[]).map((item) => ({
                    id: item.id.toString(),
                    name: item.name,
                    category: mapDbTypeToUiCategory(item.type),
                    type: item.type, // Keep original type
                    image_url: item.image_url || "",
                    color: item.color || "Unknown",
                    style_tags: (item.style_tags || []) as string[],
                    season_tags: (item.season_tags || []) as string[],
                    material: item.material || "Cotton",
                    insulation_value: item.insulation_value || 5,
                    dress_code: (item.dress_code || []) as string[],
                    wear_count: item.wear_count || 0,
                    last_worn: item.last_worn || null,
                    is_favorite: item.favorite || false,
                    created_at: item.created_at
                }));
                setItems(mappedItems);
            }
        } catch (err) {
            console.error("Error fetching wardrobe:", err);
            setLoadFailed(true);
            toast.error("Failed to load wardrobe items.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWardrobe();
    }, [fetchWardrobe]);

    const mapDbTypeToUiCategory = (dbType: string): ClothingType => {
        switch (dbType) {
            case 'Footwear': return 'Shoes';
            case 'Headwear': return 'Accessory';
            case 'Outerwear': return 'Outerwear';
            case 'Top': return 'Top';
            case 'Bottom': return 'Bottom';
            case 'Dress': return 'Dress';
            default: return 'Top';
        }
    };

    const mapUiCategoryToDbType = (uiCategory: ClothingType): string => {
        switch (uiCategory) {
            case 'Shoes': return 'Footwear';
            default: return uiCategory;
        }
    };

    const handleAddItem = async (item: Partial<ClothingItem>, file?: File) => {
        // Double-clicking SAVE must not create two items.
        if (savingRef.current) return;
        savingRef.current = true;
        let uploadToastId: string | null = null;
        try {
            const fbUser = await currentUser();
            if (!fbUser) {
                toast.error("You must be logged in.");
                return;
            }

            let imageUrl = item.image_url;
            let uploadFile = file;

            if (!uploadFile && imageUrl && imageUrl.startsWith("data:")) {
                try {
                    uploadFile = dataUrlToFile(imageUrl, "wardrobe-item.webp");
                } catch (conversionError) {
                    console.error("Failed to convert data URL to file", conversionError);
                    toast.error("Unable to process image upload.");
                    return;
                }
            }

            if (uploadFile) {
                uploadToastId = toast.loading('UPLOADING IMAGE... 0%');
                const uploadResult = await uploadClothingImage(uploadFile, fbUser.uid, {
                    onProgress: (percent) => {
                        if (!uploadToastId) return;
                        toast.loading(`UPLOADING IMAGE... ${percent}%`, { id: uploadToastId });
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
                category: "General", // Default or derived
                material: item.material,
                color: item.color || "Unknown",
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

            toast.success("Item added to wardrobe.");
            closeGlobalAdd();
            fetchWardrobe();

        } catch (err) {
            console.error("Error adding item:", err);
            const errorMessage = err instanceof Error ? err.message : "Failed to add item";
            toast.error(errorMessage);
        } finally {
            savingRef.current = false;
            if (uploadToastId) {
                toast.dismiss(uploadToastId);
            }
        }
    };

    const handleUpdateItem = async (item: Partial<ClothingItem>, file?: File) => {
        if (!item.id) return;
        if (savingRef.current) return;
        savingRef.current = true;

        let uploadToastId: string | null = null;
        try {
            const fbUser = await currentUser();
            if (!fbUser) {
                toast.error("You must be logged in.");
                return;
            }

            let imageUrl = item.image_url;
            let uploadFile = file;

            if (!uploadFile && imageUrl && imageUrl.startsWith("data:")) {
                try {
                    uploadFile = dataUrlToFile(imageUrl, "wardrobe-item.webp");
                } catch (conversionError) {
                    console.error("Failed to convert data URL to file", conversionError);
                    toast.error("Unable to process image upload.");
                    return;
                }
            }

            if (uploadFile) {
                uploadToastId = toast.loading('UPLOADING IMAGE... 0%');
                const uploadResult = await uploadClothingImage(uploadFile, fbUser.uid, {
                    onProgress: (percent) => {
                        if (!uploadToastId) return;
                        toast.loading(`UPLOADING IMAGE... ${percent}%`, { id: uploadToastId });
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
                material: item.material,
                season_tags: item.season_tags,
                dress_code: item.dress_code,
                image_url: imageUrl,
                insulation_value: item.insulation_value,
                is_favorite: item.is_favorite,
                style_tags: item.style_tags
            };

            const response = await apiFetch(`/api/wardrobe/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to update item");

            toast.success("Item updated.");
            fetchWardrobe();
        } catch (err) {
            console.error("Error updating item:", err);
            toast.error("Failed to update item.");
        } finally {
            savingRef.current = false;
            if (uploadToastId) {
                toast.dismiss(uploadToastId);
            }
        }
    };

    const handleDelete = async (id: string) => {
        // Snapshot for revert: the API may fail after we optimistically remove.
        const snapshot = items;
        setItems(prev => prev.filter(i => i.id !== id));
        try {
            const response = await apiFetch(`/api/wardrobe/${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Failed to delete item");
            toast.success("Item deleted.");
        } catch (err) {
            console.error("Error deleting item:", err);
            setItems(snapshot);
            toast.error("Failed to delete item.");
        }
    };

    const handleToggleFavorite = async (id: string) => {
        // Serialize per item so rapid toggles can't revert to a stale value.
        if (favoriteInFlightRef.current.has(id)) return;
        const item = items.find(i => i.id === id);
        if (!item) return;
        const next = !item.is_favorite;
        favoriteInFlightRef.current.add(id);

        // Optimistic update
        setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: next } : i));

        try {
            const response = await apiFetch(`/api/wardrobe/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_favorite: next })
            });
            if (!response.ok) throw new Error("Failed to update favorite status");
        } catch (err) {
            console.error("Error updating favorite:", err);
            // Revert
            setItems(prev => prev.map(i => i.id === id ? { ...i, is_favorite: item.is_favorite } : i));
            toast.error("Failed to update favorite.");
        } finally {
            favoriteInFlightRef.current.delete(id);
        }
    };

    const handleAnalyzeImage = async (base64: string, options?: { signal?: AbortSignal }): Promise<Partial<ClothingItem> | null> => {
        try {
            const { base64: payload, mimeType } = parseDataUrl(base64, "image/webp");
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
            toast.error("Failed to analyze image.");
            return null;
        }
    };

    return (
        <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-main)] min-h-screen text-[var(--text)]">
            <h1 className="sr-only">Wardrobe</h1>
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <ListSkeleton />
                ) : loadFailed && items.length === 0 ? (
                    <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <p className="font-mono font-bold">WARDROBE_LOAD_FAILED</p>
                        <p className="font-mono text-xs mt-2 text-gray-600">Check your connection and try again.</p>
                        <button
                            onClick={fetchWardrobe}
                            className="mt-4 bg-black text-white font-mono text-xs px-4 py-2 border-2 border-black hover:bg-gray-800"
                        >
                            RETRY
                        </button>
                    </div>
                ) : (
                    <WardrobeGrid
                        items={items}
                        onAddItem={handleAddItem}
                        onUpdateItem={handleUpdateItem}
                        onDelete={handleDelete}
                        isAdding={isGlobalAddOpen}
                        onOpenAdd={openGlobalAdd}
                        onCloseAdd={closeGlobalAdd}
                        onToggleFavorite={handleToggleFavorite}
                        onAnalyzeImage={handleAnalyzeImage}
                    />
                )}
            </div>
        </div>
    );
}
