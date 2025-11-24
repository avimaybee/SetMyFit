import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IClothingItem, WeatherData, ClothingType, RecommendationDiagnostics, RecommendationApiPayload } from '@/lib/types';
import { generateAIOutfitRecommendation } from '@/lib/helpers/aiOutfitAnalyzer';
import { resolveInsulationValue, filterByLastWorn } from '@/lib/helpers/clothingHelpers';

interface InsufficientItemsError extends Error {
  customMessage?: string;
}
import { validateBody, recommendationRequestSchema } from '@/lib/validation';
import { logger, generateRequestId } from '@/lib/logger';
import { getCurrentSeason, getSeasonDescription } from '@/lib/helpers/seasonDetector';

// DB row type used for items fetched from Supabase
type DBClothingRow = Partial<IClothingItem> & {
  id?: number;
  category?: string | null;
  type?: string | null;
  rawType?: string | null;
  rawCategory?: string | null;
  normalizedType?: ClothingType | null;
};

const TYPE_ALIASES: Record<string, ClothingType> = {
  // Type field values (Title Case)
  top: 'Top',
  tops: 'Top',
  outerwear: 'Outerwear',
  bottom: 'Bottom',
  bottoms: 'Bottom',
  footwear: 'Footwear',
  accessory: 'Accessory',
  accessories: 'Accessory',
  headwear: 'Headwear',

  // Old schema ENUM values (original clothing_category enum)
  'shirt': 'Top',
  't-shirt': 'Top',
  'jacket': 'Outerwear',
  'pants': 'Bottom',
  'shoes': 'Footwear',

  // Common variations
  shirts: 'Top',
  tee: 'Top',
  tshirt: 'Top',
  blouse: 'Top',
  sweater: 'Top',
  jumper: 'Top',
  polo: 'Top',
  tank: 'Top',
  crewneck: 'Top',
  jackets: 'Outerwear',
  coat: 'Outerwear',
  coats: 'Outerwear',
  hoodie: 'Outerwear',
  hoodies: 'Outerwear',
  cardigan: 'Outerwear',
  cardigans: 'Outerwear',
  blazer: 'Outerwear',
  windbreaker: 'Outerwear',
  trousers: 'Bottom',
  jeans: 'Bottom',
  joggers: 'Bottom',
  shorts: 'Bottom',
  skirt: 'Bottom',
  leggings: 'Bottom',
  sweats: 'Bottom',
  shoe: 'Footwear',
  sneakers: 'Footwear',
  boots: 'Footwear',
  sandals: 'Footwear',
  loafers: 'Footwear',
  heels: 'Footwear',
  trainers: 'Footwear',
  belt: 'Accessory',
  scarf: 'Accessory',
  bag: 'Accessory',
  bags: 'Accessory',
  jewelry: 'Accessory',
  watch: 'Accessory',
  hat: 'Headwear',
  hats: 'Headwear',
  cap: 'Headwear',
  caps: 'Headwear',
  beanie: 'Headwear',
  beanies: 'Headwear',
  headband: 'Headwear'
};

const KEYWORD_TYPE_PRIORITIES: Array<{ type: ClothingType; keywords: string[] }> = [
  {
    type: 'Outerwear',
    keywords: [
      'jacket', 'coat', 'hoodie', 'cardigan', 'blazer', 'windbreaker', 'parka', 'poncho', 'shrug', 'gilet',
      'sweatshirt', 'zip-up', 'anorak', 'raincoat'
    ],
  },
  {
    type: 'Bottom',
    keywords: [
      'pant', 'jean', 'trouser', 'short', 'skirt', 'legging', 'tight', 'tights', 'chino', 'cargo', 'culotte',
      'jogger', 'sweatpant', 'salwar', 'shalwar', 'churidar', 'palazzo', 'lehenga', 'dhoti', 'lungi', 'ghagra',
      'skort', 'capri', 'track pant', 'trackpant', 'pyjama', 'pyjama pant'
    ],
  },
  {
    type: 'Footwear',
    keywords: [
      'shoe', 'sneaker', 'boot', 'loafer', 'heel', 'sandal', 'trainer', 'flip flop', 'flip-flop', 'slipper',
      'moccasin', 'oxford', 'brogu', 'pump', 'stiletto', 'jutti', 'mojari', 'kolhapuri', 'floaters', 'slides',
      'brogue'
    ],
  },
  {
    type: 'Top',
    keywords: [
      'shirt', 'tee', 't-shirt', 'tank', 'blouse', 'top', 'sweater', 'crewneck', 'polo', 'kurta', 'kurti',
      'kameez', 'tunic', 'henley', 'camisole', 'vest', 'hooded tee', 'saree blouse', 'peplum'
    ],
  },
  {
    type: 'Headwear',
    keywords: ['hat', 'beanie', 'cap', 'beret', 'visor', 'turban', 'pagdi', 'headband', 'headwrap'],
  },
  {
    type: 'Accessory',
    keywords: ['belt', 'scarf', 'glove', 'watch', 'bag', 'purse', 'bracelet', 'necklace', 'dupatta', 'shawl', 'stole'],
  },
];

