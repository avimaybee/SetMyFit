import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbFirst, dbRun } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const resolvedParams = await context.params;
    const idParam = resolvedParams?.id;
    const outfitId = Number(idParam);

    if (!Number.isFinite(outfitId) || outfitId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid outfit id' },
        { status: 400 }
      );
    }

    // Verify ownership first (D1 has no RLS — enforce user_id explicitly)
    const owned = await dbFirst(
      'SELECT id FROM outfits WHERE id = ? AND user_id = ?',
      [outfitId, user.uid]
    );
    if (!owned) {
      return NextResponse.json(
        { success: false, error: 'Outfit not found' },
        { status: 404 }
      );
    }

    await dbRun('DELETE FROM outfit_items WHERE outfit_id = ?', [outfitId]);
    const deleted = await dbRun(
      'DELETE FROM outfits WHERE id = ? AND user_id = ?',
      [outfitId, user.uid]
    );

    if (deleted.changes === 0) {
      return NextResponse.json(
        { success: false, error: 'Outfit not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: null, message: 'Outfit log deleted' });
  } catch (error) {
    logger.error('Unexpected error deleting outfit log', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to delete outfit log' },
      { status: 500 }
    );
  }
}
