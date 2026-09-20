import { z } from 'zod';
import { IClothingItem, RecommendationDiagnostics, WeatherData } from '@/lib/types';
import { invokeStylistAgent } from '@/lib/ai/router';
import { resolveEnvironmentalContext, ThermalComfortProfile } from '@/lib/helpers/weather';

export interface StylistEngineInput {
  userId: string;
  wardrobe: IClothingItem[];
  occasion?: string;
  vibe?: string;
  lat?: number | null;
  lon?: number | null;
  userContext?: string;
  lockedItemIds?: string[];
  userPreferences?: {
    styles?: string[];
    colors?: string[];
    temperature_sensitivity?: number;
  };
}

export interface StylistEngineResult {
  outfit: IClothingItem[];
  confidenceScore: number;
  reasoning: {
    anchorPiece: string;
    silhouetteHarmony: string;
    colorTheory: string;
    weatherAdaptation: string;
    styleScore: number;
    editorialNote: string;
  };
  diagnostics: RecommendationDiagnostics;
  thermalProfile: ThermalComfortProfile;
  weather?: WeatherData | null;
}

const outfitResponseSchema = {
  type: 'object',
  properties: {
    selectedItemIds: {
      type: 'array',
      items: { type: 'string' },
      description: 'The IDs of the items chosen for the outfit',
    },
    reasoning: {
      type: 'object',
      properties: {
        anchorPiece: { type: 'string', description: 'The hero anchor piece this outfit is built around' },
        silhouetteHarmony: { type: 'string', description: 'How top and bottom proportions balance (e.g. Rule of Thirds, volume contrast)' },
        colorTheory: { type: 'string', description: 'Color harmony rationale (Sandwich rule, 3-color rule, or column of color)' },
        weatherAdaptation: { type: 'string', description: 'How warmth and rain protection match the climate' },
        styleScore: { type: 'integer', description: 'Style cohesion score 1 to 10', minimum: 1, maximum: 10 },
        editorialNote: { type: 'string', description: 'Punchy GQ/Vogue style editorial advice for wearing this look' },
      },
      required: ['anchorPiece', 'silhouetteHarmony', 'colorTheory', 'weatherAdaptation', 'styleScore', 'editorialNote'],
    },
  },
  required: ['selectedItemIds', 'reasoning'],
};

const outfitResponseZod = z.object({
  selectedItemIds: z.array(z.union([z.string(), z.number()])).min(1),
  reasoning: z.object({
    anchorPiece: z.string().default('Hero Item'),
    silhouetteHarmony: z.string().default('Balanced proportions'),
    colorTheory: z.string().default('Harmonized palette'),
    weatherAdaptation: z.string().default('Matched to climate'),
    styleScore: z.number().min(1).max(10).default(8),
    editorialNote: z.string().default('A sharp, cohesive look for the day.'),
  }),
});

/**
 * Normalize clothing category into primary slot
 */
export function normalizeClothingCategory(item: Partial<IClothingItem>): 'Top' | 'Bottom' | 'Footwear' | 'Outerwear' | 'Accessory' | 'Dress' {
  const typeStr = (item.type || item.category || '').toLowerCase();
  if (typeStr.includes('dress') || typeStr.includes('jumpsuit') || typeStr.includes('romper')) return 'Dress';
  if (typeStr.includes('shoe') || typeStr.includes('foot') || typeStr.includes('boot') || typeStr.includes('sneaker') || typeStr.includes('loafer') || typeStr.includes('sandal')) return 'Footwear';
  if (typeStr.includes('outer') || typeStr.includes('jacket') || typeStr.includes('coat') || typeStr.includes('blazer') || typeStr.includes('cardigan') || typeStr.includes('parka') || typeStr.includes('hoodie')) return 'Outerwear';
  if (typeStr.includes('bottom') || typeStr.includes('pant') || typeStr.includes('jean') || typeStr.includes('trouser') || typeStr.includes('short') || typeStr.includes('skirt')) return 'Bottom';
  if (typeStr.includes('hat') || typeStr.includes('cap') || typeStr.includes('beanie') || typeStr.includes('belt') || typeStr.includes('scarf') || typeStr.includes('bag') || typeStr.includes('accessory')) return 'Accessory';
  return 'Top';
}

/**
 * Filter items by freshness (avoid items worn very recently unless locked)
 */
function applyFreshnessFilter<T extends IClothingItem>(items: T[], lockedIds: Set<string>): T[] {
  const now = new Date();
  return items.filter((item) => {
    if (lockedIds.has(String(item.id))) return true;
    if (!item.last_worn) return true;
    const lastDate = new Date(item.last_worn);
    const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 2; // Allow wearing after 2 days
  });
}

/**
 * The Anchor-and-Orbit Recommendation Engine
 */
