import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { IClothingItem, OutfitValidation } from '@/lib/types';
import { UserPreferences } from '@/types/retro';
import { config } from '@/lib/config';

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
 * AI-Powered Outfit Analyzer using Gemini 2.5 Flash
 * 
 * This system:
 * 1. Analyzes clothing descriptions to understand style, material, and suitability
 * 2. Selects outfit combinations based on context
 * 3. Validates outfit by analyzing actual images
 * 4. Replaces items if something doesn't fit
 * 5. Re-validates until satisfied
 */

// Initialize Gemini API
const getGeminiClient = () => {
  if (!config.ai.gemini.apiKey) {
    throw new Error('Gemini API key not configured');
  }
  return new GoogleGenerativeAI(config.ai.gemini.apiKey);
};

const getTextModel = (() => {
  let cachedModel: GenerativeModel | null = null;
  return () => {
    if (!cachedModel) {
      cachedModel = getGeminiClient().getGenerativeModel({ model: config.ai.gemini.model });
    }
    return cachedModel;
  };
})();

/**
 * Analyze a clothing item image to extract metadata
 * Used during onboarding to auto-populate item properties
 * 
 * Includes retry logic with exponential backoff for reliability
 */

const AI_ANALYSIS_MAX_RETRIES = 2;
const AI_ANALYSIS_TIMEOUT_MS = 30000; // 30 seconds
const AI_ANALYSIS_INITIAL_DELAY_MS = 1000;

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
}> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= AI_ANALYSIS_MAX_RETRIES; attempt++) {
    // Exponential backoff for retries
    if (attempt > 0) {
      const delay = AI_ANALYSIS_INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(`AI analysis retry ${attempt}/${AI_ANALYSIS_MAX_RETRIES} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const requestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are an expert fashion archivist. Analyze the image of the clothing item and extract metadata into a strict JSON format.

Respond with only valid JSON (no markdown, no code blocks).

{
  "name": "A creative, short name for the item (e.g. 'Vintage Acid Wash Tee')",
  "category": "Top|Bottom|Shoes|Outerwear|Accessory|Dress (e.g. dress, gown, frock, sundress, maxi, mini, wrap, shift, sheath)",
  "material": "Cotton|Polyester|Wool|Silk|Leather|Denim|Linen|Synthetic|Gore-Tex|Other",
  "color": "Main color name or hex",
  "formality_insulation_value": 0-10 (0 for naked, 10 for arctic parka),
  "pattern": "Solid|Striped|Checkered|Graphic|Floral|etc",
  "fit": "Fitted|Regular|Relaxed|Oversized|Slim|Loose|One Size",
  "season_tags": ["Spring", "Summer", "Autumn", "Winter", "All Season"],
  "style_tags": ["casual", "formal", "sporty", "vintage", "modern", "bold", "minimalist", "streetwear", "gorpcore", "y2k"],
  "description": "Short description of the item"
}`,
              },
              {
                inlineData: {
                  mimeType,
                  data: base64ImageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          topP: 0.9,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json',
        },
      };

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_ANALYSIS_TIMEOUT_MS);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.ai.gemini.model}:generateContent?key=${config.ai.gemini.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gemini API error: ${response.status} - ${errorData?.error?.message}`);
      }

      const data = await response.json();

      if (
        !data.candidates ||
        !data.candidates[0] ||
        !data.candidates[0].content ||
        !data.candidates[0].content.parts
      ) {
        throw new Error('Invalid response from Gemini API');
      }

      const textPart = data.candidates[0].content.parts[0];
      const text = textPart.text as string;

      // Clean up markdown if present (though we asked for none)
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

      const analysis = JSON.parse(cleanText);

      // Success! Return the parsed result
      return {
        detectedType: normalizeCategoryLabel(analysis.category),
        detectedColor: analysis.color || '#000000',
        detectedMaterial: normalizeMaterialLabel(analysis.material),
        detectedStyleTags: analysis.style_tags || [],
        detectedPattern: analysis.pattern,
        detectedFit: analysis.fit,
        detectedSeason: analysis.season_tags,
        detectedInsulation: analysis.formality_insulation_value,
        detectedDescription: analysis.description,
        detectedName: analysis.name,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (timeout)
      if (lastError.name === 'AbortError') {
        lastError = new Error('AI analysis timed out after 30 seconds');
        break;
      }

      console.warn(`AI analysis attempt ${attempt + 1} failed:`, lastError.message);
      // Continue to next retry
    }
  }

  // All retries exhausted - throw error so caller can handle
  console.error('AI analysis failed after all retries:', lastError?.message);
  throw lastError || new Error('AI analysis failed after retries');
}

/**
 * Generate AI-powered outfit recommendation using the "Fire Fit" logic
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
    historyCheck?: string;
    styleScore?: number;
    totalInsulation?: number;
    layeringStrategy?: string;
    occasionFit?: string;
  };
}> {
  const model = getTextModel();
  const log: string[] = [];

  log.push('🤖 Starting AI outfit recommendation (Fire Fit Engine)...');

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
      Your mission: Generate a "FIRE FIT" - an outfit so good it turns heads and gets compliments.

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
      
      Return a strictly structured JSON object.
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

      Respond with JSON:
      {
        "selectedItemIds": ["id1", "id2", ...],
        "reasoning": {
          "weatherMatch": "brief explanation",
          "colorAnalysis": "what colors work together and why",
          "silhouetteBalance": "how the fits complement each other",
          "styleScore": INTEGER from 1-10 (NOT a decimal like 0.9),
          "layeringStrategy": "layering approach",
          "occasionFit": "why this works for the occasion",
          "statementPiece": "which item is the hero piece"
        }
      }
  `;

  log.push('🎨 Generating outfit with Gemini 2.5 Flash...');

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: systemInstruction + "\n\n" + prompt }] }],
      generationConfig: {
        temperature: 1.2, // Higher creativity for fashion
        topK: 40,
        responseMimeType: 'application/json',
      }
    });

    const responseText = result.response.text();
    const aiResponse = JSON.parse(responseText);

    if (!aiResponse.selectedItemIds || !Array.isArray(aiResponse.selectedItemIds)) {
      throw new Error('Invalid AI response format');
    }

    const selectedItems = wardrobeItems.filter(item =>
      aiResponse.selectedItemIds.includes(String(item.id))
    );

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
      log.push("⚠️ AI returned incomplete outfit (missing top or bottom)");
    }

    const normalizedScore = normalizeStyleScore(aiResponse.reasoning?.styleScore);
    log.push(`✨ Generated outfit with score ${normalizedScore}%`);
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

export async function validateOutfitImages(items: IClothingItem[]): Promise<OutfitValidation> {
  const missingImageItems = items.filter(item => !item.image_url);
  const issues = missingImageItems.map(item => `Missing image for ${item.name || item.id}`);
  const suggestions = missingImageItems.length
    ? ['Upload clear photos for the highlighted items.']
    : ['All outfit items include imagery.'];

  return {
    isValid: issues.length === 0,
    score: missingImageItems.length ? 65 : 100,
    issues,
    suggestions,
    problemItemId: missingImageItems[0]?.id,
  };
}
