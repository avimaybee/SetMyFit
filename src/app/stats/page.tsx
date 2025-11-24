"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatsPage as StatsPageComponent } from "@/components/stats/StatsPage";
import { ClothingItem, Outfit, ClothingType } from "@/types/retro";
import { IClothingItem } from "@/types";
import { toast } from "@/components/ui/toaster";

export default function StatsPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [_history, setHistory] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      // Fetch Wardrobe
      const wardrobeRes = await fetch("/api/wardrobe");
      if (!wardrobeRes.ok) throw new Error("Failed to fetch wardrobe");
      const wardrobeData = await wardrobeRes.json();
      
      let mappedItems: ClothingItem[] = [];
      if (wardrobeData.success && wardrobeData.data) {
        mappedItems = (wardrobeData.data as IClothingItem[]).map((item) => ({
          id: item.id.toString(),
          name: item.name,
          category: mapDbTypeToUiCategory(item.type),
          type: item.type,
          image_url: item.image_url || "https://picsum.photos/200/300?grayscale",
          color: item.color || "Unknown",
          style_tags: (item.style_tags || []) as string[],
          season_tags: (item.season_tags || []) as string[],
          material: item.material || "Cotton",
          insulation_value: item.insulation_value || 5,
          dress_code: (item.dress_code || []) as string[],
          wear_count: item.wear_count || 0,
          last_worn: item.last_worn || null,
          is_favorite: item.is_favorite || false,
          created_at: item.created_at
        }));
        setItems(mappedItems);
      }

      // Fetch History
      const historyRes = await fetch("/api/outfits/history?limit=100"); // Fetch last 100 for stats
      if (!historyRes.ok) throw new Error("Failed to fetch history");
      const historyData = await historyRes.json();
      
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

    } catch (err) {
      console.error("Error fetching stats data:", err);
      toast.error("Failed to load statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

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
        <div className="h-full p-4 md:p-8 overflow-y-auto bg-[var(--bg-primary)] min-h-screen text-[var(--text)]">
            <div className="max-w-7xl mx-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--border)]"></div>
                    </div>
                ) : (
                  <StatsPageComponent items={items} _history={_history} />
                )}
            </div>
        </div>
  );
}
