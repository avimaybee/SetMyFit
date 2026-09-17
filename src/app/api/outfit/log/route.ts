import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbFirst, dbRun } from '@/lib/db';
import { ApiResponse } from '@/lib/types';

/**
 * POST /api/outfit/log
 * Log outfit usage, create outfit record, and update last_worn/wear_count for all items
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ outfit_id: number; updated_count: number }>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.item_ids || !Array.isArray(body.item_ids) || body.item_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'item_ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const itemIds = body.item_ids as number[];
    const outfitDate = body.outfit_date || new Date().toISOString().split('T')[0];
    const feedback = body.feedback || null;
    const normalizedItemIds = Array.from(new Set(itemIds)).sort((a, b) => a - b);

    // Log for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log('Log outfit request:', {
        userId: user.uid,
        itemIds: normalizedItemIds,
        outfitDate,
        feedback,
      });
    }

    // Prevent duplicate outfit entries for the same day
    const todaysOutfits = await dbAll(
      'SELECT id FROM outfits WHERE user_id = ? AND outfit_date = ?',
      [user.uid, outfitDate]
    );

    if (todaysOutfits.length > 0) {
      const outfitIds = todaysOutfits.map((o) => Number(o.id));
      const placeholders = outfitIds.map(() => '?').join(',');
      const todaysItems = await dbAll(
        `SELECT outfit_id, clothing_item_id FROM outfit_items WHERE outfit_id IN (${placeholders})`,
        outfitIds
      );

      const itemsByOutfit = todaysItems.reduce<Record<number, number[]>>((acc, item) => {
        if (typeof item.outfit_id !== 'number' || typeof item.clothing_item_id !== 'number') {
          return acc;
        }
        acc[item.outfit_id] = acc[item.outfit_id] || [];
        acc[item.outfit_id].push(item.clothing_item_id);
        return acc;
      }, {});

      const duplicateOutfitId = Object.entries(itemsByOutfit).find(([, value]) => {
        const sortedExisting = Array.from(new Set(value)).sort((a, b) => a - b);
        if (sortedExisting.length !== normalizedItemIds.length) {
          return false;
        }
        return sortedExisting.every((id, index) => id === normalizedItemIds[index]);
      })?.[0];

      if (duplicateOutfitId) {
        return NextResponse.json(
          {
            success: false,
            error: 'DUPLICATE_OUTFIT',
            message: 'This outfit is already logged for today.',
          },
          { status: 409 }
        );
      }
    }

    // Create outfit record
    const outfit = await dbFirst(
      'INSERT INTO outfits (user_id, outfit_date, feedback) VALUES (?, ?, ?) RETURNING *',
      [user.uid, outfitDate, feedback]
    );

    if (!outfit) {
      return NextResponse.json(
        { success: false, error: 'Failed to create outfit record' },
        { status: 500 }
      );
    }

    const outfitId = Number(outfit.id);

    // Create outfit_items relationships
    try {
      const placeholders = normalizedItemIds.map(() => '(?, ?)').join(', ');
      const params: Array<string | number | null> = [];
      for (const itemId of normalizedItemIds) {
        params.push(outfitId, itemId);
      }
      await dbRun(
        `INSERT OR IGNORE INTO outfit_items (outfit_id, clothing_item_id) VALUES ${placeholders}`,
        params
      );
    } catch (itemsError) {
      console.error('Error inserting outfit items:', itemsError);
      // Rollback: delete the outfit if items couldn't be linked
      await dbRun('DELETE FROM outfits WHERE id = ?', [outfitId]);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to link items to outfit',
          details: process.env.NODE_ENV !== 'production' && itemsError instanceof Error ? itemsError.message : undefined
        },
        { status: 500 }
      );
    }

    // Update last_worn and increment wear_count for all items in the outfit
    let updatedCount = 0;
    for (const itemId of normalizedItemIds) {
      try {
        const currentItem = await dbFirst(
          'SELECT wear_count FROM clothing_items WHERE id = ? AND user_id = ?',
          [itemId, user.uid]
        );
        const res = await dbRun(
          'UPDATE clothing_items SET last_worn = ?, wear_count = ? WHERE id = ? AND user_id = ?',
          [outfitDate, Number(currentItem?.wear_count ?? 0) + 1, itemId, user.uid]
        );
        if (res.changes > 0) updatedCount++;
      } catch (updateError) {
        console.error(`Error updating item ${itemId}:`, updateError);
      }
    }

    if (updatedCount < normalizedItemIds.length) {
      console.warn(`Only updated ${updatedCount}/${normalizedItemIds.length} items' wear_count`);
    }

    return NextResponse.json({
      success: true,
      data: {
        outfit_id: outfitId,
        updated_count: updatedCount
      },
      message: `Successfully logged outfit with ${normalizedItemIds.length} items`,
    });
  } catch (error) {
    console.error('Unexpected error logging outfit:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        details: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
