/**
 * User Statistics API Endpoint
 * GET /api/stats
 *
 * Returns basic usage statistics for authenticated user
 * (computed in JS from D1 — replaces the old wardrobe_analytics view)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbFirst } from '@/lib/db';
import { logger } from '@/lib/logger';

// Using Node.js runtime for firebase-admin compatibility
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateBoundary = thirtyDaysAgo.toISOString().split('T')[0];
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const rarelyBoundary = ninetyDaysAgo.toISOString().split('T')[0];

    const [wardrobeAgg, outfitsAgg, recentAgg, rarelyAgg] = await Promise.all([
      dbFirst(
        `SELECT COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN is_favorite = 1 THEN 1 ELSE 0 END), 0) AS favorites,
           COALESCE(AVG(wear_count), 0) AS avg_wear,
           COALESCE(MAX(wear_count), 0) AS max_wear
         FROM clothing_items WHERE user_id = ?`,
        [user.uid]
      ),
      dbFirst('SELECT COUNT(*) AS total FROM outfits WHERE user_id = ?', [user.uid]),
      dbFirst(
        'SELECT COUNT(*) AS total FROM outfits WHERE user_id = ? AND outfit_date >= ?',
        [user.uid, dateBoundary]
      ),
      dbFirst(
        `SELECT COUNT(*) AS total FROM clothing_items
         WHERE user_id = ? AND (last_worn IS NULL OR last_worn < ?)`,
        [user.uid, rarelyBoundary]
      ),
    ]);

    // Worn in last 30 days: distinct items logged via outfits in range
    const wornRows = await dbAll(
      `SELECT COUNT(DISTINCT oi.clothing_item_id) AS worn
       FROM outfit_items oi INNER JOIN outfits o ON o.id = oi.outfit_id
       WHERE o.user_id = ? AND o.outfit_date >= ?`,
      [user.uid, dateBoundary]
    );

    const stats = {
      totalOutfits: Number(outfitsAgg?.total ?? 0),
      outfitsLast30Days: Number(recentAgg?.total ?? 0),
      wardrobeSize: Number(wardrobeAgg?.total ?? 0),
      favoriteCount: Number(wardrobeAgg?.favorites ?? 0),
      avgWearCount: Number(wardrobeAgg?.avg_wear ?? 0),
      maxWearCount: Number(wardrobeAgg?.max_wear ?? 0),
      rarelyWorn: Number(rarelyAgg?.total ?? 0),
      wornLast30Days: Number(wornRows[0]?.worn ?? 0),
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.warn('Error fetching user stats, returning zeroes:', { error });
    return NextResponse.json({
      success: true,
      data: {
        totalOutfits: 0,
        outfitsLast30Days: 0,
        wardrobeSize: 0,
        favoriteCount: 0,
        avgWearCount: 0,
        maxWearCount: 0,
        rarelyWorn: 0,
        wornLast30Days: 0,
      }
    });
  }
}
