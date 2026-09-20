import { GoogleGenAI, type Schema } from '@google/genai';
import { z } from 'zod';
import { IClothingItem, OutfitValidation } from '@/lib/types';
import { UserPreferences } from '@/types/retro';
import { config } from '@/lib/config';
import { withGeminiRetry } from '@/lib/rateLimiter';
import { parseDataUrl } from '@/lib/utils';

/**
 * Normalize AI style score to 0-100 scale
 * Handles cases where AI returns decimal (0.9) vs integer (9)
 */
function normalizeStyleScore(score: number | undefined): number {
  if (score === undefined || score === null) return 50; // Default to 50%

  // If score is between 0-1 (decimal), scale to 0-100
  if (score > 0 && score <= 1) {
    return Math.round(score * 100);
  }

  // If score is between 1-10, scale to 0-100
  if (score >= 1 && score <= 10) {
    return Math.round(score * 10);
  }

  // Already 0-100 scale or out of range - clamp it
  return Math.max(0, Math.min(100, Math.round(score)));
}

const toTitleCase = (value?: string) => {
  if (!value) return undefined;
  return value
    .split(/[\s|_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeCategoryLabel = (category?: string) => {
  if (!category) return 'Accessory';
  const primary = category.split('|')[0];
  return toTitleCase(primary) || 'Accessory';
};
const normalizeMaterialLabel = (material?: string) => toTitleCase(material) || 'Other';

/**
 * AI-Powered Outfit Analyzer (modernized)
 *
 * - Uses the current `@google/genai` SDK (the legacy `@google/generative-ai`
 *   package is deprecated)
 * - All JSON responses use enforced response schemas + zod validation, so
 *   malformed model output retries instead of crashing the request
 * - Transient failures (429/5xx/timeouts) retry with exponential backoff
 */

import { serverEnv } from '@/lib/serverEnv';

// Initialize Gemini API (cached client)
let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

const getClient = async () => {
  const apiKey =
    (await serverEnv('GEMINI_API_KEY')) ||
    config.ai.gemini.apiKey ||
    process.env.GEMINI_API_KEY ||
    '';
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
};

const MODEL = () => config.ai.gemini.model;

// ---------------------------------------------------------------------------
// Schemas (JSON Schema for the API + zod for runtime validation)
// ---------------------------------------------------------------------------

const clothingJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Creative, fashionable, highly specific name (e.g. Acid-Wash Drop-Shoulder Boxy Tee, Pleated Wide-Leg Wool Trousers)' },
    category: { type: 'string', description: 'One of: Top, Bottom, Shoes, Outerwear, Accessory, Dress' },
    material: { type: 'string', description: 'One of: Cotton, Polyester, Wool, Silk, Leather, Denim, Linen, Synthetic, Gore-Tex, Other' },
    color: { type: 'string', description: 'Main color name (e.g. Washed Charcoal, Olive Drab, Bone White)' },
    dominant_color_hex: { type: 'string', description: 'Main dominant color hex code e.g. #2C3E50' },
    silhouette: { type: 'string', description: 'One of: Fitted, Regular, Boxy, Oversized, Cropped, Wide-Leg, Straight, Tapered, Other' },
    formality_score: { type: 'integer', description: 'Formality 1-5 (1=Lounge/Gym, 2=Everyday Casual, 3=Smart Casual, 4=Business Formal, 5=Black Tie)', minimum: 1, maximum: 5 },
    insulation_value: { type: 'integer', description: 'Warmth 0-10 (0 sheer/naked, 5 regular cotton, 10 arctic parka)', minimum: 0, maximum: 10 },
    pattern: { type: 'string', description: 'e.g. Solid, Striped, Checkered, Graphic, Floral, Plaid, Camo, Textured' },
    fit: { type: 'string', description: 'e.g. Fitted, Regular, Relaxed, Oversized, Slim, Loose, Boxy, One Size' },
    texture: { type: 'string', description: 'Surface finish: e.g. Smooth, Chunky Knit, Woven, Distressed, Matte, Glossy, Fleece' },
    season_tags: { type: 'array', items: { type: 'string' }, description: 'Spring, Summer, Autumn, Winter' },
    aesthetic_cores: { type: 'array', items: { type: 'string' }, description: 'e.g. Streetwear, Vintage, Minimalist, Gorpcore, Old Money, Cyberpunk, 90s Grunge' },
    style_tags: { type: 'array', items: { type: 'string' } },
    description: { type: 'string', description: 'Short editorial description of the garment' },
  },
  required: ['name', 'category', 'material', 'color'],
};

const clothingAnalysisZod = z.object({
  name: z.string().default('New Item'),
  category: z.string().default('Accessory'),
  material: z.string().default('Other'),
  color: z.string().default('#000000'),
  dominant_color_hex: z.string().optional(),
  silhouette: z.string().default('Regular'),
  formality_score: z.number().min(1).max(5).default(2),
  insulation_value: z.number().min(0).max(10).default(5),
  pattern: z.string().optional(),
  fit: z.string().optional(),
  texture: z.string().optional(),
  season_tags: z.array(z.string()).default([]),
  aesthetic_cores: z.array(z.string()).default([]),
  style_tags: z.array(z.string()).default([]),
  description: z.string().optional(),
});

const outfitJsonSchema = {
  type: 'object',
  properties: {
    selectedItemIds: { type: 'array', items: { type: 'string' }, description: 'IDs from INVENTORY' },
    reasoning: {
      type: 'object',
      properties: {
        weatherMatch: { type: 'string' },
        colorAnalysis: { type: 'string' },
        silhouetteBalance: { type: 'string' },
        styleScore: { type: 'integer', description: 'INTEGER 1-10, never a decimal', minimum: 1, maximum: 10 },
        layeringStrategy: { type: 'string' },
        occasionFit: { type: 'string' },
        statementPiece: { type: 'string' },
      },
      required: ['weatherMatch', 'colorAnalysis', 'silhouetteBalance', 'styleScore', 'layeringStrategy', 'occasionFit', 'statementPiece'],
    },
  },
  required: ['selectedItemIds', 'reasoning'],
};

const outfitRecommendationZod = z.object({
  selectedItemIds: z.array(z.union([z.string(), z.number()])).min(1),
  reasoning: z.object({
    weatherMatch: z.string().default('AI Optimized'),
    colorAnalysis: z.string().default(''),
    silhouetteBalance: z.string().default(''),
    styleScore: z.number().min(1).max(10).default(7),
    layeringStrategy: z.string().default(''),
    occasionFit: z.string().default(''),
    statementPiece: z.string().default(''),
  }),
});

const validationJsonSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', description: 'Overall cohesion 1-100', minimum: 1, maximum: 100 },
    issues: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
    problemItemName: { type: 'string', description: 'Exact name of the worst item, or empty string if none' },
  },
  required: ['score', 'issues', 'suggestions'],
};

