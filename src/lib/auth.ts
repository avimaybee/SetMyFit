/**
 * Server-side request auth — Firebase ID token via
 * `Authorization: Bearer <token>` (preferred, always fresh) or the
 * httpOnly `__session` cookie (set at login, used by plain fetches).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyIdToken, VerifiedUser } from './firebase/admin';

export type { VerifiedUser };

export async function getAuthUser(request: NextRequest): Promise<VerifiedUser | null> {
  const header = request.headers.get('authorization');
  const bearer = header && header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const cookie = request.cookies.get('__session')?.value ?? null;
  const token = bearer || cookie;
  if (!token) return null;
  return verifyIdToken(token);
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}
