"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter as _useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecommendationApiPayload, RecommendationDiagnostics, IClothingItem } from "@/lib/types";
import { OutfitRecommender, Outfit, ClothingItem, ClothingType } from "../components/outfit-recommendation";
import { OutfitSkeleton } from "../components/ui/skeletons";
import { toast } from "../components/ui/toaster";
import { MissionControl } from "../components/mission-control";
import { SystemMsg } from "../components/system-msg";

type RecommendationApiResponse = {
  success: boolean;
  data?: RecommendationApiPayload;
  diagnostics?: RecommendationDiagnostics;
  needsWardrobe?: boolean;
  message?: string;
  error?: string;
};

const RECOMMENDATION_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const createRecommendationSkeleton = (): RecommendationApiPayload => ({
  weather: null,
  alerts: [],
  recommendation: {
    outfit: [],
    confidence_score: 1,
    reasoning: "Manual configuration active",
    dress_code: "Casual",
    weather_alerts: [],
  },
});

// Normalize backend type to UI-compatible ClothingType
const normalizeToUIType = (type?: string | null): ClothingType => {
  if (!type) return 'Top';
  const normalized = type.toLowerCase().trim();

  switch (normalized) {
    case 'footwear':
    case 'shoes':
      return 'Shoes';
    case 'outerwear':
    case 'jacket':
    case 'coat':
      return 'Outerwear';
    case 'bottom':
    case 'bottoms':
    case 'pants':
    case 'trousers':
      return 'Bottom';
    case 'accessory':
    case 'headwear':
    case 'hat':
      return 'Accessory';
    case 'dress':
      return 'Dress';
    case 'top':
    case 'tops':
    case 'shirt':
    default:
      return 'Top';
  }
};

const mapClothingItem = (item: IClothingItem): ClothingItem => {
  const uiCategory = normalizeToUIType(item.type);

  return {
    id: item.id.toString(),
    name: item.name,
    category: uiCategory,           // Normalized for UI consumption
    type: item.type || uiCategory,  // Preserve original type for debugging
    color: item.color || "Unknown",
    image_url: item.image_url,
    insulation_value: item.insulation_value || 0,
    season_tags: item.season_tags || [],
    style_tags: item.style_tags || [],
    material: item.material || "Unknown",
    dress_code: Array.isArray(item.dress_code) ? item.dress_code : [],
    wear_count: item.wear_count || 0,
    last_worn: item.last_worn || null,
    is_favorite: item.favorite || false,
    created_at: item.created_at || new Date().toISOString(),
  };
};

