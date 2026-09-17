import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, mapClothingItem, parseJson } from '@/lib/db';
import { ApiResponse, IClothingItem } from '@/lib/types';
import { logger } from '@/lib/logger';

interface OutfitHistoryEntry {
  id: number;
  outfit_date: string;
  feedback: number | null;
  weather_data?: Record<string, unknown> | null;
  items: IClothingItem[];
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<OutfitHistoryEntry[]>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const outfits = await dbAll(
      'SELECT id, outfit_date, feedback, weather_data FROM outfits WHERE user_id = ? ORDER BY outfit_date DESC LIMIT ?',
      [user.uid, limit]
    );

    const mapped: OutfitHistoryEntry[] = [];
    for (const outfit of outfits) {
      const outfitId = Number(outfit.id);
      const itemRows = await dbAll(
        `SELECT ci.* FROM clothing_items ci
         INNER JOIN outfit_items oi ON oi.clothing_item_id = ci.id
         WHERE oi.outfit_id = ?`,
        [outfitId]
      );
      mapped.push({
        id: outfitId,
        outfit_date: String(outfit.outfit_date),
        feedback: outfit.feedback === null || outfit.feedback === undefined ? null : Number(outfit.feedback),
        weather_data: parseJson<Record<string, unknown> | null>(outfit.weather_data, null),
        items: itemRows.map(mapClothingItem) as unknown as IClothingItem[],
      });
    }

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    logger.error('Unexpected error fetching outfit history', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch outfit history' },
      { status: 500 }
    );
  }
}
