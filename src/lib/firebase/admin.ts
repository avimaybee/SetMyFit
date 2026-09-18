/**
 * Firebase ID Token verification (server-only).
 *
 * Primary verification: Native Web Crypto (jose) against Google's public JWKS.
 *   - Follows official Firebase specifications: checks RS256 signature,
 *     key ID (kid), issuer (https://securetoken.google.com/<projectId>),
 *     audience (<projectId>), and expiration.
 *   - Edge-native: Works instantly in Cloudflare Workers with ZERO private keys/secrets!
 *
 * Fallback: firebase-admin SDK if service account credentials are provided.
 */
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { serverEnv } from '@/lib/serverEnv';

export interface VerifiedUser {
  uid: string;
  email?: string;
  phone?: string;
  isAnonymous?: boolean;
  provider?: string;
}

// Google's public JWKS for Firebase Auth tokens
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function getProjectId(): Promise<string> {
  const envVal =
    (await serverEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID')) ||
    (await serverEnv('FIREBASE_PROJECT_ID')) ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;
  return envVal || 'setmyfit-auth';
}

/** Verify ID token using Google's public JWKS certificates */
export async function verifyWithJwks(token: string): Promise<VerifiedUser | null> {
  try {
    const projectId = await getProjectId();
    const { payload } = await jwtVerify(token, GOOGLE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (!payload.sub) return null;

    const fb = payload.firebase as { sign_in_provider?: string } | undefined;
    const provider = fb?.sign_in_provider || 'password';

    return {
      uid: payload.sub,
      email: (payload.email as string) || undefined,
      phone: (payload.phone_number as string) || undefined,
      isAnonymous: provider === 'anonymous',
      provider,
    };
  } catch (err) {
    console.warn('[Firebase JWKS] Verification failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// firebase-admin fallback (optional, only if service account is configured)
// ---------------------------------------------------------------------------
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
  if (!config) return null;

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

/**
 * Universal verifyIdToken:
 * 1. Checks with Google JWKS (zero credentials required).
 * 2. Falls back to firebase-admin if available.
 */
export async function verifyIdToken(token: string): Promise<VerifiedUser | null> {
  // Try fast, edge-native JWKS verification first
  const jwksUser = await verifyWithJwks(token);
  if (jwksUser) return jwksUser;

  // Fallback to admin SDK if service account is set up
  try {
    const app = await adminApp();
    if (app) {
      const decoded = await getAuth(app).verifyIdToken(token);
      return {
        uid: decoded.uid,
        email: decoded.email,
        phone: decoded.phone_number,
        isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous',
        provider: decoded.firebase?.sign_in_provider,
      };
    }
  } catch (error) {
    console.error('[Firebase Admin] Fallback verification failed:', error);
  }

  return null;
}
