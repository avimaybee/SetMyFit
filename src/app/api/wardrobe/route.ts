import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { IClothingItem, ApiResponse } from '@/lib/types';
import { logger } from '@/lib/logger';
import { normalizeMaterial } from '@/lib/validation';

// Allowed enums (kept here for runtime validation)
const ALLOWED_TYPES = ['Outerwear', 'Top', 'Bottom', 'Footwear', 'Accessory', 'Headwear', 'Dress'];
const ALLOWED_DRESS_CODES = ['Casual', 'Business Casual', 'Formal', 'Athletic', 'Loungewear'];
// Database only supports these four seasons - NOT 'all_season'
const ALLOWED_SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
type SeasonEnum = typeof ALLOWED_SEASONS[number];
// All four seasons array for when 'all_season' is requested
const ALL_SEASONS: SeasonEnum[] = [...ALLOWED_SEASONS];

const normalizeSeasonTagsInput = (tags?: string[] | null): SeasonEnum[] | null => {
  if (!tags || !tags.length) return null;
  const normalizedSet = new Set<SeasonEnum>();
  for (const raw of tags) {
    if (!raw) continue;
    let token = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (token === 'fall') token = 'autumn';
    // Convert 'all_season' variants to all four valid seasons
    if (token === 'all_season' || token === 'allseason') {
      ALL_SEASONS.forEach(s => normalizedSet.add(s));
      continue;
    }
    if ((ALLOWED_SEASONS as readonly string[]).includes(token)) {
      normalizedSet.add(token as SeasonEnum);
    }
  }
  return normalizedSet.size > 0 ? Array.from(normalizedSet) : null;
};

/**
 * GET /api/wardrobe
 * Get all wardrobe items for the authenticated user
 */
