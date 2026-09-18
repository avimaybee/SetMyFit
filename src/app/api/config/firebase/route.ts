import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/serverEnv';

export const dynamic = 'force-dynamic';

/**
 * GET /api/config/firebase
 * Public Firebase *web* config (client SDK keys). These values ship inside
 * the client JS bundle anyway, so exposing them is safe — this just lets the
 * browser fetch them at RUNTIME instead of requiring build-time inlining.
 *
 * Reads via serverEnv(): Cloudflare request env first (live dashboard
 * Variables — immune to Next's NEXT_PUBLIC_* build inlining), then
 * process.env (local dev).
 */
export async function GET() {
  const [apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId] =
    await Promise.all([
      serverEnv('NEXT_PUBLIC_FIREBASE_API_KEY').then((v) => v || serverEnv('FIREBASE_API_KEY')),
      serverEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN').then((v) => v || serverEnv('FIREBASE_AUTH_DOMAIN')),
      serverEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID').then((v) => v || serverEnv('FIREBASE_PROJECT_ID')),
      serverEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET').then((v) => v || serverEnv('FIREBASE_STORAGE_BUCKET')),
      serverEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID').then((v) => v || serverEnv('FIREBASE_MESSAGING_SENDER_ID')),
      serverEnv('NEXT_PUBLIC_FIREBASE_APP_ID').then((v) => v || serverEnv('FIREBASE_APP_ID')),
    ]);

  if (!apiKey || !authDomain || !projectId || !appId) {
    return NextResponse.json(
      { success: false, error: 'Firebase web config is not set on the server.' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
