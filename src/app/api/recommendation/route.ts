import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbFirst, mapClothingItem, mapProfile, mapRecommendation, nowIso, toJson } from '@/lib/db';
import { IClothingItem, RecommendationApiPayload } from '@/lib/types';
import { generateAnchorAndOrbitRecommendation } from '@/lib/recommendation/engine';
import { logger } from '@/lib/logger';

/**
 * POST /api/recommendation
 * Unified modern styling recommendation endpoint using Anchor-and-Orbit architecture.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const {
      occasion = '',
      vibe = '',
      lockedItems = [],
      lat = null,
      lon = null,
      userContext = '',
    } = body as {
      occasion?: string;
      vibe?: string;
      lockedItems?: string[];
      lat?: number | null;
      lon?: number | null;
      userContext?: string;
    };

    // 1. Fetch user wardrobe
    const wardrobeRows = await dbAll(
      `SELECT id, name, type, category, color, material, insulation_value,
              last_worn, image_url, season_tags, style_tags, dress_code,
              created_at, pattern, fit, style, occasion, description,
              is_favorite, wear_count
       FROM clothing_items WHERE user_id = ?`,
      [user.uid]
    );

    const wardrobeItems = wardrobeRows.map(mapClothingItem) as unknown as IClothingItem[];

    if (!wardrobeItems || wardrobeItems.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'EMPTY_WARDROBE',
          message: 'Your closet is empty. Add a few pieces to get started!',
          needsWardrobe: true,
        },
        { status: 200 }
      );
    }

    // 2. Fetch user preferences
    const profileRow = await dbFirst('SELECT preferences FROM profiles WHERE id = ?', [user.uid]);
    const profile = profileRow ? mapProfile(profileRow) : null;
    const userPreferences = profile?.preferences
      ? {
          styles: Object.keys((profile.preferences as Record<string, Record<string, number>>).styles || {}),
          colors: Object.keys((profile.preferences as Record<string, Record<string, number>>).colors || {}),
          temperature_sensitivity: typeof profile.preferences.temperature_sensitivity === 'number'
            ? profile.preferences.temperature_sensitivity
            : undefined,
        }
      : undefined;

    // 3. Execute Anchor-and-Orbit Recommendation Engine
    let result;
    try {
      result = await generateAnchorAndOrbitRecommendation({
        userId: user.uid,
        wardrobe: wardrobeItems,
        occasion,
        vibe,
        lat,
        lon,
        userContext,
        lockedItemIds: lockedItems,
        userPreferences,
      });
    } catch (engineError) {
      if (engineError instanceof Error && engineError.message === 'INSUFFICIENT_ITEMS') {
        return NextResponse.json(
          {
            success: false,
            error: 'INSUFFICIENT_ITEMS',
            message: 'To style full looks, your closet needs at least one top, one bottom, and one pair of shoes.',
            needsWardrobe: true,
          },
          { status: 200 }
        );
      }
      throw engineError;
    }

    // 4. Save recommendation to database
    let savedId: number | undefined;
    try {
      const savedRow = await dbFirst(
        `INSERT INTO outfit_recommendations
          (user_id, outfit_items, weather_data, confidence_score, reasoning, detailed_reasoning, missing_items, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          user.uid,
          toJson(result.outfit.map((i) => i.id)),
          toJson({
            weather: result.thermalProfile.weatherSummary,
            apparentTemperature: result.thermalProfile.apparentTemperatureC,
            targetInsulation: result.thermalProfile.targetInsulationClo,
            rainDefense: result.thermalProfile.precipitationDefense,
            occasion,
            vibe,
          }),
          result.confidenceScore,
          result.reasoning.editorialNote || result.reasoning.anchorPiece,
          JSON.stringify(result.reasoning),
          toJson([]),
          nowIso(),
        ]
      );
      if (savedRow?.id) savedId = Number(savedRow.id);
    } catch (saveErr) {
      logger.warn('Failed to persist recommendation record:', { error: saveErr });
    }

    const payload: RecommendationApiPayload = {
      recommendation: {
        outfit: result.outfit,
        confidence_score: result.confidenceScore,
        reasoning: result.reasoning.editorialNote || result.reasoning.anchorPiece,
        detailed_reasoning: JSON.stringify(result.reasoning),
        missing_items: [],
        dress_code: occasion || 'Casual',
        weather_alerts: [],
        id: savedId,
        outfit_visual_urls: [],
      },
      weather: result.weather ?? null,
      alerts: [],
    };

    return NextResponse.json({
      success: true,
      data: payload,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    logger.error('Unexpected error generating recommendation:', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Styling engine encountered an error',
        message: 'Unable to style outfit at this moment. Please try again.',
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/recommendation
 * Returns the most recent recommendation payload
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const recRow = await dbFirst(
      'SELECT * FROM outfit_recommendations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [user.uid]
    );

    if (!recRow) {
      return NextResponse.json({ success: false, error: 'No recommendations found' }, { status: 404 });
    }

    const recommendation = mapRecommendation(recRow);

    let items: IClothingItem[] = [];
    if (recommendation.outfit_items.length > 0) {
      const placeholders = recommendation.outfit_items.map(() => '?').join(',');
      const itemRows = await dbAll(
        `SELECT * FROM clothing_items WHERE id IN (${placeholders})`,
        recommendation.outfit_items
      );
      items = itemRows.map(mapClothingItem) as unknown as IClothingItem[];
    }

    const payload: RecommendationApiPayload = {
      recommendation: {
        outfit: items,
        confidence_score: recommendation.confidence_score,
        reasoning: recommendation.reasoning ?? '',
        detailed_reasoning: recommendation.detailed_reasoning || null,
        missing_items: recommendation.missing_items || [],
        dress_code: 'Casual',
        weather_alerts: [],
        id: recommendation.id,
        outfit_visual_urls: [],
      },
      weather: null,
      alerts: [],
    };

    return NextResponse.json({ success: true, data: payload });
  } catch (error) {
    logger.warn('Error fetching previous recommendation:', { error });
    return NextResponse.json({ success: false, error: 'Failed to retrieve recommendation' }, { status: 400 });
  }
}