export default function HomePage() {
  const router = _useRouter();
  const [recommendationData, setRecommendationData] = useState<RecommendationApiPayload | null>(null);
  const [hasBootstrappedContent, setHasBootstrappedContent] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [_userId, setUserId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string>('');
  const [lockedItems, setLockedItems] = useState<string[]>([]);
  const [allWardrobeItems, setAllWardrobeItems] = useState<ClothingItem[]>([]);
  const [rawWardrobeItems, setRawWardrobeItems] = useState<IClothingItem[]>([]);
  const [isLoggingOutfit, setIsLoggingOutfit] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [isWardrobeLoading, setIsWardrobeLoading] = useState(true);

  // Restore state from session storage on mount
  useEffect(() => {
    const cached = sessionStorage.getItem("lastRecommendation");
    const cachedTimestampRaw = sessionStorage.getItem("lastRecommendationTimestamp");
    const cachedTimestamp = cachedTimestampRaw ? Number(cachedTimestampRaw) : NaN;
    const cacheIsExpired = !Number.isFinite(cachedTimestamp) || Date.now() - cachedTimestamp > RECOMMENDATION_CACHE_TTL;

    if (cached && !cacheIsExpired) {
      try {
        setRecommendationData(JSON.parse(cached));
        setHasBootstrappedContent(true);
      } catch (e) {
        console.error("Failed to parse cached recommendation", e);
        sessionStorage.removeItem("lastRecommendation");
        sessionStorage.removeItem("lastRecommendationTimestamp");
      }
    } else if (cacheIsExpired) {
      sessionStorage.removeItem("lastRecommendation");
      sessionStorage.removeItem("lastRecommendationTimestamp");
    }

    // Restore locked items
    const cachedLocks = sessionStorage.getItem("lockedItems");
    if (cachedLocks) {
      try {
        setLockedItems(JSON.parse(cachedLocks));
      } catch (e) {
        console.error("Failed to parse cached locks", e);
      }
    }

    setIsRestored(true);
  }, []);

  // Persist locked items whenever they change
  useEffect(() => {
    sessionStorage.setItem("lockedItems", JSON.stringify(lockedItems));
  }, [lockedItems]);

  useEffect(() => {
    if (isAuthenticated) {
      const fetchWardrobe = async () => {
        setIsWardrobeLoading(true);
        try {
          const res = await fetch('/api/wardrobe');
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const typed = json.data as IClothingItem[];
            setRawWardrobeItems(typed);
            setAllWardrobeItems(typed.map(mapClothingItem));
          }
        } catch (e) {
          console.error("Failed to fetch wardrobe", e);
        } finally {
          setIsWardrobeLoading(false);
        }
      };
      fetchWardrobe();
    }
  }, [isAuthenticated]);

  const emitClientLog = useCallback((message: string, context?: Record<string, unknown>) => {
    if (context) console.info(`[setmyfit] ${message}`, context);
    else console.info(`[setmyfit] ${message}`);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsAuthenticated(true);
        setUserId(session.user.id);
      }
    };
    checkAuth();
  }, []);

  const fetchRecommendation = useCallback(async () => {
    setHasBootstrappedContent(true);
    setIsGenerating(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("Please sign in to get outfit recommendations");
        return;
      }

      const payload = {
        occasion: selectedOccasion,
        lockedItems: lockedItems
      };

      const res = await fetch("/api/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: RecommendationApiResponse = await res.json();

      if (data.success && data.data) {
        setRecommendationData(data.data);
        sessionStorage.setItem("lastRecommendation", JSON.stringify(data.data));
        sessionStorage.setItem("lastRecommendationTimestamp", Date.now().toString());
      } else {
        setError(data.message || "Failed to fetch recommendation");
        if (data.needsWardrobe) {
          // Don't treat this as an error - user just needs to add items
          setHasBootstrappedContent(true);  // Stop showing skeleton
        }
      }
    } catch (_err) {
      setError("An error occurred while fetching recommendation");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedOccasion, lockedItems]);

  const handleLogOutfit = useCallback(async (items: ClothingItem[]) => {
    if (!items.length || isLoggingOutfit) return;
    setIsLoggingOutfit(true);
    const itemIds = items
      .map((item) => Number.parseInt(item.id, 10))
      .filter((id) => Number.isFinite(id)) as number[];

    try {
      const response = await fetch('/api/outfit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        const errorMessage = payload?.message || payload?.error || 'Failed to log outfit';
        toast.error(errorMessage);
        emitClientLog('outfit:log:error', { error: errorMessage, status: response.status });
        return;
      }

      toast.success('Outfit logged successfully');
      emitClientLog('outfit:log:success', { outfitId: payload.data?.outfit_id });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to log outfit');
      emitClientLog('outfit:log:error', { error: message });
    } finally {
      setIsLoggingOutfit(false);
    }
  }, [emitClientLog, isLoggingOutfit]);

  useEffect(() => {
    if (isRestored && !recommendationData && isAuthenticated) {
      fetchRecommendation();
    }
  }, [isRestored, fetchRecommendation, recommendationData, isAuthenticated]);

  let parsedReasoning = {
    weatherMatch: recommendationData?.recommendation?.reasoning || "AI Optimized",
    totalInsulation: 0,
    layeringStrategy: "AI Optimized",
    colorAnalysis: "",
    occasionFit: ""
  };

  if (recommendationData?.recommendation?.detailed_reasoning) {
    try {
      const detailed = JSON.parse(recommendationData.recommendation.detailed_reasoning);
      parsedReasoning = {
        ...parsedReasoning,
        ...detailed
      };
    } catch (e) {
      console.error("Failed to parse detailed reasoning", e);
      parsedReasoning.layeringStrategy = recommendationData.recommendation.detailed_reasoning;
    }
  }

  const handleOutfitChange = (newItems: ClothingItem[]) => {
    // Map UI items back to IClothingItem using rawWardrobeItems
    const newOutfitRaw = newItems.map(uiItem => {
      const raw = rawWardrobeItems.find(r => r.id.toString() === uiItem.id);
      if (raw) return raw;
      // Fallback if not found (shouldn't happen if data is consistent)
      console.warn(`Could not find raw item for ${uiItem.id}`);
      return null;
    }).filter(Boolean) as IClothingItem[];

    // Update recommendationData
    setRecommendationData(prev => {
      // Create a base object if prev is null (e.g. starting from scratch)
      const base: RecommendationApiPayload = prev || createRecommendationSkeleton();

      const updated: RecommendationApiPayload = {
        ...base,
        recommendation: {
          ...base.recommendation,
          outfit: newOutfitRaw,
          reasoning: "Manual configuration active",
          // Clear detailed reasoning as it might no longer apply
          detailed_reasoning: JSON.stringify({
            weatherMatch: "Manual Override",
            layeringStrategy: "User selected configuration",
            colorAnalysis: "Manual Selection",
            occasionFit: "Manual Selection"
          })
        }
      };

      // Persist to session storage
      sessionStorage.setItem("lastRecommendation", JSON.stringify(updated));
      sessionStorage.setItem("lastRecommendationTimestamp", Date.now().toString());

      return updated;
    });
  };

  const handleToggleLock = (itemId: string) => {
    setLockedItems(prev => {
      if (prev.includes(itemId)) {
        emitClientLog(`Unlocked item: ${itemId}`);
        return prev.filter(id => id !== itemId);
      } else {
        emitClientLog(`Locked item: ${itemId}`);
        return [...prev, itemId];
      }
    });
  };

  const handleNavigateToWardrobe = () => {
    router.push('/wardrobe');
  };

  useEffect(() => {
    if (recommendationData && !hasBootstrappedContent) {
      setHasBootstrappedContent(true);
    }
  }, [recommendationData, hasBootstrappedContent]);

  const shouldShowSkeleton = !hasBootstrappedContent;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">

      {/* Left/Center Panel: Outfit Generator */}
      <div className="lg:col-span-2 h-full">
        {shouldShowSkeleton ? (
          <OutfitSkeleton />
        ) : (
          <OutfitRecommender
            items={allWardrobeItems}
            suggestedOutfit={recommendationData?.recommendation?.outfit ? {
              id: "generated",
              outfit_date: new Date().toISOString(),
              items: recommendationData.recommendation.outfit.map(mapClothingItem),
              weather_snapshot: {},
              reasoning: parsedReasoning
            } : null}
            isGenerating={isGenerating}
            generationProgress={0}
            onGenerate={fetchRecommendation}
            onLogOutfit={handleLogOutfit}
            onOutfitChange={handleOutfitChange}
            lockedItems={lockedItems}
            onToggleLock={handleToggleLock}
            isLogging={isLoggingOutfit}
            isLoadingWardrobe={isWardrobeLoading}
            onNavigateToWardrobe={handleNavigateToWardrobe}
          />
        )}
      </div>

      {/* Right Panel: Widgets */}
      <div className="flex flex-col gap-4">

        {/* System Messages */}
        <div>
          <SystemMsg
            itemCount={allWardrobeItems.length}
          />
        </div>

        {/* Mission Control */}
        <div>
          <MissionControl
            selectedOccasion={selectedOccasion}
            onOccasionChange={(occ) => {
              setSelectedOccasion(occ);
              emitClientLog(`Mission profile updated: ${occ || 'General'}`);
            }}
            lockedCount={lockedItems.length}
          />
        </div>
      </div>
    </div>
  );
}
