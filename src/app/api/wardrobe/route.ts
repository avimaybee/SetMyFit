import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { boolInt, dbAll, dbFirst, mapClothingItem, toJson } from '@/lib/db';
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
 * Get all wardrobe items for the authenticated user.
 * (R2 image URLs are public and stable — no signed URLs needed.)
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<IClothingItem[]>>> {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  try {
    const rows = await dbAll(
      `SELECT id, name, type, category, color, material, insulation_value,
        last_worn, image_url, season_tags, style_tags, dress_code,
        created_at, pattern, fit, style, occasion, description, is_favorite,
        wear_count
       FROM clothing_items WHERE user_id = ? ORDER BY created_at DESC`,
      [user.uid]
    );
    return NextResponse.json({ success: true, data: rows.map(mapClothingItem) as IClothingItem[] });
  } catch (error) {
    logger.error('Error fetching wardrobe items', { error });
    return NextResponse.json({ success: false, error: 'Failed to fetch wardrobe items' }, { status: 500 });
  }
}

/**
 * POST /api/wardrobe
 * Add a new clothing item to the wardrobe
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<IClothingItem>>> {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  // generate requestId for correlation
  const requestId = ((globalThis as unknown) as { __NEXT_REQUEST_ID?: string }).__NEXT_REQUEST_ID || crypto?.randomUUID?.() || String(Date.now());

  try {
    const body = await request.json();

    if (process.env.NODE_ENV === 'development') {
      console.log(`[${requestId}] Received wardrobe POST request with body:`, JSON.stringify(body, null, 2));
    }

    // Validate shape with zod
    const schema = z.object({
      name: z.string().trim().min(1).max(60),
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

    const row = await dbFirst(
      `INSERT INTO clothing_items
        (user_id, name, type, category, color, material, insulation_value, image_url,
         season_tags, style_tags, dress_code, description, pattern, fit, style, occasion, is_favorite)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        user.uid,
        validBody.name,
        normalizedType,
        validBody.category || null,
        validBody.color || null,
        normalizedMaterial,
        validBody.insulation_value ?? 5,
        validBody.image_url,
        toJson(normalizedSeasonTags),
        // style_tags stored as null (same as before: free-form AI values live in `style`)
        null,
        toJson(dressCode),
        validBody.description || null,
        validBody.pattern || null,
        validBody.fit || null,
        validBody.style || null,
        toJson(validBody.occasion || null),
        boolInt(false),
      ]
    );

    if (!row) {
      return NextResponse.json({ success: false, error: 'Failed to create item' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: mapClothingItem(row) as IClothingItem,
      message: 'Item added successfully',
    }, { status: 201 });
  } catch (error) {
    logger.error('Error processing wardrobe POST', { error });
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: `Server error (requestId: ${requestId})` },
      { status: 500 }
    );
  }
}
