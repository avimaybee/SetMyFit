/**
 * Cloudflare R2 access (server-only) via the S3-compatible API.
 * Works on Cloudflare Pages (secrets) and in plain `next dev`.
 * Images are stored in a PUBLIC bucket/directory; DB rows keep the full URL.
 */
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export function r2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

let s3: S3Client | null = null;

function s3Client(): S3Client | null {
  if (s3) return s3;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3;
}

export function r2Bucket(): string {
  return process.env.R2_BUCKET || 'setmyfit-images';
}

export function r2PublicUrl(key: string): string {
  const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/${key}`;
}

/** Extract the R2 object key from a public URL (null for legacy/foreign URLs). */
export function r2KeyFromUrl(url: string): string | null {
  try {
    const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (base && url.startsWith(`${base}/`)) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
    return null;
  } catch {
    return null;
  }
}

export async function r2Put(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
  const client = s3Client();
  if (!client) throw new Error('R2 is not configured (CLOUDFLARE_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)');
  await client.send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    })
  );
}

export async function r2Delete(key: string): Promise<void> {
  const client = s3Client();
  if (!client) throw new Error('R2 is not configured');
  await client.send(new DeleteObjectCommand({ Bucket: r2Bucket(), Key: key }));
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export function buildR2Key(userId: string, mimeType: string): string {
  const ext = EXT_BY_MIME[mimeType] || 'jpg';
  const rand = Math.random().toString(36).substring(2, 9);
  return `wardrobe/${userId}/${Date.now()}-${rand}.${ext}`;
}
