/**
 * Cloudflare R2 access (server-only) via the S3-compatible API.
 * Works on Cloudflare Pages (secrets) and in plain `next dev`.
 * Images are stored in a PUBLIC bucket/directory; DB rows keep the full URL.
 */
import { DeleteObjectCommand, GetObjectCommand, GetObjectCommandOutput, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getCloudflareEnv, serverEnv } from './serverEnv';

interface NativeR2ObjectBody {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
    contentDisposition?: string;
  };
  httpEtag?: string;
  size?: number;
}

interface NativeR2Bucket {
  get(key: string): Promise<NativeR2ObjectBody | null>;
  put(key: string, value: unknown, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

export interface R2ObjectData {
  body: ReadableStream | Uint8Array | Buffer | string;
  contentType: string;
  etag?: string;
  size?: number;
}

async function getNativeR2(): Promise<NativeR2Bucket | null> {
  try {
    const env = await getCloudflareEnv();
    if (!env) return null;
    for (const name of ['R2', 'IMAGES', 'BUCKET', 'setmyfit_images', 'SETMYFIT_IMAGES']) {
      const candidate = env[name] as NativeR2Bucket | undefined;
      if (candidate && typeof candidate.put === 'function') {
        return candidate;
      }
    }
  } catch {
    // Not running on Cloudflare
  }
  return null;
}

export function r2Configured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

export async function isR2Configured(): Promise<boolean> {
  const native = await getNativeR2();
  if (native) return true;

  const [accountId, accessKeyId, secretAccessKey, bucket] = await Promise.all([
    serverEnv('CLOUDFLARE_ACCOUNT_ID'),
    serverEnv('R2_ACCESS_KEY_ID'),
    serverEnv('R2_SECRET_ACCESS_KEY'),
    serverEnv('R2_BUCKET'),
  ]);

  return Boolean(
    (accountId || process.env.CLOUDFLARE_ACCOUNT_ID) &&
      (accessKeyId || process.env.R2_ACCESS_KEY_ID) &&
      (secretAccessKey || process.env.R2_SECRET_ACCESS_KEY) &&
      (bucket || process.env.R2_BUCKET)
  );
}

let s3: S3Client | null = null;

async function getS3Client(): Promise<S3Client | null> {
  if (s3) return s3;
  const [accountId, accessKeyId, secretAccessKey] = await Promise.all([
    serverEnv('CLOUDFLARE_ACCOUNT_ID'),
    serverEnv('R2_ACCESS_KEY_ID'),
    serverEnv('R2_SECRET_ACCESS_KEY'),
  ]);
  const aId = accountId || process.env.CLOUDFLARE_ACCOUNT_ID;
  const keyId = accessKeyId || process.env.R2_ACCESS_KEY_ID;
  const secKey = secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
  if (!aId || !keyId || !secKey) return null;

  s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${aId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: keyId, secretAccessKey: secKey },
  });
  return s3;
}

export async function r2BucketName(): Promise<string> {
  const b = await serverEnv('R2_BUCKET');
  return b || process.env.R2_BUCKET || 'setmyfit-images';
}

export function r2Bucket(): string {
  return process.env.R2_BUCKET || 'setmyfit-images';
}

export function r2PublicUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, '');
  const base = (process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '');
  return base ? `${base}/${cleanKey}` : `/api/uploads/${cleanKey}`;
}

export async function getR2PublicUrl(key: string): Promise<string> {
  const cleanKey = key.replace(/^\/+/, '');
  const [url, nextUrl] = await Promise.all([
    serverEnv('R2_PUBLIC_URL'),
    serverEnv('NEXT_PUBLIC_R2_PUBLIC_URL'),
  ]);
  const base = (url || nextUrl || process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '');
  return base ? `${base}/${cleanKey}` : `/api/uploads/${cleanKey}`;
}

/** Extract the R2 object key from a public URL (null for legacy/foreign URLs). */
export function r2KeyFromUrl(url: string): string | null {
  try {
    if (!url) return null;
    const base = (process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').replace(/\/$/, '');
    if (base && url.startsWith(`${base}/`)) {
      return decodeURIComponent(url.slice(base.length + 1));
    }
    if (url.startsWith('/api/uploads/')) {
      return decodeURIComponent(url.slice('/api/uploads/'.length));
    }
    if (url.startsWith('api/uploads/')) {
      return decodeURIComponent(url.slice('api/uploads/'.length));
    }
    if (url.startsWith('/wardrobe/')) {
      return decodeURIComponent(url.slice(1));
    }
    if (url.startsWith('wardrobe/')) {
      return decodeURIComponent(url);
    }
    const match = url.match(/(?:\/|^)(\d+-[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp|gif|avif))$/i);
    if (match) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function r2Get(key: string): Promise<R2ObjectData | null> {
  const cleanKey = key.replace(/^\/+/, '');

  // 1. Try native Cloudflare R2 binding first (fastest, direct edge access)
  const native = await getNativeR2();
  if (native) {
    try {
      let obj = await native.get(cleanKey);
      if (!obj && cleanKey.includes('/')) {
        const basename = cleanKey.split('/').pop();
        if (basename) {
          obj = await native.get(basename);
        }
      }
      if (!obj) return null;

      return {
        body: obj.body,
        contentType: obj.httpMetadata?.contentType || 'image/jpeg',
        etag: obj.httpEtag,
        size: obj.size,
      };
    } catch (err) {
      console.error('[SetMyFit R2] Error reading from native R2:', err);
      return null;
    }
  }

  // 2. Fall back to S3 API client (local dev or outside Workers)
  const client = await getS3Client();
  const bucket = await r2BucketName();
  if (!client) return null;

  try {
    let res: GetObjectCommandOutput | null = null;
    try {
      res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: cleanKey }));
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if ((name === 'NoSuchKey' || name === 'NotFound') && cleanKey.includes('/')) {
        const basename = cleanKey.split('/').pop();
        if (basename) {
          res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: basename }));
        }
      } else {
        throw err;
      }
    }

    if (!res || !('Body' in res) || !res.Body) return null;
    const body = res.Body as { transformToByteArray?: () => Promise<Uint8Array> };
    if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      return {
        body: bytes,
        contentType: ('ContentType' in res ? (res.ContentType as string) : undefined) || 'image/jpeg',
        etag: 'ETag' in res ? (res.ETag as string) : undefined,
        size: 'ContentLength' in res ? (res.ContentLength as number) : undefined,
      };
    }
    return null;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    console.error('[SetMyFit R2] Error reading from S3 client:', err);
    return null;
  }
}

export async function r2Put(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
  // 1. Try native Cloudflare R2 binding first (zero credentials, zero latency)
  const native = await getNativeR2();
  if (native) {
    await native.put(key, body, { httpMetadata: { contentType } });
    return;
  }

  // 2. Fall back to S3 API credentials
  const client = await getS3Client();
  const bucket = await r2BucketName();
  if (!client) {
    throw new Error('R2 is not configured (bind R2 bucket in wrangler.toml or set CLOUDFLARE_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET)');
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    })
  );
}

export async function r2Delete(key: string): Promise<void> {
  const native = await getNativeR2();
  if (native) {
    await native.delete(key);
    return;
  }

  const client = await getS3Client();
  const bucket = await r2BucketName();
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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

