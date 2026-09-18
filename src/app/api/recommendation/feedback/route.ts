/**
 * POST /api/recommendation/feedback
 *
 * Handles user feedback on outfit recommendations.
 * Learns from likes/dislikes to improve future recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll } from '@/lib/db';
import { processFeedback } from '@/lib/helpers/feedbackProcessor';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/lib/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ success: boolean }>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Parse request
    const body = await request.json();
    const { recommendationId, isLiked, reason, outfitItems, weather } = body;

    // Validate required fields
    if (!recommendationId || typeof isLiked !== 'boolean' || !Array.isArray(outfitItems)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process feedback
    const result = await processFeedback({
      userId: user.uid,
      recommendationId,
      isLiked,
      reason,
      outfitItems,
      weather,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to record feedback' },
        { status: 400 }
      );
    }

    logger.info('Feedback logged and processed', {
      userId: user.uid,
      isLiked,
      recommendationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded and analyzed',
    });
  } catch (error) {
    logger.error('Error processing feedback', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to record feedback',
      },
      { status: 400 }
    );
  }
}

/**
 * GET /api/recommendation/feedback
 *
 * Gets user's feedback history (optional - for analytics)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Fetch feedback history
    const data = await dbAll(
      'SELECT * FROM recommendation_feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [user.uid]
    );

    return NextResponse.json({
      success: true,
      data: data || [],
      message: 'Feedback history retrieved',
    });
  } catch (error) {
    logger.warn('Error fetching feedback history, returning empty fallback', { error });
    return NextResponse.json({
      success: true,
      data: [],
      message: 'No feedback history available yet',
    });
  }
}
