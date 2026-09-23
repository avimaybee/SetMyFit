"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { currentUser } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
import { StatsPage as StatsPageComponent } from "@/components/stats/StatsPage";
import { ClothingItem, Outfit, ClothingType } from "@/types/retro";
import { IClothingItem } from "@/types";
import { toast } from "@/components/ui/toaster";
import { StatsSkeleton } from "@/components/ui/skeletons";

export default function StatsPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [_history, setHistory] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadFailed(false);
      const fbUser = await currentUser();

      if (!fbUser) {
        router.push('/auth/sign-in');
        return;
      }

      // Wardrobe is required; history is best-effort (partial render beats
      // discarding good wardrobe data when history fails).
      const [wardrobeResult, historyResult] = await Promise.allSettled([
        apiFetch("/api/wardrobe"),
        apiFetch("/api/outfits/history?limit=100"), // Fetch last 100 for stats
      ]);

      if (wardrobeResult.status === 'rejected') throw wardrobeResult.reason;
      const wardrobeRes = wardrobeResult.value;
      if (!wardrobeRes.ok) throw new Error("Failed to fetch wardrobe");
      const wardrobeData = await wardrobeRes.json();

      let mappedItems: ClothingItem[] = [];
      if (wardrobeData.success && wardrobeData.data) {
        mappedItems = (wardrobeData.data as IClothingItem[]).map((item) => ({
          id: item.id.toString(),
          name: item.name,
          category: mapDbTypeToUiCategory(item.type),
          type: item.type,
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

      // Fetch History (best-effort)
      if (historyResult.status === 'fulfilled' && historyResult.value.ok) {
        const historyData = await historyResult.value.json();

        let mappedHistory: Outfit[] = [];
        if (historyData.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mappedHistory = historyData.data.map((h: any) => ({
          id: h.id.toString(),
          outfit_date: h.outfit_date,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: h.items.map((i: any) => ({
            id: i.id.toString(),
            name: i.name,
            category: mapDbTypeToUiCategory(i.type),
            type: i.type,
            image_url: i.image_url,
            color: i.color,
            // Fill defaults for missing fields in history item view
            season_tags: i.season_tags || [],
            style_tags: i.style_tags || [],
            material: i.material || "Unknown",
            insulation_value: i.insulation_value || 0,
            dress_code: i.dress_code || [],
            wear_count: i.wear_count || 0,
            last_worn: i.last_worn || null,
            is_favorite: i.is_favorite || false,
            created_at: i.created_at || new Date().toISOString()
          })),
          status: 'completed',
          rating: h.feedback
        }));
        setHistory(mappedHistory);
        }
      } else if (historyResult.status === 'rejected' || !historyResult.value.ok) {
        console.warn("History unavailable for stats — showing wardrobe-only stats.");
      }

    } catch (err) {
      console.error("Error fetching stats data:", err);
      setLoadFailed(true);
      toast.error("Couldn't pull up your wardrobe stats. Try refreshing.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  return (
    <div className="w-full max-w-7xl mx-auto pb-6 text-[var(--text)]">
      <h1 className="sr-only">Wardrobe statistics</h1>
      {loading ? (
        <StatsSkeleton />
      ) : loadFailed && items.length === 0 ? (
        <div className="bg-white border-2 border-black p-8 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="font-mono font-bold">STATS_LOAD_FAILED</p>
          <p className="font-mono text-xs mt-2 text-gray-600">Check your connection and try again.</p>
          <button
            onClick={fetchData}
            className="mt-4 bg-black text-white font-mono text-xs px-4 py-2 border-2 border-black hover:bg-gray-800"
          >
            RETRY
          </button>
        </div>
      ) : (
        <StatsPageComponent items={items} _history={_history} onNavigateToWardrobe={() => router.push('/wardrobe')} />
      )}
    </div>
  );
}
