import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/config/firebase
 * Public Firebase *web* config (client SDK keys). These values ship inside
 * the client JS bundle anyway, so exposing them is safe — this just lets the
 * browser fetch them at RUNTIME instead of requiring build-time inlining.
 * Reads server env, which on Cloudflare Workers includes dashboard
 * Variables (runtime), unlike NEXT_PUBLIC_* inlining during `next build`.
 */
export async function GET() {
  const data = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };

  if (!data.apiKey || !data.authDomain || !data.projectId || !data.appId) {
    return NextResponse.json(
      { success: false, error: 'Firebase web config is not set on the server.' },
      { status: 503 }
    );
  }

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
