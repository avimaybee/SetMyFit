"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter as _useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RecommendationApiPayload, RecommendationDiagnostics, IClothingItem, WeatherData, WeatherAlert } from "@/lib/types";
import { WeatherWidget, WeatherData as WidgetWeatherData } from "../components/weather-widget";
import { OutfitRecommender, Outfit, ClothingItem, ClothingType } from "../components/outfit-recommendation";
import { OutfitSkeleton, WeatherSkeleton } from "../components/ui/skeletons";
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
const WEATHER_STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes

const isWeatherDataStale = (weather?: WeatherData | null) => {
  if (!weather) return true;
  if (weather.is_mock) return true;
  const timestamp = weather.timestamp ? new Date(weather.timestamp).getTime() : 0;
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;
  return Date.now() - timestamp > WEATHER_STALE_THRESHOLD;
};

const createRecommendationSkeleton = (): RecommendationApiPayload => ({
  weather: {
    temperature: 0,
    feels_like: 0,
    humidity: 0,
    wind_speed: 0,
    uv_index: 0,
    air_quality_index: 0,
    pollen_count: 0,
    weather_condition: "Unknown",
    timestamp: new Date(),
    city: "Manual Selection",
  },
  alerts: [],
  recommendation: {
    outfit: [],
    confidence_score: 1,
    reasoning: "Manual configuration active",
    dress_code: "Casual",
    weather_alerts: [],
  },
});

const mapClothingItem = (item: IClothingItem): ClothingItem => ({
  id: item.id.toString(),
  name: item.name,
  category: item.type as ClothingType,
  type: item.category || item.type,
  color: item.color || "Unknown",
  image_url: item.image_url,
  insulation_value: item.insulation_value || 0,
  season_tags: [],
  style_tags: [],
  material: "Unknown",
  dress_code: [],
  wear_count: 0,
  last_worn: null,
  is_favorite: false,
  created_at: new Date().toISOString(),
});

