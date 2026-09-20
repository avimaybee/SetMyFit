import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbFirst, mapClothingItem, mapRecommendation, nowIso, parseJson, toJson } from '@/lib/db';
import { RecommendationFeedback, ApiResponse, IClothingItem } from '@/lib/types';
import { adjustPreferencesBasedOnFeedback } from '@/lib/helpers/preferenceLearning';

/**
 * POST /api/recommendation/[id]/feedback
 * Submit feedback for a recommendation and update user preferences
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<RecommendationFeedback>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    const { id } = await params;

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (typeof body.is_liked !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'is_liked (boolean) is required' },
        { status: 400 }
      );
    }

    // Verify recommendation exists and belongs to user
    const recRow = await dbFirst(
      'SELECT * FROM outfit_recommendations WHERE id = ? AND user_id = ?',
      [Number(id), user.uid]
    );

    if (!recRow) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found' },
        { status: 404 }
      );
    }
    const recommendation = mapRecommendation(recRow);

    // Create feedback record
    const feedback: RecommendationFeedback = {
      recommendation_id: id,
      is_liked: body.is_liked,
      reason: body.reason || undefined,
      weather_conditions: body.weather_conditions || undefined,
      created_at: new Date(),
    };

    // Store feedback in database
    const inserted = await dbFirst(
      `INSERT INTO recommendation_feedback (user_id, recommendation_id, is_liked, reason)
       VALUES (?, ?, ?, ?) RETURNING id`,
      [user.uid, Number(id), body.is_liked ? 1 : 0, body.reason || null]
    );

    if (!inserted) {
      return NextResponse.json(
        { success: false, error: 'Unable to record feedback' },
        { status: 400 }
      );
    }

    // Get clothing items from the recommendation
    let items: IClothingItem[] = [];
    if (recommendation.outfit_items.length > 0) {
      const placeholders = recommendation.outfit_items.map(() => '?').join(',');
      const itemRows = await dbAll(
        `SELECT * FROM clothing_items WHERE id IN (${placeholders})`,
        recommendation.outfit_items
      );
      items = itemRows.map(mapClothingItem) as unknown as IClothingItem[];
    }

    // Update user preferences based on feedback
    try {
      const profileRow = await dbFirst('SELECT preferences FROM profiles WHERE id = ?', [user.uid]);
      const currentPreferences = profileRow
        ? parseJson<Record<string, Record<string, number>>>(profileRow.preferences, {})
        : {};
      const updatedPreferences = adjustPreferencesBasedOnFeedback(
        currentPreferences,
        items || [],
        body.is_liked,
        body.reason
      );

      // Save updated preferences
      await dbFirst(
        'UPDATE profiles SET preferences = ?, updated_at = ? WHERE id = ? RETURNING id',
        [toJson(updatedPreferences), nowIso(), user.uid]
      );
    } catch (prefError) {
      console.error('Failed to update preferences:', prefError);
      // Don't fail the request if preference update fails
    }

    return NextResponse.json({
      success: true,
      data: feedback,
      message: 'Feedback recorded successfully. Your preferences have been updated.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to record feedback'
      },
      { status: 400 }
    );
  }
}
