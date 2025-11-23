import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/lib/types';
import { logger } from '@/lib/logger';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const resolvedParams = await context.params;
    const idParam = resolvedParams?.id;
    const outfitId = Number(idParam);

    if (!Number.isFinite(outfitId) || outfitId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid outfit id' },
        { status: 400 }
      );
    }

    const { error: itemDeleteError } = await supabase
      .from('outfit_items')
      .delete()
      .eq('outfit_id', outfitId);

    if (itemDeleteError) {
      logger.error('Failed to delete outfit_items for outfit', { outfitId, error: itemDeleteError });
      return NextResponse.json(
        { success: false, error: 'Failed to delete outfit items' },
        { status: 500 }
      );
    }

    const { data: deletedOutfit, error: outfitDeleteError } = await supabase
      .from('outfits')
      .delete()
      .eq('id', outfitId)
      .eq('user_id', user.id)
      .select('id')
      .single();

    if (outfitDeleteError) {
      const status = outfitDeleteError.code === 'PGRST116' ? 404 : 500;
      if (status === 500) {
        logger.error('Failed to delete outfit', { outfitId, error: outfitDeleteError });
      }
      return NextResponse.json(
        { success: false, error: status === 404 ? 'Outfit not found' : 'Failed to delete outfit' },
        { status }
      );
    }

    if (!deletedOutfit) {
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