export async function GET(_request: NextRequest): Promise<NextResponse<ApiResponse<IClothingItem[]>>> {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Fetch all clothing items for the user
  // Explicitly select columns to avoid over-fetching (e.g. if we add large columns later)
  const { data, error } = await supabase
    .from('clothing_items')
    .select(`
      id, name, type, category, color, material, insulation_value, 
      last_worn, image_url, season_tags, style_tags, dress_code, 
      created_at, pattern, fit, style, occasion, description, favorite:is_favorite,
      wear_count
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('Error fetching wardrobe items', { error });
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const items = data || [];

  const updatedData = await Promise.all(
    items.map(async (item) => {
      if (item.image_url) {
        try {
          const url = new URL(item.image_url);
          const pathSegments = url.pathname.split('/clothing_images/');

          if (pathSegments.length > 1 && pathSegments[1]) {
            const path = pathSegments[1];
            // Create a longer-lived signed URL so Next's image optimizer can fetch
            // multiple sizes without the token expiring immediately.
            // 60s was too short and led to 400s when optimizer refetched images.
            const SIGNED_URL_TTL = 60 * 60; // 1 hour
            const { data: signedUrlData, error: signedUrlError } = await supabase.storage
              .from('clothing_images')
              .createSignedUrl(path, SIGNED_URL_TTL);

            if (signedUrlError) {
              throw signedUrlError;
            }

            return { ...item, image_url: signedUrlData.signedUrl };
          }
        } catch (e) {
          logger.error(`Error processing image URL for item ${item.id}:`, { error: e });
          // Return original item if URL processing fails
          return item;
        }
      }
      return item;
    })
  );

  return NextResponse.json({
    success: true,
    data: updatedData as IClothingItem[],
  });
}

/**
 * POST /api/wardrobe
 * Add a new clothing item to the wardrobe
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<IClothingItem>>> {
  const supabase = await createClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // generate requestId for correlation
  const requestId = ((globalThis as unknown) as { __NEXT_REQUEST_ID?: string }).__NEXT_REQUEST_ID || crypto?.randomUUID?.() || String(Date.now());

  try {
    const body = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[${requestId}] Received wardrobe POST request with body:`, JSON.stringify(body, null, 2));
    }

    // Validate shape with zod
    const schema = z.object({
      name: z.string().min(1),
      type: z.enum(ALLOWED_TYPES as unknown as [string, ...string[]]), // Required - database column is NOT NULL
      category: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      material: z.string().nullable().optional(),
      insulation_value: z.number().min(0).max(10).optional(),
      image_url: z.string().min(1), // Required - database column is NOT NULL
      season_tags: z.array(z.string()).nullable().optional(),
      style_tags: z.array(z.string()).nullable().optional(),
      dress_code: z.array(z.string()).optional(),
      pattern: z.string().nullable().optional(),
      fit: z.string().nullable().optional(),
      style: z.string().nullable().optional(),
      occasion: z.array(z.string()).nullable().optional(),
      description: z.string().nullable().optional(),
    });

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const validation_errors = parsed.error.issues.map(e => ({ field: e.path.join('.') || 'body', message: e.message }));
      logger.warn('Validation failed for wardrobe POST', { requestId, validation_errors });
      return NextResponse.json({ success: false, error: 'Validation failed', validation_errors }, { status: 400 });
    }

    const validBody = parsed.data;

    // Default to all four seasons if none provided (instead of invalid 'all_season')
    const normalizedSeasonTags = normalizeSeasonTagsInput(validBody.season_tags) ?? ALL_SEASONS;

    // Normalize material to match database enum
    const normalizedMaterial = normalizeMaterial(validBody.material);

    // Type is now required by schema, so we can safely use it directly
    const normalizedType = String(validBody.type);

    // Validate dress_code items
    let dressCode = ['Casual'];
    if (Array.isArray(validBody.dress_code) && validBody.dress_code.length > 0) {
      const invalid = validBody.dress_code.filter((d: string) => !ALLOWED_DRESS_CODES.includes(d));
      if (invalid.length) {
        const validation_errors = invalid.map(i => ({ field: 'dress_code', message: `Unsupported dress code: ${i}` }));
        logger.warn('Invalid dress_code values', { requestId, invalid });
        return NextResponse.json({ success: false, error: 'Invalid dress_code', validation_errors }, { status: 400 });
      }
      dressCode = validBody.dress_code as string[];
    }

    // Build new item - include all columns that exist in the database schema
    // Note: style_tags is set to null because the database uses an enum that may not match
    // the AI-generated values. The style is stored in the 'style' text field instead.
    const newItem = {
      user_id: user.id,
      name: validBody.name,
      type: normalizedType,
      category: validBody.category || null,
      color: validBody.color || null,
      material: normalizedMaterial,
      insulation_value: validBody.insulation_value ?? 5,
      image_url: validBody.image_url,
      season_tags: normalizedSeasonTags,
      // TODO: style_tags is set to null because DB has enum constraint that AI values don't match.
      // Future fix: Either update DB enum to accept AI values, or create a normalization function
      // similar to normalizeSeasonTagsInput for style_tags.
      style_tags: null,
      dress_code: dressCode,
      description: validBody.description || null,
      pattern: validBody.pattern || null,
      fit: validBody.fit || null,
      style: validBody.style || null,
      occasion: validBody.occasion || null,
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[${requestId}] Creating database record:`, JSON.stringify(newItem, null, 2));
    }

    const { data, error } = await supabase
      .from('clothing_items')
      .insert([newItem])
      .select()
      .single();

    if (error) {
      logger.error('Error creating wardrobe item', { requestId, error: error.message, code: error.code, hint: error.hint, details: error.details });
      console.error('[WARDROBE API ERROR]', JSON.stringify({ message: error.message, code: error.code, hint: error.hint, details: error.details }, null, 2));
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details,
          message: `Server error (requestId: ${requestId})`
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data as IClothingItem,
      message: 'Item added successfully',
    }, { status: 201 });
  } catch (error) {
    logger.error('Error processing wardrobe POST', { error });
    const requestId = ((globalThis as unknown) as { __NEXT_REQUEST_ID?: string }).__NEXT_REQUEST_ID || crypto?.randomUUID?.() || String(Date.now());
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: `Server error (requestId: ${requestId})` },
      { status: 500 }
    );
  }
}
