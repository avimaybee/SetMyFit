import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbRun } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/lib/types';

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<{ deletedCount: number }>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    // Parse request
    const { itemIds } = await request.json();

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemIds must be a non-empty array' },
        { status: 400 }
      );
    }

    const ids = itemIds.map((id) => Number(id)).filter((id) => Number.isFinite(id));
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'itemIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Best-effort: collect R2 keys before deleting rows
    const placeholders = ids.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT image_url FROM clothing_items WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, user.uid]
    );

    const { r2Delete, r2KeyFromUrl } = await import('@/lib/r2');

    // Delete items (user_id filter ensures users can only delete their own)
    const result = await dbRun(
      `DELETE FROM clothing_items WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, user.uid]
    );

    // Best-effort R2 cleanup (don't fail the request)
    for (const row of rows) {
      const key = r2KeyFromUrl(String(row.image_url ?? ''));
      if (key) {
        try {
          await r2Delete(key);
        } catch (error) {
          logger.warn('Failed to cleanup R2 object in batch delete', { key, error });
        }
      }
    }

    logger.info('Batch deleted items', {
      userId: user.uid,
      itemCount: ids.length,
      actualDeleted: result.changes,
    });

    return NextResponse.json({
      success: true,
      data: { deletedCount: result.changes },
    });
  } catch (error) {
    logger.error('Error in batch delete', { error });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to complete batch delete',
      },
      { status: 400 }
    );
  }
}