const normalizeTypeValue = (value?: string | null): ClothingType | null => {
  if (!value) return null;
  const normalizedKey = value.trim().toLowerCase();
  return TYPE_ALIASES[normalizedKey] || null;
};

const guessTypeFromText = (value?: string | null): ClothingType | null => {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/[_-]/g, ' ');
  for (const { type, keywords } of KEYWORD_TYPE_PRIORITIES) {
    if (keywords.some(keyword => normalized.includes(keyword))) {
      return type;
    }
  }
  return null;
};

const guessTypeFromImageUrl = (imageUrl?: string | null): ClothingType | null => {
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    const fileName = url.pathname.split('/').pop();
    if (!fileName) return null;
    const decoded = decodeURIComponent(fileName);
    return guessTypeFromText(decoded);
  } catch (_err) {
    return guessTypeFromText(imageUrl);
  }
};

const deriveClothingType = (item: Partial<IClothingItem>): ClothingType | null => {
  const typeFromField = normalizeTypeValue(item.type as string | null);
  if (typeFromField) return typeFromField;

  const typeFromCategory = normalizeTypeValue(item.category as string | null);
  if (typeFromCategory) return typeFromCategory;

  const typeFromName = guessTypeFromText(item.name as string | null);
  if (typeFromName) return typeFromName;

  const typeFromDescription = guessTypeFromText((item.description as string | null) ?? null);
  if (typeFromDescription) return typeFromDescription;

  const typeFromStyle = guessTypeFromText(item.style as string | null);
  if (typeFromStyle) return typeFromStyle;

  const typeFromFit = guessTypeFromText(item.fit as string | null);
  if (typeFromFit) return typeFromFit;

  if (Array.isArray(item.style_tags)) {
    for (const tag of item.style_tags) {
      const typeFromTag = guessTypeFromText(tag);
      if (typeFromTag) return typeFromTag;
    }
  }

  const typeFromOccasion = Array.isArray(item.occasion)
    ? item.occasion.map(value => guessTypeFromText(value)).find(Boolean)
    : null;
  if (typeFromOccasion) return typeFromOccasion;

  const typeFromImage = guessTypeFromImageUrl(item.image_url as string | null);
  if (typeFromImage) return typeFromImage;

  return null;
};

const describeDetectedTypes = (items: Array<{ normalizedType: ClothingType | null; rawType?: string | null; rawCategory?: string | null }>): string[] => {
  return Array.from(new Set(items.map(item => {
    if (item.normalizedType) {
      return item.normalizedType;
    }
    if (item.rawType && item.rawType.trim()) {
      return `Unmapped type: ${item.rawType.trim()}`;
    }
    if (item.rawCategory && item.rawCategory.trim()) {
      return `Category only: ${item.rawCategory.trim()}`;
    }
    return 'Unlabeled item';
  })));
};

/**
 * POST /api/recommendation
 * Generate outfit recommendation based on weather and user wardrobe
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const validatedData = await validateBody(request, recommendationRequestSchema) as { lat: number; lon: number; occasion?: string; lockedItems?: string[] };
    const { lat, lon, occasion = "", lockedItems = [] } = validatedData;

    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 Generating recommendation for:', { lat, lon, occasion, lockedItems });
    }
    const { payload, diagnostics } = await generateRecommendation(user.id, lat, lon, occasion, lockedItems, request);
    if (process.env.NODE_ENV === 'development') {
      console.log('✓ Recommendation generated successfully');
    }

    return NextResponse.json({
      success: true,
      data: payload,
      diagnostics,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error generating recommendation:', errorMsg);
    logger.error('Error generating recommendation', { error });

    // Handle special cases for empty/insufficient wardrobe
    if (error instanceof Error) {
      if (error.message === 'EMPTY_WARDROBE') {
        return NextResponse.json(
          {
            success: false,
            error: 'EMPTY_WARDROBE',
            message: 'Your wardrobe is empty. Add some clothing items to get started!',
            needsWardrobe: true
          },
          { status: 200 }
        );
      }

      if (error.message === 'INSUFFICIENT_ITEMS') {
        const insufficientItemsError = error as InsufficientItemsError;
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_ITEMS',
            message: insufficientItemsError.customMessage || 'You need at least one top, one bottom, and one pair of shoes to create an outfit.',
            needsWardrobe: true
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recommendation'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate fresh outfit recommendation
 * Extracted to separate function for better organization
 */
