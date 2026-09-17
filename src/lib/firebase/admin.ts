/**
 * Firebase Admin (server-only) — verifies Firebase ID tokens.
 * Lazy init: missing env vars warn instead of throwing at import/build time.
 */
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

let cachedApp: App | null = null;

function adminApp(): App | null {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }
  if (!isAdminConfigured()) {
    console.warn('Warning: Firebase Admin env vars are not set (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)');
    return null;
  }
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY as string).replace(/\\n/g, '\n');
  cachedApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
  return cachedApp;
}

export interface VerifiedUser {
  uid: string;
  email?: string;
}

export async function verifyIdToken(token: string): Promise<VerifiedUser | null> {
  try {
    const app = adminApp();
    if (!app) return null;
    const decoded = await getAuth(app).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
