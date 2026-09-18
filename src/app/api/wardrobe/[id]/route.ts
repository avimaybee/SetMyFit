import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { boolInt, dbFirst, dbRun, mapClothingItem } from '@/lib/db';
import { r2Delete, r2KeyFromUrl } from '@/lib/r2';
import { IClothingItem, ApiResponse } from '@/lib/types';
import { logger } from '@/lib/logger';

// Whitelist of fields that can be updated via PATCH
// This prevents injection of protected fields like user_id, id, created_at
const ALLOWED_UPDATE_FIELDS = [
  'name', 'type', 'category', 'color', 'material',
  'insulation_value', 'image_url', 'season_tags',
  'style_tags', 'dress_code', 'is_favorite', 'description',
  'pattern', 'fit', 'occasion'
] as const;

type RouteContext = { params: Promise<Record<string, string>> };

const COLUMN_OF: Record<string, string> = {
  name: 'name', type: 'type', category: 'category', color: 'color',
  material: 'material', insulation_value: 'insulation_value', image_url: 'image_url',
  season_tags: 'season_tags', style_tags: 'style_tags', dress_code: 'dress_code',
  is_favorite: 'is_favorite', description: 'description', pattern: 'pattern',
  fit: 'fit', occasion: 'occasion',
};

function encodeValue(key: string, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (key === 'season_tags' || key === 'style_tags' || key === 'dress_code' || key === 'occasion') {
    const arr = Array.isArray(value) ? value : [value];
    if (key === 'season_tags') {
      return JSON.stringify((arr as unknown[]).map((s) => String(s).toLowerCase()));
    }
    return JSON.stringify(arr);
  }
  if (key === 'is_favorite') return boolInt(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return boolInt(value);
  return String(value);
}

/**
 * GET /api/wardrobe/[id]
 * Get a specific clothing item
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<IClothingItem>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    const { id } = await context.params;

    const row = await dbFirst(
      'SELECT * FROM clothing_items WHERE id = ? AND user_id = ?',
      [Number(id), user.uid]
    );

    if (!row) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: mapClothingItem(row) as IClothingItem });
  } catch (error) {
    logger.error('Error fetching clothing item', { error });
    return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
  }
}

/**
 * PATCH /api/wardrobe/[id]
 * Update a clothing item
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<IClothingItem>>> {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;

  try {
    const body = await request.json();

    const sets: string[] = [];
    const params: Array<string | number | null> = [];
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) {
        sets.push(`${COLUMN_OF[key]} = ?`);
        params.push(encodeValue(key, body[key]));
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const row = await dbFirst(
      `UPDATE clothing_items SET ${sets.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`,
      [...params, Number(id), user.uid]
    );

    if (!row) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: mapClothingItem(row) as IClothingItem,
      message: 'Item updated successfully',
    });
  } catch (error) {
    logger.error('Error processing PATCH request', { error });
    return NextResponse.json({ success: false, error: 'Invalid request data' }, { status: 400 });
  }
}

/**
 * DELETE /api/wardrobe/[id]
 * Delete a clothing item (+ best-effort R2 cleanup)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();
    const { id } = await context.params;

    const item = await dbFirst(
      'SELECT image_url FROM clothing_items WHERE id = ? AND user_id = ?',
      [Number(id), user.uid]
    );

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    const result = await dbRun(
      'DELETE FROM clothing_items WHERE id = ? AND user_id = ?',
      [Number(id), user.uid]
    );

    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    // Clean up R2 object if the image lives in our bucket (non-blocking)
    const imageUrl = item.image_url as string | undefined;
    if (imageUrl) {
      const key = r2KeyFromUrl(imageUrl);
      if (key) {
        try {
          await r2Delete(key);
          logger.info('Cleaned up R2 object for deleted item', { id, key });
        } catch (cleanupError) {
          logger.warn('Failed to cleanup R2 object for deleted item', { id, error: cleanupError });
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    logger.error('Error deleting clothing item', { error });
    return NextResponse.json({ success: false, error: 'Unable to delete clothing item' }, { status: 400 });
  }
}