export async function generateAnchorAndOrbitRecommendation(
  input: StylistEngineInput
): Promise<StylistEngineResult> {
  const diagnostics: RecommendationDiagnostics = {
    requestId: `rec_${Date.now()}`,
    warnings: [],
    events: [],
    summary: {
      wardrobeCount: input.wardrobe.length,
      selectedItemIds: [],
    },
  };

  const pushEvent = (stage: string, meta?: Record<string, unknown>) => {
    diagnostics.events.push({ stage, timestamp: new Date().toISOString(), meta });
  };

  if (!input.wardrobe || input.wardrobe.length === 0) {
    throw new Error('EMPTY_WARDROBE');
  }

  // 1. Resolve Environmental & Thermal Context
  const { weather, thermalProfile, seasonContext } = await resolveEnvironmentalContext({
    lat: input.lat,
    lon: input.lon,
    userContext: input.userContext,
  });

  pushEvent('context:resolved', {
    apparentTemp: thermalProfile.apparentTemperatureC,
    targetInsulation: thermalProfile.targetInsulationClo,
    rainDefense: thermalProfile.precipitationDefense,
  });

  const lockedSet = new Set((input.lockedItemIds || []).map(String));

  // 2. Normalize and Partition Wardrobe into Categorical Slots
  const normalizedWardrobe = input.wardrobe.map((item) => ({
    ...item,
    slot: normalizeClothingCategory(item),
  }));

  const freshWardrobe = applyFreshnessFilter(normalizedWardrobe, lockedSet);

  const slots = {
    tops: freshWardrobe.filter((i) => i.slot === 'Top'),
    bottoms: freshWardrobe.filter((i) => i.slot === 'Bottom'),
    footwear: freshWardrobe.filter((i) => i.slot === 'Footwear'),
    outerwear: freshWardrobe.filter((i) => i.slot === 'Outerwear'),
    dresses: freshWardrobe.filter((i) => i.slot === 'Dress'),
    accessories: freshWardrobe.filter((i) => i.slot === 'Accessory'),
  };

  // Backfill if freshness filtered out entire slot
  if (slots.tops.length === 0 && slots.dresses.length === 0) {
    slots.tops = normalizedWardrobe.filter((i) => i.slot === 'Top');
  }
  if (slots.bottoms.length === 0 && slots.dresses.length === 0) {
    slots.bottoms = normalizedWardrobe.filter((i) => i.slot === 'Bottom');
  }
  if (slots.footwear.length === 0) {
    slots.footwear = normalizedWardrobe.filter((i) => i.slot === 'Footwear');
  }

  const hasTopsOrDress = slots.tops.length > 0 || slots.dresses.length > 0;
  const hasBottomsOrDress = slots.bottoms.length > 0 || slots.dresses.length > 0;
  const hasShoes = slots.footwear.length > 0;

  if (!hasTopsOrDress || !hasBottomsOrDress || !hasShoes) {
    throw new Error('INSUFFICIENT_ITEMS');
  }

  // 3. Anchor Identification
  let anchorItem: (typeof normalizedWardrobe)[0] | undefined;
  if (lockedSet.size > 0) {
    anchorItem = normalizedWardrobe.find((i) => lockedSet.has(String(i.id)));
  }

  if (!anchorItem) {
    // Pick an anchor statement piece based on favorites or thermal priority
    const candidates = thermalProfile.targetInsulationClo >= 7 && slots.outerwear.length > 0
      ? slots.outerwear
      : slots.bottoms.length > 0
        ? slots.bottoms
        : slots.tops;

    // Prioritize favorites or items with higher insulation/character
    anchorItem = candidates.find((i) => i.favorite || (i as { is_favorite?: boolean }).is_favorite) || candidates[0];
  }

  pushEvent('anchor:identified', {
    anchorId: anchorItem?.id,
    anchorName: anchorItem?.name,
    anchorSlot: anchorItem?.slot,
  });

  // 4. Proportional Orbit Candidate Assembly
  // Instead of dumping 80 items, curate the top complementary items per slot
  const candidatePool = [
    ...(anchorItem ? [anchorItem] : []),
    ...slots.tops.slice(0, 6),
    ...slots.bottoms.slice(0, 6),
    ...slots.footwear.slice(0, 5),
    ...slots.outerwear.slice(0, 4),
    ...slots.dresses.slice(0, 3),
    ...slots.accessories.slice(0, 4),
  ];

  // Deduplicate pool
  const seenIds = new Set<string>();
  const uniqueCandidatePool = candidatePool.filter((item) => {
    const key = String(item.id);
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });

  const promptInventory = uniqueCandidatePool.map((item) => ({
    id: String(item.id),
    name: item.name,
    slot: item.slot,
    color: item.color || 'Unknown',
    material: item.material || 'Cotton',
    fit: item.fit || 'Regular',
    insulation: item.insulation_value ?? 5,
    is_anchor: anchorItem ? String(item.id) === String(anchorItem.id) : false,
    is_favorite: Boolean(item.favorite || (item as { is_favorite?: boolean }).is_favorite),
  }));

  // 5. Stylist Agent Prompt Formulation
  const systemInstruction = `You are SetMyFit's Creative Director & Personal Fashion Stylist.
Your goal is to build an aesthetically immaculate, highly wearable outfit that looks intentional and editorial.

### CORE FASHION PRINCIPLES TO ENFORCE:
1. THE ANCHOR RULE: The look must orbit naturally around the designated Anchor Item.
2. THE SANDWICH RULE: Balance top and bottom by harmonizing footwear color with the top or outer layer.
3. PROPORTIONAL SILHOUETTE:
   - Volume on bottom (wide/relaxed) requires structured or fitted on top (or clean tuck).
   - Volume on top (oversized) requires straight or tapered on bottom.
   - Never combine shapeless oversized top with shapeless oversized bottom unless strictly streetwear/gorpcore.
4. TEXTURE MIXING: Avoid uniform textures (e.g. mix matte cotton with denim, wool with leather, knit with smooth poplin).
5. THE 3-COLOR RULE: Limit distinct colors to 3 max. Neutrals (black, white, gray, beige, navy) provide the base.
6. THERMAL REALITY: Match the required warmth (target insulation: ${thermalProfile.targetInsulationClo}/10).
   ${thermalProfile.precipitationDefense ? 'CRITICAL: Rain/precipitation defense is active. Avoid raw canvas or delicate suede; prioritize protective layers.' : ''}

### MANDATORY COMPOSITION:
- Outfit MUST contain:
  * Option A: 1 Top + 1 Bottom + 1 Footwear (+ Optional Outerwear / Accessories)
  * Option B: 1 Dress + 1 Footwear (+ Optional Outerwear / Accessories)
- Any locked items (IDs: ${Array.from(lockedSet).join(', ') || 'None'}) MUST be included.`;

  const userPrompt = `EXECUTE OUTFIT STYLING RUN.

CLIMATE & SITUATION:
- Weather: ${thermalProfile.weatherSummary}
- Target Warmth: ${thermalProfile.targetInsulationClo}/10 (Recommended layers: ${thermalProfile.recommendedLayers})
- Season: ${seasonContext}
- Occasion: ${input.occasion || 'Everyday Casual'}
- Aesthetic Vibe: ${input.vibe || 'Clean & Minimalist'}
- Anchor Item: ${anchorItem ? `"${anchorItem.name}" (ID: ${anchorItem.id}, Slot: ${anchorItem.slot})` : 'Stylist choice'}

CANDIDATE CLOSET POOL:
${JSON.stringify(promptInventory, null, 2)}

Select the optimal outfit item IDs and provide editorial fashion rationale.`;

  // 6. Execute Stylist Agent (Gemini 3.5 Flash-Lite)
  const result = await invokeStylistAgent<z.infer<typeof outfitResponseZod>>(
    [{ text: userPrompt }],
    {
      systemInstruction,
      temperature: 0.5,
      responseJsonSchema: outfitResponseSchema,
      zodSchema: outfitResponseZod,
    }
  );

  const selectedIdSet = new Set(result.selectedItemIds.map(String));

  // Ensure locked items are in the set
  lockedSet.forEach((id) => selectedIdSet.add(id));

  const chosenOutfit = normalizedWardrobe.filter((item) => selectedIdSet.has(String(item.id)));

  // Fallback safety net: verify minimum structural slots
  const hasChosenTopOrDress = chosenOutfit.some((i) => i.slot === 'Top' || i.slot === 'Dress');
  const hasChosenBottomOrDress = chosenOutfit.some((i) => i.slot === 'Bottom' || i.slot === 'Dress');
  const hasChosenShoes = chosenOutfit.some((i) => i.slot === 'Footwear');

  if (!hasChosenTopOrDress && slots.tops.length > 0) {
    chosenOutfit.push(slots.tops[0]);
  }
  if (!hasChosenBottomOrDress && slots.bottoms.length > 0) {
    chosenOutfit.push(slots.bottoms[0]);
  }
  if (!hasChosenShoes && slots.footwear.length > 0) {
    chosenOutfit.push(slots.footwear[0]);
  }

  diagnostics.summary = {
    ...diagnostics.summary,
    selectedItemIds: chosenOutfit.map((i) => i.id),
  };

  pushEvent('styling:completed', {
    selectedCount: chosenOutfit.length,
    score: result.reasoning.styleScore,
  });

  return {
    outfit: chosenOutfit,
    confidenceScore: result.reasoning.styleScore / 10,
    reasoning: result.reasoning,
    diagnostics,
    thermalProfile,
    weather,
  };
}
