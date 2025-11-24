/**
 * User Statistics API Endpoint
 * GET /api/stats
 * 
 * Returns basic usage statistics for authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateBoundary = thirtyDaysAgo.toISOString().split('T')[0];

    const [analyticsResult, totalOutfitsResult, recentOutfitsResult] = await Promise.all([
      supabase
        .from('wardrobe_analytics')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('outfits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('outfits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('outfit_date', dateBoundary),
    ]);

    if (analyticsResult.error && analyticsResult.error.code !== 'PGRST116') {
      logger.warn('Unable to read wardrobe analytics view', { error: analyticsResult.error });
    }

    const wardrobeSize = analyticsResult.data?.total_items ?? 0;
    const favoriteCount = analyticsResult.data?.favorite_count ?? 0;
    const avgWearCount = analyticsResult.data?.avg_wear_count ?? 0;
    const maxWearCount = analyticsResult.data?.max_wear_count ?? 0;
    const rarelyWorn = analyticsResult.data?.rarely_worn ?? 0;

    const stats = {
      totalOutfits: totalOutfitsResult.count ?? 0,
      outfitsLast30Days: recentOutfitsResult.count ?? 0,
      wardrobeSize,
      favoriteCount,
      avgWearCount,
      maxWearCount,
      rarelyWorn,
    };
    
    return NextResponse.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Error fetching user stats', { error });
    return NextResponse.json(
      { 
        error: 'Failed to fetch statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
