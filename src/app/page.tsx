"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter as _useRouter } from "next/navigation";
import { onAuthChange } from "@/lib/firebase/client";
import { apiFetch } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string>('');
  const [lockedItems, setLockedItems] = useState<string[]>([]);
  const [allWardrobeItems, setAllWardrobeItems] = useState<ClothingItem[]>([]);
  const [rawWardrobeItems, setRawWardrobeItems] = useState<IClothingItem[]>([]);
  const [isLoggingOutfit, setIsLoggingOutfit] = useState(false);
  const [outfitCount, setOutfitCount] = useState(0);
  const [lastOutfitDate, setLastOutfitDate] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [isWardrobeLoading, setIsWardrobeLoading] = useState(true);

  // sessionStorage keys are namespaced per user so two accounts on one
  // browser never see each other's recommendations or locks.
  const storageKey = useCallback(
    (base: string) => `setmyfit:${userId ?? 'anon'}:${base}`,
    [userId]
  );

  // Restore state from session storage once the user is known
  useEffect(() => {
    if (!userId) return;
    const keyOf = (base: string) => `setmyfit:${userId}:${base}`;
    const cached = sessionStorage.getItem(keyOf("lastRecommendation"));
    const cachedTimestampRaw = sessionStorage.getItem(keyOf("lastRecommendationTimestamp"));
    const cachedTimestamp = cachedTimestampRaw ? Number(cachedTimestampRaw) : NaN;
    const cacheIsExpired = !Number.isFinite(cachedTimestamp) || Date.now() - cachedTimestamp > RECOMMENDATION_CACHE_TTL;

    if (cached && !cacheIsExpired) {
      try {
        setRecommendationData(JSON.parse(cached));
        setHasBootstrappedContent(true);
      } catch (e) {
        console.error("Failed to parse cached recommendation", e);
        sessionStorage.removeItem(keyOf("lastRecommendation"));
        sessionStorage.removeItem(keyOf("lastRecommendationTimestamp"));
      }
    } else if (cacheIsExpired) {
      sessionStorage.removeItem(keyOf("lastRecommendation"));
      sessionStorage.removeItem(keyOf("lastRecommendationTimestamp"));
    }

    // Restore locked items
    const cachedLocks = sessionStorage.getItem(keyOf("lockedItems"));
    if (cachedLocks) {
      try {
        const parsed = JSON.parse(cachedLocks);
        if (Array.isArray(parsed)) setLockedItems(parsed.filter((id) => typeof id === 'string'));
      } catch (e) {
        console.error("Failed to parse cached locks", e);
      }
    }

    // Apply a template blueprint loaded from /templates (one-shot).
    const pendingRaw = sessionStorage.getItem(keyOf("pendingTemplate"));
    if (pendingRaw) {
      sessionStorage.removeItem(keyOf("pendingTemplate"));
      try {
        const pending = JSON.parse(pendingRaw) as { occasion?: string; templateName?: string };
        if (pending.occasion) {
          setSelectedOccasion(pending.occasion);
          toast(`Loaded the ${pending.templateName || 'preset'} fit for ${pending.occasion}.`);
        }
      } catch (e) {
        console.error("Failed to parse pending template", e);
      }
    }

    setIsRestored(true);
  }, [userId]);

  // Persist locked items whenever they change
  useEffect(() => {
    if (!userId) return;
    try {
      sessionStorage.setItem(`setmyfit:${userId}:lockedItems`, JSON.stringify(lockedItems));
    } catch {
      // Storage full/unavailable — non-fatal.
    }
  }, [lockedItems, userId]);

  const fetchWardrobe = useCallback(async () => {
    setIsWardrobeLoading(true);
    try {
      const res = await apiFetch('/api/wardrobe');
      if (res.status === 401) {
        router.push('/auth/sign-in');
        return;
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const typed = json.data as IClothingItem[];
        setRawWardrobeItems(typed);
        setAllWardrobeItems(typed.map(mapClothingItem));
        // Prune locks pointing at deleted items so counts/ reinjection stay valid.
        const validIds = new Set(typed.map((item) => String(item.id)));
        setLockedItems((prev) => prev.filter((id) => validIds.has(id)));
      }
    } catch (e) {
      console.error("Failed to fetch wardrobe", e);
    } finally {
      setIsWardrobeLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWardrobe();
    }
  }, [isAuthenticated, fetchWardrobe]);

  // Widget data for SystemMsg (best-effort; never blocks the generator).
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const res = await apiFetch('/api/stats');
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) setOutfitCount(Number(json.data?.totalOutfits ?? 0));
      } catch {
        // Non-fatal widget data.
      }
      try {
        const res = await apiFetch('/api/outfits/history?limit=1');
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success && Array.isArray(json.data) && json.data[0]?.outfit_date) {
          setLastOutfitDate(json.data[0].outfit_date);
        }
      } catch {
        // Non-fatal widget data.
      }
    })();
  }, [isAuthenticated]);

  const emitClientLog = useCallback((message: string, context?: Record<string, unknown>) => {
    if (context) console.info(`[setmyfit] ${message}`, context);
    else console.info(`[setmyfit] ${message}`);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange((fbUser) => {
      if (fbUser) {
        setIsAuthenticated(true);
        setUserId(fbUser.uid);
      } else {
        setIsAuthenticated(false);
        setUserId(null);
      }
    });
    return unsubscribe;
  }, []);

  const fetchRecommendation = useCallback(async () => {
    setHasBootstrappedContent(true);
    setIsGenerating(true);
    setError(null);
    try {
      const payload = {
        occasion: selectedOccasion,
        lockedItems: lockedItems
      };

      const res = await apiFetch("/api/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        setError("Please sign in to get outfit recommendations");
        router.push('/auth/sign-in');
        return;
      }

      const data: RecommendationApiResponse = await res.json();

      if (data.success && data.data) {
        setRecommendationData(data.data);
        try {
          sessionStorage.setItem(storageKey("lastRecommendation"), JSON.stringify(data.data));
          sessionStorage.setItem(storageKey("lastRecommendationTimestamp"), Date.now().toString());
        } catch {
          // Storage full/unavailable — non-fatal.
        }
      } else {
        setError(data.message || "Failed to fetch recommendation");
        if (data.needsWardrobe) {
          // Don't treat this as an error - user just needs to add items
          setHasBootstrappedContent(true);  // Stop showing skeleton
          toast("Your closet needs a few more pieces before we can style full fits.");
        }
      }
    } catch (_err) {
      setError("An error occurred while fetching recommendation");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedOccasion, lockedItems, router, storageKey]);

  const handleLogOutfit = useCallback(async (items: ClothingItem[]) => {
    if (isLoggingOutfit) return;
    if (!items.length) {
      toast.error("Pick or generate a fit before logging it.");
      return;
    }
    setIsLoggingOutfit(true);
    const itemIds = items
      .map((item) => Number.parseInt(item.id, 10))
      .filter((id) => Number.isFinite(id)) as number[];

    if (itemIds.length === 0) {
      toast.error("Couldn't log this one — looks like some pieces are missing.");
      setIsLoggingOutfit(false);
      return;
    }

    try {
      const response = await apiFetch('/api/outfit/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_ids: itemIds }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        const errorMessage = payload?.message || payload?.error || "Couldn't save today's fit. Try once more.";
        toast.error(errorMessage);
        emitClientLog('outfit:log:error', { error: errorMessage, status: response.status });
        return;
      }

      toast.success("Logged today's fit. Wear count updated.");
      emitClientLog('outfit:log:success', { outfitId: payload.data?.outfit_id });
      // Refresh wear counts / last-worn so stats and wardrobe stay accurate.
      fetchWardrobe();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error("Couldn't save today's fit. Try once more.");
      emitClientLog('outfit:log:error', { error: message });
    } finally {
      setIsLoggingOutfit(false);
    }
  }, [emitClientLog, isLoggingOutfit, fetchWardrobe]);

  const handleFeedback = useCallback(async (isLiked: boolean, reason?: string) => {
    const recId = recommendationData?.recommendation?.id;
    if (!recId) {
      toast.error("Generate a fit first before rating it.");
      return;
    }
    try {
      const res = await apiFetch(`/api/recommendation/${recId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_liked: isLiked, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to record feedback');
      }
      toast.success(isLiked ? "Liked! Future picks will lean this way." : "Noted — steering away from this.");
      emitClientLog('recommendation:feedback:success', { recId, isLiked });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error("Couldn't save that feedback. Try once more.");
      emitClientLog('recommendation:feedback:error', { error: message });
      throw error;
    }
  }, [recommendationData, emitClientLog]);

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

      // Persist to session storage (namespaced per user)
      try {
        sessionStorage.setItem(storageKey("lastRecommendation"), JSON.stringify(updated));
        sessionStorage.setItem(storageKey("lastRecommendationTimestamp"), Date.now().toString());
      } catch {
        // Storage full/unavailable — non-fatal.
      }

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
      <h1 className="sr-only">Outfit generator</h1>

      {/* Left/Center Panel: Outfit Generator */}
      <div className="lg:col-span-2 h-full">
        {error && !recommendationData && hasBootstrappedContent ? (
          <div className="bg-[#FF8E72] border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <p className="font-mono text-sm font-bold">GENERATION_FAILED: {error}</p>
            <button
              onClick={() => { setError(null); fetchRecommendation(); }}
              className="mt-3 bg-black text-white font-mono text-xs px-4 py-2 border-2 border-black hover:bg-gray-800"
            >
              RETRY
            </button>
          </div>
        ) : shouldShowSkeleton ? (
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
            recommendationId={recommendationData?.recommendation?.id ?? null}
            onFeedback={handleFeedback}
          />
        )}
      </div>

      {/* Right Panel: Widgets */}
      <div className="flex flex-col gap-4">

        {/* System Messages */}
        <div>
          <SystemMsg
            itemCount={allWardrobeItems.length}
            outfitCount={outfitCount}
            lastOutfitDate={lastOutfitDate}
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
