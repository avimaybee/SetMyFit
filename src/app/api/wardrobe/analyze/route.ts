import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeClothingImage } from '@/lib/helpers/aiOutfitAnalyzer';
import { ClothingType } from '@/types/retro';
import { parseDataUrl } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { image, mimeType } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image data is required' },
        { status: 400 }
      );
    }

    const { base64: payload, mimeType: resolvedMime } =
      image.startsWith('data:')
        ? parseDataUrl(image, mimeType || 'image/jpeg')
        : { base64: image, mimeType: mimeType || 'image/jpeg' };

    const analysis = await analyzeClothingImage(payload, resolvedMime);
    const category = mapCategoryToDbType(analysis.detectedType);

    // Map to the format expected by the frontend
    const mappedData = {
      name: analysis.detectedName || "New Item",
      category,
      type: category,
      color: analysis.detectedColor,
      material: analysis.detectedMaterial,
      season_tags: analysis.detectedSeason || [],
      style_tags: analysis.detectedStyleTags,
      insulation_value: analysis.detectedInsulation || 5,
      pattern: analysis.detectedPattern,
      fit: analysis.detectedFit,
      description: analysis.detectedDescription
    };

    return NextResponse.json({ success: true, data: mappedData });

  } catch (error) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to analyze image' },
      { status: 500 }
    );
  }
}

function mapCategoryToDbType(category?: string): ClothingType {
  const cat = category?.toLowerCase() ?? '';
    if (cat.includes('accessory')) return 'Accessory';
    if (cat.includes('shoe') || cat.includes('foot')) return 'Shoes';
    if (cat.includes('head') || cat.includes('hat')) return 'Accessory';
    if (cat.includes('outer') || cat.includes('jacket') || cat.includes('coat')) return 'Outerwear';
    if (cat.includes('bottom') || cat.includes('pant') || cat.includes('jean')) return 'Bottom';
    if (cat.includes('dress')) return 'Dress';
    if (cat.includes('top') || cat.includes('shirt')) return 'Top';
    return 'Top';
}

