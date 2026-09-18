import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, parseJson } from '@/lib/db';
import { ApiResponse } from '@/lib/types';
import { logger } from '@/lib/logger';

interface WardrobeMeta {
  styles: string[];
  colors: string[];
  materials: string[];
}

/**
 * GET /api/wardrobe/meta
 * Get metadata about the user's wardrobe (unique styles, colors, materials).
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<WardrobeMeta>>> {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const rows = await dbAll(
      'SELECT style_tags, color, material FROM clothing_items WHERE user_id = ?',
      [user.uid]
    );

    const styleSet = new Set<string>();
    const colorSet = new Set<string>();
    const materialSet = new Set<string>();

    for (const row of rows) {
      for (const tag of parseJson<string[]>(row.style_tags, [])) {
        if (tag) styleSet.add(tag);
      }
      if (row.color) colorSet.add(String(row.color));
      if (row.material) materialSet.add(String(row.material));
    }

    return NextResponse.json({
      success: true,
      data: {
        styles: Array.from(styleSet).sort(),
        colors: Array.from(colorSet).sort(),
        materials: Array.from(materialSet).sort(),
      },
    });
  } catch (error) {
    logger.warn('Error fetching wardrobe items for metadata, returning empty defaults', { error });
    return NextResponse.json({
      success: true,
      data: {
        styles: [],
        colors: [],
        materials: [],
      },
    });
  }
}
