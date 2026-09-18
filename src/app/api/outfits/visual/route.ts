import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { dbAll, dbFirst, mapClothingItem, nowIso, toJson } from '@/lib/db';
import { buildR2Key, r2Configured, r2PublicUrl, r2Put } from '@/lib/r2';
import { generateOutfitVisual } from '@/lib/helpers/outfitVisuals';
import { logger } from '@/lib/logger';
import { IClothingItem } from '@/lib/types';

/**
 * POST /api/outfits/visual
 * Render the given wardrobe pieces as one flat-lay outfit image (Nano Banana),
 * store it on R2, and record it in outfit_visuals. Deliberately on-demand
 * (not auto-run with recommendations) — image calls cost more than text.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  if (!r2Configured()) {
    return NextResponse.json(
      { success: false, error: 'Image storage is not configured.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const itemIds = Array.isArray(body.item_ids)
      ? body.item_ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isFinite(id))
      : [];
    const recommendationId = body.recommendation_id ?? null;
    const occasion = typeof body.occasion === 'string' ? body.occasion : undefined;

    if (itemIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 items are required to render a look.' },
        { status: 400 }
      );
    }
    if (itemIds.length > 8) {
      return NextResponse.json(
        { success: false, error: 'At most 8 items per render.' },
        { status: 400 }
      );
    }

    const placeholders = itemIds.map(() => '?').join(',');
    const rows = await dbAll(
      `SELECT * FROM clothing_items WHERE id IN (${placeholders}) AND user_id = ?`,
      [...itemIds, user.uid]
    );
    if (rows.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Not enough of those items are yours to render.' },
        { status: 404 }
      );
    }
    const items = rows.map(mapClothingItem) as unknown as IClothingItem[];

    const visual = await generateOutfitVisual(items, { occasion });
    const buffer = Buffer.from(visual.imageBase64, 'base64');
    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Image model returned an empty image.' },
        { status: 502 }
      );
    }

    const key = buildR2Key(user.uid, visual.mimeType || 'image/png', 'visuals');
    await r2Put(key, buffer, visual.mimeType || 'image/png');
    const url = r2PublicUrl(key);

    const id = randomUUID();
    await dbFirst(
      `INSERT INTO outfit_visuals
        (id, user_id, recommendation_id, preview_urls, job_status, item_ids, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        id,
        user.uid,
        recommendationId === null || recommendationId === undefined ? null : String(recommendationId),
        toJson([url]),
        'completed',
        toJson(itemIds.map(String)),
        nowIso(),
        nowIso(),
      ]
    );

    return NextResponse.json({ success: true, data: { id, url } });
  } catch (error) {
    logger.error('Error rendering outfit visual', { error });
    const message = error instanceof Error ? error.message : 'Failed to render look';
    const status = /at least 2|GEMINI_API_KEY|not configured/i.test(message) ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
