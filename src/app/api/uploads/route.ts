import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { buildR2Key, r2Configured, r2PublicUrl, r2Put } from '@/lib/r2';
import { logger } from '@/lib/logger';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/uploads
 * Authenticated multipart upload (field: `file`) -> Cloudflare R2.
 * Returns a stable public URL stored later via /api/wardrobe.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorized();

  if (!r2Configured()) {
    logger.error('Upload attempted without R2 configuration');
    return NextResponse.json(
      { success: false, error: 'Image storage is not configured. Set R2_* env vars.' },
      { status: 500 }
    );
  }

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'File must be an image' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'Image must be smaller than 5MB' }, { status: 400 });
    }

    const key = buildR2Key(user.uid, file.type || 'image/jpeg');
    const buffer = Buffer.from(await file.arrayBuffer());
    await r2Put(key, buffer, file.type || 'image/jpeg');

    return NextResponse.json({ success: true, url: r2PublicUrl(key), key });
  } catch (error) {
    logger.error('Error uploading to R2', { error });
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
