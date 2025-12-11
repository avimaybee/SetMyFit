import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiResponse } from '@/lib/types';

/**
 * POST /api/outfit/log
 * Log outfit usage, create outfit record, and update last_worn_date for all items
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ outfit_id: number; updated_count: number }>>> {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
        userId: user.id,
        itemIds: normalizedItemIds,
        outfitDate,
        feedback,
      });
    }

    // Prevent duplicate outfit entries for the same day
    const { data: todaysOutfits, error: todaysOutfitsError } = await supabase
      .from('outfits')
      .select('id')
      .eq('user_id', user.id)
      .eq('outfit_date', outfitDate);

    if (todaysOutfitsError) {
      console.error('Error checking existing outfits:', todaysOutfitsError);
    }

    if (todaysOutfits && todaysOutfits.length > 0) {
      const outfitIds = todaysOutfits.map((o) => o.id);
      const { data: todaysItems, error: todaysItemsError } = await supabase
        .from('outfit_items')
        .select('outfit_id, clothing_item_id')
        .in('outfit_id', outfitIds);

      if (todaysItemsError) {
        console.error('Error fetching outfit items for duplicate check:', todaysItemsError);
      } else if (todaysItems) {
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
    }

    // Create outfit record
    const { data: outfit, error: outfitError } = await supabase
      .from('outfits')
      .insert({
        user_id: user.id,
        outfit_date: outfitDate,
        feedback,
      })
      .select()
      .single();

    if (outfitError || !outfit) {
      console.error('Error creating outfit:', outfitError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create outfit record',
          details: process.env.NODE_ENV !== 'production' ? outfitError?.message : undefined
        },
        { status: 500 }
      );
    }

    // Create outfit_items relationships
    const outfitItems = normalizedItemIds.map(itemId => ({
      outfit_id: outfit.id,
      clothing_item_id: itemId,
    }));

    const { error: itemsError } = await supabase
      .from('outfit_items')
      .insert(outfitItems);

    if (itemsError) {
      console.error('Error inserting outfit items:', itemsError);
      // Rollback: delete the outfit if items couldn't be linked
      await supabase.from('outfits').delete().eq('id', outfit.id);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to link items to outfit',
          details: process.env.NODE_ENV !== 'production' ? itemsError?.message : undefined
        },
        { status: 500 }
      );
    }

    // Update last_worn and increment wear_count for all items in the outfit
    // We need to increment wear_count individually since Supabase doesn't support atomic increment in bulk
    let updatedCount = 0;
    for (const itemId of normalizedItemIds) {
      // First get current wear_count
      const { data: currentItem } = await supabase
        .from('clothing_items')
        .select('wear_count')
        .eq('id', itemId)
        .eq('user_id', user.id)
        .single();

      // Update with incremented wear_count
      const { error: updateError } = await supabase
        .from('clothing_items')
        .update({
          last_worn: outfitDate,
          wear_count: (currentItem?.wear_count || 0) + 1
        })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (!updateError) {
        updatedCount++;
      } else {
        console.error(`Error updating item ${itemId}:`, updateError);
      }
    }

    if (updatedCount < normalizedItemIds.length) {
      console.warn(`Only updated ${updatedCount}/${normalizedItemIds.length} items' wear_count`);
    }

    return NextResponse.json({
      success: true,
      data: {
        outfit_id: outfit.id,
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
