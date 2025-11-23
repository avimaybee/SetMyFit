import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IClothingItem, ApiResponse } from '@/lib/types';
import { logger } from '@/lib/logger';

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

    // Normalize season_tags to lowercase to match database enum
    if (body.season_tags) {
      if (!Array.isArray(body.season_tags)) {
        body.season_tags = [body.season_tags];
      }
      body.season_tags = body.season_tags.map((season: string) => season.toLowerCase());
    }

    // Ensure dress_code is an array
    if (body.dress_code && !Array.isArray(body.dress_code)) {
      body.dress_code = [body.dress_code];
    }

    // Update the item
    const { data, error } = await supabase
      .from('clothing_items')
      .update(body)
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

  // Delete the item
  const { error } = await supabase
    .from('clothing_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

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
