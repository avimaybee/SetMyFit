import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiResponse, IClothingItem } from '@/lib/types';
import { logger } from '@/lib/logger';

interface OutfitHistoryEntry {
  id: number;
  outfit_date: string;
  feedback: number | null;
  weather_data?: Record<string, unknown> | null;
  items: IClothingItem[];
}

type OutfitRow = {
  id: number;
  outfit_date: string;
  feedback: number | null;
  weather_data: Record<string, unknown> | null;
  outfit_items: Array<{ clothing_items: IClothingItem | IClothingItem[] | null }> | null;
};

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<OutfitHistoryEntry[]>>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 50;

    const { data, error } = await supabase
      .from('outfits')
      .select(`
        id,
        outfit_date,
        feedback,
        weather_data,
        outfit_items (
          clothing_items (
            id,
            user_id,
            name,
            type,
            category,
            color,
            material,
            insulation_value,
            last_worn,
            image_url,
            season_tags,
            style_tags,
            dress_code,
            created_at,
            pattern,
            fit,
            style,
            occasion,
            description,
            wear_count,
            is_favorite
          )
        )
      `)
      .eq('user_id', user.id)
      .order('outfit_date', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching outfit history', { error });
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as unknown as OutfitRow[];

    const mapped: OutfitHistoryEntry[] = rows.map((row) => {
      const items: IClothingItem[] = [];
      row.outfit_items?.forEach((relation) => {
        const clothing = relation?.clothing_items;
        if (Array.isArray(clothing)) {
          clothing.forEach((item) => item && items.push(item));
        } else if (clothing) {
          items.push(clothing);
        }
      });

      return {
        id: row.id,
        outfit_date: row.outfit_date,
        feedback: row.feedback ?? null,
        weather_data: row.weather_data as Record<string, unknown> | null,
        items,
      };
    });

    return NextResponse.json({ success: true, data: mapped });
  } catch (error) {
    logger.error('Unexpected error fetching outfit history', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch outfit history' },
      { status: 500 }
    );
  }
}
