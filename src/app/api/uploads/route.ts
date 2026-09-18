import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized } from '@/lib/auth';
import { buildR2Key, getR2PublicUrl, isR2Configured, r2Put } from '@/lib/r2';
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

  const configured = await isR2Configured();

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

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!configured) {
      logger.warn('Upload attempted without R2 configuration — using data URL fallback');
      const dataUrl = `data:${file.type || 'image/jpeg'};base64,${buffer.toString('base64')}`;
      return NextResponse.json({ success: true, url: dataUrl, key: 'inline' });
    }

    const key = buildR2Key(user.uid, file.type || 'image/jpeg');
    await r2Put(key, buffer, file.type || 'image/jpeg');
    const publicUrl = await getR2PublicUrl(key);

    return NextResponse.json({ success: true, url: publicUrl, key });
  } catch (error) {
    logger.error('Error uploading to R2', { error });
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}