export default function HomePage() {
  const _router = _useRouter();
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [recommendationData, setRecommendationData] = useState<RecommendationApiPayload | null>(null);
  const [hasBootstrappedContent, setHasBootstrappedContent] = useState(false);
  const [_error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [_userId, setUserId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logs, setLogs] = useState<{ message: string; ts: string }[]>([]);
  const [selectedOccasion, setSelectedOccasion] = useState<string>('');
  const [lockedItems, setLockedItems] = useState<string[]>([]);
  const [allWardrobeItems, setAllWardrobeItems] = useState<ClothingItem[]>([]);
  const [rawWardrobeItems, setRawWardrobeItems] = useState<IClothingItem[]>([]);
  const [isLoggingOutfit, setIsLoggingOutfit] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [weatherRefreshInFlight, setWeatherRefreshInFlight] = useState(false);

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
        }
      };
      fetchWardrobe();
    }
  }, [isAuthenticated]);

  const emitClientLog = useCallback((message: string, context?: Record<string, unknown>) => {
    const entry = {
      message,
      ts: new Date().toISOString(),
    };
    setLogs(prev => [...prev.slice(-50), entry]); // Keep last 50 logs
    if (context) console.info(`[setmyfit] ${message}`, context);
    else console.info(`[setmyfit] ${message}`);
  }, []);

  const upsertWeatherIntoRecommendation = useCallback((weather: WeatherData, alerts: WeatherAlert[] = []) => {
    setRecommendationData(prev => {
      const base: RecommendationApiPayload = prev || createRecommendationSkeleton();
      const updated: RecommendationApiPayload = {
        ...base,
        weather,
        alerts: alerts.length ? alerts : base.alerts,
      };
      sessionStorage.setItem("lastRecommendation", JSON.stringify(updated));
      sessionStorage.setItem("lastRecommendationTimestamp", Date.now().toString());
      return updated;
    });
    setHasBootstrappedContent(true);
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

  const requestLocation = useCallback(() => {
    setError(null);
    emitClientLog('location:request:start');

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          emitClientLog('location:request:success', coords);
          setLocation(coords);
          localStorage.setItem("userLocation", JSON.stringify(coords));
        },
        (error) => {
          let errorMsg = "Location access denied";
          if (error.code === 1) errorMsg = "Location permission denied";
          if (error.code === 2) errorMsg = "Location unavailable";
          if (error.code === 3) errorMsg = "Location timeout";
          emitClientLog('location:request:error', { code: error.code, message: errorMsg });

          const defaultLocation = { lat: 40.7128, lon: -74.0060 };
          setLocation(defaultLocation);
          toast(`${errorMsg}. Using New York instead.`, { icon: "⚠️" });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      const defaultLocation = { lat: 40.7128, lon: -74.0060 };
      setLocation(defaultLocation);
      toast("Geolocation not supported. Using New York.", { icon: "📍" });
    }
  }, [emitClientLog]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  const refreshWeather = useCallback(async () => {
    if (!location || weatherRefreshInFlight) return;
    setWeatherRefreshInFlight(true);
    emitClientLog('weather:refresh:start', { location });

    try {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lon: location.lon.toString(),
      });
      const res = await fetch(`/api/weather?${params.toString()}`, { cache: 'no-store' });
      const payload = await res.json();

      if (res.ok && payload.success && payload.data?.weather) {
        upsertWeatherIntoRecommendation(payload.data.weather as WeatherData, payload.data.alerts || []);
        emitClientLog('weather:refresh:success', { provider: payload.data.weather.provider });
      } else {
        emitClientLog('weather:refresh:error', { status: res.status, body: payload });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      emitClientLog('weather:refresh:error', { error: message });
    } finally {
      setWeatherRefreshInFlight(false);
    }
  }, [emitClientLog, location, upsertWeatherIntoRecommendation, weatherRefreshInFlight]);

  const fetchRecommendation = useCallback(async () => {
    if (!location) return;
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
        ...location,
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
        console.log('🔍 Recommendation response received:', {
          hasWeather: !!data.data.weather,
          weatherData: data.data.weather,
          weatherTemp: data.data.weather?.temperature,
          weatherCity: data.data.weather?.city,
        });
        setRecommendationData(data.data);
        sessionStorage.setItem("lastRecommendation", JSON.stringify(data.data));
        sessionStorage.setItem("lastRecommendationTimestamp", Date.now().toString());
      } else {
        setError(data.message || "Failed to fetch recommendation");
        if (data.needsWardrobe) {
          // Handle needs wardrobe case
        }
      }
    } catch (_err) {
      setError("An error occurred while fetching recommendation");
    } finally {
      setIsGenerating(false);
    }
  }, [location, selectedOccasion, lockedItems]);

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
    if (isRestored && location && !recommendationData && isAuthenticated) {
      fetchRecommendation();
    }
  }, [isRestored, location, fetchRecommendation, recommendationData, isAuthenticated]);

  useEffect(() => {
    if (!isRestored || !location || !isAuthenticated) return;
    if (weatherRefreshInFlight) return;
    if (!isWeatherDataStale(recommendationData?.weather)) return;
    refreshWeather();
  }, [isRestored, location, isAuthenticated, recommendationData, refreshWeather, weatherRefreshInFlight]);

  // Map data to new UI types
  const weatherData: WidgetWeatherData = {
    temp: recommendationData?.weather?.temperature || 0,
    condition: recommendationData?.weather?.weather_condition || "Unknown",
    city: recommendationData?.weather?.city || "Current Location",
    humidity: recommendationData?.weather?.humidity || 0,
    wind: recommendationData?.weather?.wind_speed || 0,
  };

  // Debug: Log what the widget is actually receiving
  if (process.env.NODE_ENV === 'development') {
    console.log('🎨 Weather Widget Data:', {
      raw: recommendationData?.weather,
      mapped: weatherData,
      usingFallback: !recommendationData?.weather?.temperature,
    });
  }

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

  const _suggestedOutfit: Outfit | null = recommendationData?.recommendation ? {
    id: recommendationData.recommendation.id?.toString() || "temp-id",
    outfit_date: new Date().toISOString(),
    items: recommendationData.recommendation.outfit.map(mapClothingItem),
    reasoning: parsedReasoning
  } : null;

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
              weather_snapshot: weatherData as unknown as Record<string, unknown>,
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
          />
        )}
      </div>

      {/* Right Panel: Widgets */}
      <div className="flex flex-col gap-4 h-full">

        {/* Weather Widget */}
        <div className="h-48">
          {!shouldShowSkeleton ? (
            <WeatherWidget data={weatherData} />
          ) : (
            <WeatherSkeleton />
          )}
        </div>

        {/* System Messages */}
        <div className="flex-1">
          <SystemMsg
            logs={logs}
            location={weatherData?.city}
            season="Autumn"
            itemCount={allWardrobeItems.length}
          />
        </div>

        {/* Mission Control */}
        <div className="flex-1 min-h-[200px]">
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