const outfitValidationZod = z.object({
  score: z.number().min(1).max(100),
  issues: z.array(z.string()).default([]),
  suggestions: z.array(z.string()).default([]),
  problemItemName: z.string().default(''),
});

import { invokeMicroAgent } from '@/lib/ai/router';

/**
 * Analyze a clothing item image to extract metadata using Gemma 4 micro-agent
 * (with automatic fallback to Gemini 3.5 Flash-Lite).
 */
export async function analyzeClothingImage(
  base64ImageData: string,
  mimeType: string = 'image/jpeg'
): Promise<{
  detectedType: string;
  detectedColor: string;
  detectedMaterial: string;
  detectedStyleTags: string[];
  detectedPattern?: string;
  detectedFit?: string;
  detectedSeason?: string[];
  detectedInsulation?: number;
  detectedDescription?: string;
  detectedName?: string;
  detectedSilhouette?: string;
  detectedFormality?: number;
  detectedColorHex?: string;
  detectedTexture?: string;
  detectedAestheticCores?: string[];
}> {
  const analysis = await invokeMicroAgent<z.infer<typeof clothingAnalysisZod>>(
    [
      {
        text: `You are an expert fashion archivist and creative garment cataloger. Analyze this clothing image and extract rich metadata.

Rules:
- "name": creative, authentic, highly specific garment name (e.g. 'Acid-Wash Drop-Shoulder Boxy Tee', 'Pleated Wide-Leg Wool Trousers', 'Vintage Distressed Leather Moto Jacket'). Avoid generic labels like 'T-shirt' or 'Pants'.
- "category": exactly one of Top, Bottom, Shoes, Outerwear, Accessory, Dress.
- "material": exactly one of Cotton, Polyester, Wool, Silk, Leather, Denim, Linen, Synthetic, Gore-Tex, Other.
- "color": descriptive color name (e.g. Washed Charcoal, Olive Drab, Bone White).
- "dominant_color_hex": hex code of dominant shade (e.g. #2C3E50).
- "silhouette": exactly one of Fitted, Regular, Boxy, Oversized, Cropped, Wide-Leg, Straight, Tapered, Other.
- "formality_score": 1-5 (1=Lounge/Gym, 2=Everyday Casual, 3=Smart Casual, 4=Business, 5=Black Tie).
- "insulation_value": warmth 0-10 (0 sheer/summer, 5 medium cotton, 10 heavy winter parka).
- "texture": surface finish e.g. Smooth, Chunky Knit, Woven, Distressed, Matte, Glossy, Fleece.
- "season_tags": Spring, Summer, Autumn, Winter (include all 4 if all-season staple).
- "aesthetic_cores": relevant aesthetics e.g. Streetwear, Vintage, Minimalist, Gorpcore, Old Money, Cyberpunk, 90s Grunge.
- "style_tags": lowercase vibes like casual, relaxed, tailored, cozy, edgy, structured.`,
      },
      { inlineData: { mimeType, data: base64ImageData } },
    ],
    {
      systemInstruction: 'You are a master fashion cataloger powered by Gemma 4. Output strictly valid JSON matching the schema.',
      temperature: 0.3,
      responseJsonSchema: clothingJsonSchema,
      zodSchema: clothingAnalysisZod,
    }
  );

  return {
    detectedType: normalizeCategoryLabel(analysis.category),
    detectedColor: analysis.color || '#000000',
    detectedMaterial: normalizeMaterialLabel(analysis.material),
    detectedStyleTags: Array.from(new Set([...analysis.style_tags, ...analysis.aesthetic_cores])),
    detectedPattern: analysis.pattern,
    detectedFit: analysis.fit || analysis.silhouette,
    detectedSeason: analysis.season_tags,
    detectedInsulation: analysis.insulation_value,
    detectedDescription: analysis.description,
    detectedName: analysis.name,
    detectedSilhouette: analysis.silhouette,
    detectedFormality: analysis.formality_score,
    detectedColorHex: analysis.dominant_color_hex,
    detectedTexture: analysis.texture,
    detectedAestheticCores: analysis.aesthetic_cores,
  };
}

