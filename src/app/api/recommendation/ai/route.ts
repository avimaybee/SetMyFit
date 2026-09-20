import { NextRequest, NextResponse } from 'next/server';
import { POST as unifiedRecommendationPOST } from '@/app/api/recommendation/route';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, mapClothingItem } from '@/lib/db';
import { validateOutfitImages } from '@/lib/helpers/aiOutfitAnalyzer';
import { ApiResponse, IClothingItem } from '@/lib/types';

/**
 * POST /api/recommendation/ai
 * Backwards-compatibility wrapper delegating to unified modern recommendation endpoint.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return unifiedRecommendationPOST(request);
}

/**
 * GET /api/recommendation/ai/validate
 * Validate an outfit combination using AI image analysis
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const searchParams = request.nextUrl.searchParams;
    const itemIdsParam = searchParams.get('item_ids');

    if (!itemIdsParam) {
      return NextResponse.json(
        { success: false, error: 'item_ids query parameter is required' },
        { status: 400 }
      );
    }

    const itemIds = itemIdsParam.split(',').map((id) => parseInt(id, 10)).filter(Number.isFinite);
    if (itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid item IDs provided' },
        { status: 400 }
      );
    }

    const placeholders = itemIds.map(() => '?').join(',');
    const itemRows = await dbAll(
      `SELECT * FROM clothing_items WHERE id IN (${placeholders}) AND user_id = ?`,
      [...itemIds, user.uid]
    );

    if (itemRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch clothing items' },
        { status: 404 }
      );
    }

    const items = itemRows.map(mapClothingItem) as unknown as IClothingItem[];
    const validation = await validateOutfitImages(items);

    return NextResponse.json({
      success: true,
      data: {
        isValid: validation.isValid,
        score: validation.score,
        issues: validation.issues,
        suggestions: validation.suggestions,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Outfit validation failed',
      },
      { status: 400 }
    );
  }
}
