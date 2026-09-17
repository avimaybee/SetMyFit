import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbFirst, mapClothingItem, toJson } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/lib/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ updatedCount: number }>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Parse request
    const { itemIds, addTag, dressCode } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemIds must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!addTag && !dressCode) {
      return NextResponse.json(
        { success: false, error: 'Must provide either addTag or dressCode' },
        { status: 400 }
      );
    }

    const ids = itemIds.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id));
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Fetch current items to update them
    const placeholders = ids.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT * FROM clothing_items WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, user.uid]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No items found' },
        { status: 404 }
      );
    }

    let updatedCount = 0;
    for (const row of rows) {
      const item = mapClothingItem(row);
      let styleTags = item.style_tags ?? [];
      if (addTag && !styleTags.includes(addTag)) {
        styleTags = [...styleTags, addTag];
      }
      const dress = dressCode ? [dressCode] : item.dress_code;
      const updated = await dbFirst(
        `UPDATE clothing_items SET style_tags = ?, dress_code = ? WHERE id = ? AND user_id = ? RETURNING id`,
        [toJson(addTag ? styleTags : item.style_tags), toJson(dress), item.id, user.uid]
      );
      if (updated) updatedCount++;
    }

    logger.info('Batch updated items', {
      userId: user.uid,
      itemCount: ids.length,
      updateType: addTag ? 'addTag' : 'dressCode',
    });

    return NextResponse.json({
      success: true,
      data: { updatedCount },
    });
  } catch (error) {
    logger.error('Error in batch update', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
