import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge-safe session gate. Firebase ID tokens are verified in API routes
 * (firebase-admin, Node runtime); here we only check cookie presence.
 * Full verification + onboarding redirect happen client-side in MainLayout.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API routes authenticate themselves (JSON 401) — never redirect them.
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const session = request.cookies.get('__session')?.value;
  const url = request.nextUrl.clone();
  const isAuthPage = url.pathname.startsWith('/auth');

  // Unauthenticated users go to sign-in (no exceptions: the onboarding
  // page requires a Firebase user, so gating it here avoids a flash).
  if (!session && !isAuthPage) {
    url.pathname = '/auth/sign-in';
    return NextResponse.redirect(url);
  }

  // Authenticated users shouldn't see auth pages
  if (session && isAuthPage) {
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2)).*)',
  ],
};