/**
 * Generate AI-powered outfit recommendation
 */
export async function generateAIOutfitRecommendation(
  wardrobeItems: IClothingItem[],
  context: {
    weather: string;
    occasion: string;
    season: string;
    userPreferences?: UserPreferences;
    lockedItems?: string[];
  }
): Promise<{
  outfit: IClothingItem[];
  validationScore: number;
  iterations: number;
  analysisLog: string[];
  reasoning?: {
    weatherMatch?: string;
    colorAnalysis?: string;
    silhouetteBalance?: string;
    styleScore?: number;
    layeringStrategy?: string;
    occasionFit?: string;
    statementPiece?: string;
  };
}> {
  const log: string[] = [];

  log.push('🤖 Starting AI outfit recommendation (Style Engine)...');

  const defaultPreferences: UserPreferences = {
    gender: 'NEUTRAL',
    preferred_silhouette: 'neutral',
    preferred_styles: ['Streetwear', 'Vintage'],
    preferred_color_palette: 'Neutral',
    theme: 'RETRO'
  };

  const userPreferences = context.userPreferences || defaultPreferences;
  const lockedItems = context.lockedItems || [];

  // Prepare Wardrobe Context (Lightweight to save tokens)
  // Removed insulation - focusing on style/aesthetics instead
  const wardrobeContext = wardrobeItems.map(item => ({
    id: item.id,
    name: item.name,
    category: item.type, // Mapping type to category
    color: item.color,
    style_tags: item.style_tags,
    material: item.material,
    fit: item.fit || 'Regular',
    is_favorite: Boolean(item.favorite)
  }));

  const systemInstruction = `
      You are "SetMyFit", a legendary Fashion Stylist and Creative Director known for creating ICONIC looks.
      Your mission: Generate a stylish, head-turning outfit that gets compliments.

      ### YOUR STYLING PHILOSOPHY
      You prioritize AESTHETICS above all. Every outfit should look like it belongs in a fashion magazine.

      ### CORE FASHION ALGORITHMS TO APPLY
      1. **The Sandwich Rule:** Match the color of shoes with the top (or hat/layer). This creates visual harmony and intentionality.
      2. **Silhouette Theory:** Create visual interest through fit contrast:
         - Oversized Top → Slim/Regular Bottom (balanced proportions)
         - Fitted Top → Relaxed/Wide Bottom (intentional contrast)
         - Exception: Full oversized is valid for Streetwear/Gorpcore aesthetics
      3. **Texture Play:** Mix materials for depth - Denim + Cotton, Leather + Wool, Fleece + Nylon. Avoid same-material monotony.
      4. **Color Theory:** Use complementary colors, analogous palettes, or monochromatic with texture variation.
      5. **The 3-Color Rule:** Limit to 3 main colors max for cohesion. Neutrals (black/white/gray/beige) don't count.
      6. **Statement Piece:** Every great outfit has ONE standout item. Let it shine, keep everything else supporting.

      ### USER PREFERENCES
      - Aesthetic Vibes: ${(userPreferences.preferred_styles || []).join(', ')}.
      - Preferred Silhouette: ${userPreferences.preferred_silhouette}.
      - Gender Context: ${userPreferences.gender}.

      ### RULES
      - MUST include: 1 Top, 1 Bottom, 1 Footwear (minimum)
      - SHOULD include: Layering pieces and accessories for complete looks
      - For cold weather: Add outerwear/layers. Don't suggest bare t-shirts in winter.
      - LOCKED ITEMS (MANDATORY): ${JSON.stringify(lockedItems)} - These are ANCHORS. Build around them.
      - Prioritize 'is_favorite: true' items when they fit the aesthetic.

      ### SCORING GUIDE
      Rate the outfit's styleScore from 1-10 (INTEGER, not decimal):
      - 9-10: Editorial/runway-worthy, perfect harmony
      - 7-8: Very stylish, well-coordinated
      - 5-6: Good, wearable, nothing special
      - 3-4: Mismatched or boring
      - 1-2: Fashion disaster
  `;

  const prompt = `
      EXECUTE STYLING SEQUENCE.

      ENVIRONMENTAL DATA:
      - Context: ${context.weather}
      - Season: ${context.season}

      MISSION PROFILE (OCCASION):
      ${context.occasion}

      CONSTRAINTS:
      - Locked Items (MANDATORY ANCHORS): ${lockedItems.length > 0 ? lockedItems.join(', ') : "None"}

      INVENTORY:
      ${JSON.stringify(wardrobeContext)}
  `;

  log.push(`🎨 Generating outfit with ${MODEL()}...`);

  try {
    const aiResponse = await withGeminiRetry(async () => {
      const client = await getClient();
      const response = await client.models.generateContent({
        model: MODEL(),
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          systemInstruction,
          temperature: 1.0, // Creative for fashion; JSON schema keeps output valid
          topK: 40,
          responseMimeType: 'application/json',
          responseJsonSchema: outfitJsonSchema as unknown as Schema,
        },
      });
      const text = response.text?.trim() ?? '';
      if (!text) throw new Error('Empty response from Gemini API');
      const parsed = outfitRecommendationZod.parse(JSON.parse(text));
      if (parsed.selectedItemIds.length === 0) {
        throw new Error('AI returned an empty outfit');
      }
      return parsed;
    }, { maxRetries: 1 });

    const selectedIdSet = new Set(aiResponse.selectedItemIds.map(String));
    const selectedItems = wardrobeItems.filter(item => selectedIdSet.has(String(item.id)));

    if (selectedItems.length === 0) {
      throw new Error('AI selected items that are not in the wardrobe');
    }

    // --- LOCKING MECHANISM ENFORCEMENT ---
    // The AI treats locked items as anchors, but we must guarantee their presence.
    if (lockedItems && lockedItems.length > 0) {
      const lockedIdsSet = new Set(lockedItems);

      // 1. Identify missing locked items
      // Convert item.id to string for comparison since lockedItems are strings
      const missingLockedIds = lockedItems.filter(id => !selectedItems.some(item => String(item.id) === id));

      if (missingLockedIds.length > 0) {
        log.push(`🔒 Enforcing ${missingLockedIds.length} locked items that AI missed.`);

        for (const id of missingLockedIds) {
          // Convert item.id to string for comparison
          const itemToAdd = wardrobeItems.find(i => String(i.id) === id);
          if (itemToAdd) {
            // 2. Remove conflicting unlocked items of the same type to maintain outfit structure
            // We only replace if there's a conflict in the same category (e.g. swapping one Top for another)
            const conflictIndex = selectedItems.findIndex(i =>
              i.type === itemToAdd.type && !lockedIdsSet.has(String(i.id))
            );

            if (conflictIndex !== -1) {
              selectedItems.splice(conflictIndex, 1);
            }

            selectedItems.push(itemToAdd);
          }
        }
      }
    }
    // -------------------------------------

    // Basic validation
    const hasTop = selectedItems.some(i => ['top', 'shirt', 't-shirt', 'blouse', 'sweater', 'hoodie', 'outerwear'].includes(i.type.toLowerCase()));
    const hasBottom = selectedItems.some(i => ['bottom', 'pants', 'jeans', 'shorts', 'skirt'].includes(i.type.toLowerCase()));

    if (!hasTop || !hasBottom) {
      log.push("Incomplete outfit generated (missing top or bottom)");
    }

    const normalizedScore = normalizeStyleScore(aiResponse.reasoning?.styleScore);
    log.push(`Generated outfit with score ${normalizedScore}%`);
    log.push(`Items: ${selectedItems.map(i => i.name).join(', ')}`);

    return {
      outfit: selectedItems,
      validationScore: normalizedScore,
      iterations: 1,
      analysisLog: log,
      reasoning: aiResponse.reasoning
    };

  } catch (error) {
    console.error('AI Generation failed:', error);
    log.push(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

const MAX_VALIDATION_IMAGES = 6;
const MAX_VALIDATION_BYTES = 4 * 1024 * 1024;

/**
 * Agentic repair loop: validate the outfit with vision, swap the weakest
 * non-locked piece for the best same-type alternative, re-validate.
 * Keeps the best-scoring version seen (never ships a worse outfit than
 * it started with). Bounded by maxIterations vision calls.
 */
export interface RepairResult {
  outfit: IClothingItem[];
  score: number;
  iterations: number;
  issues: string[];
  suggestions: string[];
  analysisLog: string[];
}

const sameType = (a: Partial<IClothingItem>, b: Partial<IClothingItem>) =>
  String(a.type || '').toLowerCase() === String(b.type || '').toLowerCase();

export async function repairOutfitWithValidation(
  outfit: IClothingItem[],
  wardrobe: IClothingItem[],
  opts: {
    lockedIds?: Array<string | number>;
    maxIterations?: number;
    threshold?: number;
    log?: string[];
    validate?: (items: IClothingItem[]) => Promise<OutfitValidation>;
  } = {}
): Promise<RepairResult> {
  const {
    lockedIds = [],
    maxIterations = 2,
    threshold = 70,
    validate = validateOutfitImages,
  } = opts;
  const log = opts.log ?? [];
  const locked = new Set(lockedIds.map(String));

  const initial = await validate(outfit);
  let best = { items: [...outfit], validation: initial };
  let iterations = 0;
  const tried = new Set<string>();

  const imagedCount = outfit.filter((i) => i.image_url).length;
  if (imagedCount >= 2 && initial.score < threshold) {
    for (let n = 0; n < maxIterations; n++) {
      // Find the weakest NON-locked piece. A locked problem item cannot be
      // swapped, so there is nothing to repair — stop honestly.
      const problemId = best.validation.problemItemId;
      const problem = problemId !== undefined && problemId !== null
        ? best.items.find((i) => String(i.id) === String(problemId) && !locked.has(String(i.id)))
        : undefined;
      if (!problem) {
        log.push('🔧 Repair stopped: weakest piece is locked or unknown.');
        break;
      }

      // Best same-type alternative: favorites first, then least-worn.
      const candidates = wardrobe
        .filter(
          (w) =>
            sameType(w, problem) &&
            !best.items.some((i) => String(i.id) === String(w.id)) &&
            !locked.has(String(w.id)) &&
            !tried.has(String(w.id))
        )
        .sort((a, b) => {
          const favA = a.favorite ? 1 : 0;
          const favB = b.favorite ? 1 : 0;
          if (favA !== favB) return favB - favA;
          return (a.wear_count || 0) - (b.wear_count || 0);
        });
      const candidate = candidates[0];
      if (!candidate) {
        log.push(`🔧 Repair stopped: no alternative for ${problem.name}.`);
        break;
      }
      tried.add(String(candidate.id));

      const next = best.items.map((i) => (String(i.id) === String(problem.id) ? candidate : i));
      iterations += 1;
      const revalidation = await validate(next);
      if (revalidation.score > best.validation.score) {
        best = { items: next, validation: revalidation };
        log.push(`🔧 Swapped ${problem.name} → ${candidate.name} (score ${revalidation.score}%).`);
      } else {
        log.push(`🔧 Swap ${problem.name} → ${candidate.name} did not help (score ${revalidation.score}%). Kept previous.`);
      }
    }
  } else if (initial.score >= threshold) {
    log.push(`✅ Outfit passed vision check first try (score ${initial.score}%).`);
  }

  return {
    outfit: best.items,
    score: best.validation.score,
    iterations,
    issues: best.validation.issues,
    suggestions: best.validation.suggestions,
    analysisLog: log,
  };
}

/** Fetch an item image as inline bytes (data: URLs or http(s), size-capped). Shared by validation + visual generation. */
export async function fetchValidationImage(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    if (url.startsWith('data:')) {
      const { base64, mimeType } = parseDataUrl(url, 'image/jpeg');
      if (!base64) return null;
      return { mimeType, data: base64 };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > MAX_VALIDATION_BYTES) return null;
    const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    return {
      mimeType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
      data: buffer.toString('base64'),
    };
  } catch {
    return null;
  }
}

/**
 * Validate an outfit by actually looking at the item images with Gemini.
 * Scores color/silhouette/occasion cohesion 1-100 and names the weakest item.
 */
export async function validateOutfitImages(items: IClothingItem[]): Promise<OutfitValidation> {
  const missingImageItems = items.filter(item => !item.image_url);

  const candidates = items.filter(item => item.image_url).slice(0, MAX_VALIDATION_IMAGES);
  const fetched = await Promise.all(candidates.map(async (item) => ({
    item,
    image: item.image_url ? await fetchValidationImage(item.image_url) : null,
  })));
  const usable = fetched.filter((entry): entry is { item: IClothingItem; image: { mimeType: string; data: string } } =>
    entry.image !== null
  );

  // Not enough imagery for a real vision check — fall back to a presence check.
  if (usable.length < 2) {
    const issues = missingImageItems.map(item => `Missing image for ${item.name || item.id}`);
    const empty = items.length === 0;
    return {
      isValid: !empty && issues.length === 0,
      score: empty ? 0 : (missingImageItems.length ? 65 : 100),
      issues,
      suggestions: empty
        ? ['Add items to validate.']
        : missingImageItems.length
          ? ['Upload clear photos for the highlighted items.']
          : ['All outfit items include imagery.'],
      problemItemId: missingImageItems[0]?.id,
    };
  }

  const catalog = usable.map(({ item }) =>
    `- "${item.name}" (type: ${item.type}, color: ${item.color || 'unknown'}, fit: ${item.fit || 'regular'})`
  ).join('\n');

  const validation = await withGeminiRetry(async () => {
    const client = await getClient();
    const response = await client.models.generateContent({
      model: MODEL(),
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a blunt fashion critic. These ${usable.length} images are the items of ONE outfit, in order:

${catalog}

Score overall cohesion 1-100 (color harmony, silhouette balance, occasion coherence, texture mix).
List concrete issues and fix suggestions. Name the single weakest item using its EXACT name from the list, or "" when the outfit is flawless.`,
            },
            ...usable.map(({ image }) => ({
              inlineData: { mimeType: image.mimeType, data: image.data },
            })),
          ],
        },
      ],
      config: {
        temperature: 0.3,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseJsonSchema: validationJsonSchema as unknown as Schema,
      },
    });
    const text = response.text?.trim() ?? '';
    if (!text) throw new Error('Empty response from Gemini API');
    return outfitValidationZod.parse(JSON.parse(text));
  }, { maxRetries: 1 });

  const problemItem = validation.problemItemName
    ? usable.find(({ item }) => item.name.toLowerCase() === validation.problemItemName.toLowerCase())?.item
      ?? items.find(i => i.name.toLowerCase() === validation.problemItemName.toLowerCase())
    : undefined;

  return {
    isValid: validation.score >= 70 && validation.issues.length === 0,
    score: Math.max(1, Math.min(100, Math.round(validation.score))),
    issues: validation.issues,
    suggestions: validation.suggestions.length > 0
      ? validation.suggestions
      : ['Outfit looks cohesive.'],
    problemItemId: problemItem?.id ?? missingImageItems[0]?.id,
  };
}
