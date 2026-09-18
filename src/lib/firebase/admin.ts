/**
 * Firebase Admin (server-only) — verifies Firebase ID tokens.
 * Lazy init: missing env vars warn instead of throwing at import/build time.
 * Reads via serverEnv() (Cloudflare request-scoped env + process.env fallback).
 */
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { serverEnv } from '@/lib/serverEnv';

export async function getAdminConfig() {
  const [projectId, clientEmail, privateKey] = await Promise.all([
    serverEnv('FIREBASE_PROJECT_ID'),
    serverEnv('FIREBASE_CLIENT_EMAIL'),
    serverEnv('FIREBASE_PRIVATE_KEY'),
  ]);
  const pId = projectId || process.env.FIREBASE_PROJECT_ID || '';
  const email = clientEmail || process.env.FIREBASE_CLIENT_EMAIL || '';
  const key = privateKey || process.env.FIREBASE_PRIVATE_KEY || '';
  if (!pId || !email || !key) return null;
  return { projectId: pId, clientEmail: email, privateKey: key };
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
  );
}

let cachedApp: App | null = null;

async function adminApp(): Promise<App | null> {
  if (cachedApp) return cachedApp;
  if (getApps().length > 0) {
    cachedApp = getApps()[0];
    return cachedApp;
  }
  const config = await getAdminConfig();
  if (!config) {
    console.warn('Warning: Firebase Admin env vars are not set (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)');
    return null;
  }
  const privateKey = config.privateKey.replace(/\\n/g, '\n');
  cachedApp = initializeApp({
    credential: cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
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
    const app = await adminApp();
    if (!app) {
      console.warn('[Firebase Admin] Cannot verify token because Firebase Admin credentials are not configured.');
      return null;
    }
    const decoded = await getAuth(app).verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch (error) {
    console.error('[Firebase Admin] Failed to verify ID token:', error);
    return null;
  }
}
