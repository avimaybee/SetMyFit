import { NextRequest, NextResponse } from 'next/server';
import { r2Get } from '@/lib/r2';

export const dynamic = 'force-dynamic';

/**
 * GET /api/uploads/[...key]
 * Streams image objects from Cloudflare R2 directly to the browser.
 * Caches aggressively (1 year immutable) since uploaded filenames contain timestamps and random nonces.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key: keyParts } = await context.params;
    const rawKey = Array.isArray(keyParts) ? keyParts.join('/') : keyParts;
    if (!rawKey) {
      return new NextResponse('Key is required', { status: 400 });
    }

    const key = decodeURIComponent(rawKey);
    const obj = await r2Get(key);

    if (!obj) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const headers = new Headers();
    headers.set('Content-Type', obj.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    if (obj.etag) {
      headers.set('ETag', obj.etag);
    }
    if (obj.size !== undefined) {
      headers.set('Content-Length', String(obj.size));
    }

    return new NextResponse(obj.body as unknown as BodyInit, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[SetMyFit:Uploads] Error serving image:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
