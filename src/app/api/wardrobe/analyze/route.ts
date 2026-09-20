import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { analyzeClothingImage } from '@/lib/helpers/aiOutfitAnalyzer';
import { ClothingType } from '@/types/retro';
import { parseDataUrl } from '@/lib/utils';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
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
      color_hex: analysis.detectedColorHex,
      material: analysis.detectedMaterial,
      season_tags: analysis.detectedSeason || [],
      style_tags: analysis.detectedStyleTags,
      insulation_value: analysis.detectedInsulation || 5,
      pattern: analysis.detectedPattern,
      fit: analysis.detectedFit,
      silhouette: analysis.detectedSilhouette,
      formality: analysis.detectedFormality,
      texture: analysis.detectedTexture,
      description: analysis.detectedDescription
    };

    return NextResponse.json({ success: true, data: mappedData });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const isSuspended = errMsg.toLowerCase().includes('suspended') || errMsg.toLowerCase().includes('permission_denied') || errMsg.toLowerCase().includes('403');
    const isRateLimited = errMsg.includes('429') || errMsg.toLowerCase().includes('resource_exhausted');

    console.error('API /api/wardrobe/analyze error:', {
      error: errMsg,
      isSuspended,
      isRateLimited,
    });

    return NextResponse.json({
      success: false,
      error: 'AI_VISION_UNAVAILABLE',
      reason: errMsg,
      isKeySuspended: isSuspended,
      isRateLimited,
      message: isSuspended
        ? 'Gemini API key is suspended by Google. Update GEMINI_API_KEY in Cloudflare Worker secrets or .env.local.'
        : isRateLimited
          ? 'AI rate limit reached. Please wait a minute or enter details manually.'
          : 'AI vision model unavailable right now. You can fill in details manually.',
      data: null,
    }, { status: 200 });
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