async function generateRecommendation(
  userId: string,
  lat: number,
  lon: number,
  occasion: string,
  lockedItems: string[],
  request: NextRequest
): Promise<{ payload: RecommendationApiPayload; diagnostics: RecommendationDiagnostics }> {
  const supabase = await createClient();
  const requestId = generateRequestId('rec');
  const diagnostics: RecommendationDiagnostics = {
    requestId,
    warnings: [],
    events: [],
    summary: {
      wardrobeCount: 0,
      missingInsulationCount: 0,
      filterCounts: {},
      selectedItemIds: [],
    },
  };

  const summary = diagnostics.summary as NonNullable<RecommendationDiagnostics['summary']>;

  const pushEvent = (stage: string, meta?: Record<string, unknown>) => {
    diagnostics.events.push({ stage, timestamp: new Date().toISOString(), meta });
  };

  // Fetch user's wardrobe
  // Explicitly select columns to avoid fetching unnecessary large data
  const { data: wardrobeItems, error: wardrobeError } = await supabase
    .from('clothing_items')
    .select(`
      id, name, type, category, color, material, insulation_value, 
      last_worn, image_url, season_tags, style_tags, dress_code, 
      created_at, pattern, fit, style, occasion, description, favorite:is_favorite
    `)
    .eq('user_id', userId);

  if (wardrobeError) {
    throw new Error('Failed to fetch wardrobe items');
  }

  // Handle empty wardrobe gracefully - this is expected for new users
  if (!wardrobeItems || wardrobeItems.length === 0) {
    throw new Error('EMPTY_WARDROBE');
  }

  summary.wardrobeCount = wardrobeItems.length;
  pushEvent('wardrobe:fetched', { count: wardrobeItems.length });

  let normalizedWardrobeItems = (wardrobeItems as DBClothingRow[]).map((item) => {
    const normalizedType = deriveClothingType(item as DBClothingRow);
    return {
      ...(item as DBClothingRow),
      normalizedType,
      rawType: (item.type ?? null) as string | null,
      rawCategory: (item.category ?? null) as string | null,
    } as DBClothingRow & { normalizedType: ClothingType | null; rawType: string | null; rawCategory: string | null };
  });

  const missingInsulationCount = normalizedWardrobeItems.filter(item => typeof item.insulation_value !== 'number' || Number.isNaN(item.insulation_value as number)).length;
  summary.missingInsulationCount = missingInsulationCount;
  if (missingInsulationCount > 0) {
    diagnostics.warnings.push(`${missingInsulationCount} wardrobe items are missing insulation data. Using intelligent defaults.`);
  }
  pushEvent('wardrobe:normalized', {
    missingTypes: normalizedWardrobeItems.filter(item => !item.normalizedType).length,
    missingInsulation: missingInsulationCount,
  });

  // Log normalized items for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('=== Wardrobe Items Debug ===');
    console.log('Total items:', wardrobeItems.length);
    console.log('Normalized items:', normalizedWardrobeItems.map(item => ({
      id: item.id,
      name: item.name,
      rawType: item.rawType,
      rawCategory: item.rawCategory,
      normalizedType: item.normalizedType
    })));
  }

  const itemsNeedingBackfill = normalizedWardrobeItems.filter(item => (!item.rawType || !item.rawType.trim()) && item.normalizedType);
  if (itemsNeedingBackfill.length > 0) {
    diagnostics.warnings.push(`Backfilling ${itemsNeedingBackfill.length} wardrobe items missing explicit type labels.`);
    pushEvent('wardrobe:autoFixTypes', { count: itemsNeedingBackfill.length });
  }

  if (itemsNeedingBackfill.length > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Backfilling ${itemsNeedingBackfill.length} items with missing types`);
    }
    try {
      const results = await Promise.all(itemsNeedingBackfill.map(item =>
        supabase
          .from('clothing_items')
          .update({ type: item.normalizedType })
          .eq('id', item.id)
          .eq('user_id', userId)
      ));
      if (process.env.NODE_ENV === 'development') {
        console.log('Backfill results:', results.map(r => ({ error: r.error, count: r.count })));
        pushEvent('wardrobe:autoFixTypes:completed', {
          updated: results.reduce((sum, r) => sum + (r.count ?? 0), 0),
        });
      }

      // CRITICAL: Refetch the items after backfilling to get the updated types
      const { data: updatedWardrobeItems, error: refetchError } = await supabase
        .from('clothing_items')
        .select('*')
        .eq('user_id', userId);

      if (!refetchError && updatedWardrobeItems) {
        // Re-normalize with the updated data
        normalizedWardrobeItems = (updatedWardrobeItems as DBClothingRow[]).map((item) => {
          const normalizedType = deriveClothingType(item as DBClothingRow);
          return {
            ...(item as DBClothingRow),
            normalizedType,
            rawType: (item.type ?? null) as string | null,
            rawCategory: (item.category ?? null) as string | null,
          } as DBClothingRow & { normalizedType: ClothingType | null; rawType: string | null; rawCategory: string | null };
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('Re-fetched items after backfill:', normalizedWardrobeItems.map(item => ({
            id: item.id,
            name: item.name,
            rawType: item.rawType,
            normalizedType: item.normalizedType
          })));
        }
        pushEvent('wardrobe:autoFixTypes:refetched');
      }
    } catch (updateError) {
      logger.error('Failed to backfill missing clothing item types', { error: updateError });
      diagnostics.warnings.push('Auto-fix for missing clothing types failed.');
    }
  }

  const hasTop = normalizedWardrobeItems.some(item => item.normalizedType === 'Top' || item.normalizedType === 'Outerwear');
  const hasBottom = normalizedWardrobeItems.some(item => item.normalizedType === 'Bottom');
  const hasFootwear = normalizedWardrobeItems.some(item => item.normalizedType === 'Footwear');

  if (process.env.NODE_ENV === 'development') {
    console.log('Category check:', { hasTop, hasBottom, hasFootwear });
  }

  const missingCategories: string[] = [];
  if (!hasTop) missingCategories.push('Top or Outerwear');
  if (!hasBottom) missingCategories.push('Bottom');
  if (!hasFootwear) missingCategories.push('Footwear');

  if (missingCategories.length > 0) {
    pushEvent('wardrobe:missingCategories', { missingCategories, wardrobeCount: normalizedWardrobeItems.length });
    const detectedTypes = describeDetectedTypes(normalizedWardrobeItems);
    const wardrobeCount = normalizedWardrobeItems.length;
    const missingItemsMessageParts = [
      `To get a recommendation, add at least one item in each missing category: ${missingCategories.join(', ')}.`,
      `We found ${wardrobeCount} total items in your wardrobe.`,
    ];

    if (detectedTypes.length > 0) {
      missingItemsMessageParts.push(`Detected wardrobe entries: ${detectedTypes.join(', ')}.`);
    }

    if (itemsNeedingBackfill.length > 0) {
      missingItemsMessageParts.push('We tried to auto-fix missing item types. If the issue persists, edit those items in your wardrobe.');
    } else {
      missingItemsMessageParts.push('Make sure each clothing item has an accurate type (Top, Bottom, Footwear, etc.).');
    }

    const error: InsufficientItemsError = new Error('INSUFFICIENT_ITEMS');
    error.customMessage = missingItemsMessageParts.join(' ');
    throw error;
  }
  // Fetch weather data
  const weatherUrl = new URL('/api/weather', request.url);
  weatherUrl.searchParams.set('lat', lat.toString());
  weatherUrl.searchParams.set('lon', lon.toString());

  const weatherResponse = await fetch(weatherUrl.toString(), {
    headers: request.headers,
  });

  if (!weatherResponse.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const weatherData = await weatherResponse.json();
  const weather: WeatherData = weatherData.data.weather;
  const alerts = weatherData.data.alerts;

  // Detect current season based on date and latitude
  const currentSeason = getCurrentSeason(new Date(), lat);
  const seasonDescription = getSeasonDescription(currentSeason, new Date().getMonth());

  // Add season context to weather data for AI recommendations
  const weatherWithSeason = {
    ...weather,
    season: currentSeason,
    season_description: seasonDescription,
  };

  pushEvent('weather:fetched', {
    provider: 'openWeather',
    alerts: alerts?.length ?? 0,
    feelsLike: weather.feels_like,
    season: currentSeason,
    seasonDescription,
  });

  // Fetch user preferences
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single();

  // Convert preference scores to arrays of items with positive scores
  const userPreferences: Record<string, string[]> = {
    colors: [],
    styles: [],
    materials: [],
  };

  if (profile?.preferences) {
    const prefs = profile.preferences as Record<string, Record<string, number>>;

    if (prefs.colors) {
      userPreferences.colors = Object.entries(prefs.colors)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([color]) => color);
    }

    if (prefs.styles) {
      userPreferences.styles = Object.entries(prefs.styles)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([style]) => style);
    }

    if (prefs.materials) {
      userPreferences.materials = Object.entries(prefs.materials)
        .filter(([_, score]) => score > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([material]) => material);
    }
  }

  // Prepare wardrobe payload for recommendation engine
  let availableItems = normalizedWardrobeItems.map(item => {
    const resolvedType = (item.normalizedType ?? normalizeTypeValue(item.rawType) ?? 'Top') as ClothingType;
    return {
      ...(item as IClothingItem),
      type: resolvedType,
      material: (item.material ?? null) as string | null,
      insulation_value: resolveInsulationValue({ ...item, type: resolvedType }),
    };
  }) as IClothingItem[];

  // Apply Freshness Rule: Filter out recently worn items
  // This prevents outfit repetition unless the item is a Favorite or Locked
  const freshItems = filterByLastWorn(availableItems);

  // Re-inject Locked Items if they were filtered out by the freshness rule
  // "Locks override logic" - User Requirement
  if (lockedItems && lockedItems.length > 0) {
    const lockedIds = new Set(lockedItems);
    const lockedButFiltered = availableItems.filter(item =>
      lockedIds.has(String(item.id)) && !freshItems.some(fresh => fresh.id === item.id)
    );
    // Add locked items back
    freshItems.push(...lockedButFiltered);
  }

  // SAFETY NET: Ensure we haven't filtered out ALL items of a core category
  // If we have, add them back (ignoring freshness) so the AI at least has options
  const coreTypes: ClothingType[] = ['Top', 'Bottom', 'Footwear'];

  for (const type of coreTypes) {
    const hasType = freshItems.some(i => i.type === type || (type === 'Top' && i.type === 'Outerwear'));

    if (!hasType) {
      // Find items of this type from the original available list
      const backfill = availableItems.filter(i => i.type === type || (type === 'Top' && i.type === 'Outerwear'));

      if (backfill.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`⚠️ Freshness rule depleted all ${type}s. Backfilling ${backfill.length} items.`);
        }
        // Add them back to freshItems
        // We use a Set to avoid duplicates if we already added some via lockedItems
        const currentIds = new Set(freshItems.map(i => i.id));
        const uniqueBackfill = backfill.filter(i => !currentIds.has(i.id));
        freshItems.push(...uniqueBackfill);
      }
    }
  }

  // Final assignment
  availableItems = freshItems;

  // Generate the recommendation
  const filterCounts = summary.filterCounts ?? {};
  summary.filterCounts = filterCounts;

  // Calculate Target Insulation Score (The "Comfort Formula")
  // Formula: (Baseline 24°C - CurrentTemp) / 2.5 step
  // 24°C = Level 0-1. Every 2.5°C drop adds 1 point.
  const targetInsulation = Math.max(1, Math.ceil((27 - weatherWithSeason.feels_like) / 2.5));

  // Use the new AI-powered recommendation engine
  const weatherContextString = `
    Condition: ${weatherWithSeason.weather_condition}
    Temperature: ${weatherWithSeason.temperature}°C (Feels like ${weatherWithSeason.feels_like}°C)
    Target Insulation Score: ~${targetInsulation} (Calculated based on 24°C baseline)
    Humidity: ${weatherWithSeason.humidity}%
    Wind: ${weatherWithSeason.wind_speed} km/h
    Season: ${weatherWithSeason.season} (${weatherWithSeason.season_description})
  `.trim();

  const aiRecommendation = await generateAIOutfitRecommendation(
    availableItems,
    {
      weather: weatherContextString,
      occasion: occasion || 'General Day-to-Day',
      season: weatherWithSeason.season || 'Unknown',
      userPreferences: {
        styles: userPreferences.styles,
        colors: userPreferences.colors,
      },
      lockedItems: lockedItems,
    }
  );

  summary.selectedItemIds = aiRecommendation.outfit.map((i: IClothingItem) => i.id);
  pushEvent('selection:engineComplete', {
    itemIds: summary.selectedItemIds,
    confidence: aiRecommendation.validationScore / 100,
  });

  // Store recommendation in database for feedback tracking
  const { data: savedRecommendation, error: saveError } = await supabase
    .from('outfit_recommendations')
    .insert({
      user_id: userId,
      outfit_items: aiRecommendation.outfit.map((i: IClothingItem) => i.id),
      weather_data: weather,
      confidence_score: aiRecommendation.validationScore / 100,
      reasoning: aiRecommendation.reasoning?.weatherMatch || "AI Optimized",
      detailed_reasoning: JSON.stringify(aiRecommendation.reasoning), // Store full structured reasoning as JSON string
      missing_items: [],
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (saveError) {
    logger.error('Failed to save recommendation', { error: saveError });
  }

  // Transform recommendation data to match frontend expectations
  // Ensure clothing item image URLs are safe to use by the client (signed URLs for storage)
  const SIGNED_URL_TTL = 60 * 60; // 1 hour

  const outfitWithSignedUrls = await Promise.all(
    aiRecommendation.outfit.map(async (item) => {
      if (item.image_url) {
        try {
          const url = new URL(item.image_url);
          const pathSegments = url.pathname.split('/clothing_images/');

          if (pathSegments.length > 1 && pathSegments[1]) {
            const path = pathSegments[1];
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('clothing_images')
              .createSignedUrl(path, SIGNED_URL_TTL);

            if (!signedUrlError && signedUrlData?.signedUrl) {
              return { ...item, image_url: signedUrlData.signedUrl };
            }
          }
        } catch (e) {
          logger.error(`Error creating signed URL for recommendation item ${item.id}:`, { error: e });
          // fallthrough to return original item
        }
      }
      return item;
    })
  );

  // AI image generation feature removed - focusing on core outfit recommendation

  const transformedData: RecommendationApiPayload = {
    recommendation: {
      outfit: outfitWithSignedUrls,
      confidence_score: aiRecommendation.validationScore / 100,
      reasoning: aiRecommendation.reasoning?.weatherMatch || "AI Optimized",
      detailed_reasoning: JSON.stringify(aiRecommendation.reasoning), // Pass full structured reasoning
      missing_items: [],
      dress_code: 'Casual', // Default, could be enhanced from context
      weather_alerts: alerts || [],
      id: savedRecommendation?.id,
      outfit_visual_urls: [],
    },
    weather: weather,
    alerts: alerts || [],
  };

  pushEvent('response:ready', {
    outfitVisualCount: 0,
  });

  return { payload: transformedData, diagnostics };
}

/**
 * GET /api/recommendation
 * Returns the most recent recommendation payload so refreshes do not auto-regenerate outfits.
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { data: recommendation, error: recError } = await supabase
    .from('outfit_recommendations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recError || !recommendation) {
    return NextResponse.json(
      { success: false, error: 'No recommendations found' },
      { status: 404 }
    );
  }

  const { data: items } = await supabase
    .from('clothing_items')
    .select('*')
    .in('id', recommendation.outfit_items);

  const SIGNED_URL_TTL = 60 * 60;
  const outfitWithSignedUrls = await Promise.all(
    (items || []).map(async (item) => {
      if (item.image_url) {
        try {
          const url = new URL(item.image_url);
          const pathSegments = url.pathname.split('/clothing_images/');
          if (pathSegments.length > 1 && pathSegments[1]) {
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('clothing_images')
              .createSignedUrl(pathSegments[1], SIGNED_URL_TTL);
            if (!signedUrlError && signedUrlData?.signedUrl) {
              return { ...item, image_url: signedUrlData.signedUrl };
            }
          }
        } catch (_err) {
          // Ignore parsing issues and fall back to raw URL
        }
      }
      return item;
    })
  );

  const payload: RecommendationApiPayload = {
    recommendation: {
      outfit: outfitWithSignedUrls as IClothingItem[],
      confidence_score: recommendation.confidence_score,
      reasoning: recommendation.reasoning,
      detailed_reasoning: recommendation.detailed_reasoning || null,
      missing_items: recommendation.missing_items || [],
      dress_code: 'Casual',
      weather_alerts: [],
      id: recommendation.id,
      outfit_visual_urls: [],
    },
    weather: recommendation.weather_data as WeatherData,
    alerts: [],
  };

  return NextResponse.json({
    success: true,
    data: payload,
  });
}
