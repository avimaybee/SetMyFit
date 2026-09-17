import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken } from '@/lib/firebase/admin';

const COOKIE = '__session';

/**
 * POST /api/auth/session
 * Verifies the Firebase ID token and stores it in an httpOnly cookie
 * so middleware / plain fetches can see the session.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const idToken = (body as { idToken?: string })?.idToken;
    if (!idToken) {
      return NextResponse.json({ success: false, error: 'idToken is required' }, { status: 400 });
    }
    const user = await verifyIdToken(idToken);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    const res = NextResponse.json({ success: true });
    res.cookies.set(COOKIE, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 5,
    });
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create session' }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/session — clear the session cookie (logout).
 */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
