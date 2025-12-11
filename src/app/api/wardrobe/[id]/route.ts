import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

/**
 * GET /api/wardrobe/[id]
 * Get a specific clothing item
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<NextResponse<ApiResponse<IClothingItem>>> {
  const supabase = await createClient();
  const resolvedParams = await context.params;
  const { id } = resolvedParams;

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Fetch the specific clothing item
  const { data, error } = await supabase
    .from('clothing_items')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }
    logger.error('Error fetching wardrobe item', { error });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: data as IClothingItem,
  });
}

/**
 * PATCH /api/wardrobe/[id]
 * Update a clothing item
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<NextResponse<ApiResponse<IClothingItem>>> {
  const supabase = await createClient();
  const resolvedParams = await context.params;
  const { id } = resolvedParams;

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Sanitize body - only allow whitelisted fields to prevent injection
    const sanitizedBody: Record<string, unknown> = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in body) {
        sanitizedBody[key] = body[key];
      }
    }

    // Normalize season_tags to lowercase to match database enum
    if (sanitizedBody.season_tags) {
      if (!Array.isArray(sanitizedBody.season_tags)) {
        sanitizedBody.season_tags = [sanitizedBody.season_tags];
      }
      sanitizedBody.season_tags = (sanitizedBody.season_tags as string[]).map((season: string) => season.toLowerCase());
    }

    // Ensure dress_code is an array
    if (sanitizedBody.dress_code && !Array.isArray(sanitizedBody.dress_code)) {
      sanitizedBody.dress_code = [sanitizedBody.dress_code];
    }

    // Update the item with sanitized body
    const { data, error } = await supabase
      .from('clothing_items')
      .update(sanitizedBody)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating wardrobe item', { error });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as IClothingItem,
      message: 'Item updated successfully',
    });
  } catch (error) {
    logger.error('Error processing PATCH request', { error });
    return NextResponse.json(
      { success: false, error: 'Invalid request data' },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/wardrobe/[id]
 * Delete a clothing item
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<Record<string, string>> }
): Promise<NextResponse<ApiResponse<null>>> {
  const supabase = await createClient();
  const resolvedParams = await context.params;
  const { id } = resolvedParams;

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // First, get the item to retrieve its image path for cleanup
  const { data: item } = await supabase
    .from('clothing_items')
    .select('image_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  // Delete the item from database
  const { error } = await supabase
    .from('clothing_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  // Clean up storage if item had an image (non-blocking)
  if (!error && item?.image_url) {
    try {
      const url = new URL(item.image_url);
      const pathSegments = url.pathname.split('/clothing_images/');
      if (pathSegments.length > 1 && pathSegments[1]) {
        const storagePath = decodeURIComponent(pathSegments[1]);
        await supabase.storage.from('clothing_images').remove([storagePath]);
        logger.info('Cleaned up storage for deleted item', { id, storagePath });
      }
    } catch (cleanupError) {
      // Log but don't fail the deletion - storage cleanup is best-effort
      logger.warn('Failed to cleanup storage for deleted item', { id, error: cleanupError });
    }
  }

  if (error) {
    logger.error('Error deleting wardrobe item', { error });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Item deleted successfully',
  });
}
