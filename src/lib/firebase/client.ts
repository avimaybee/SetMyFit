'use client';

/**
 * Firebase client (browser) — email/password auth + ID tokens.
 * All API calls go through apiFetch (@/lib/api) which attaches the token.
 *
 * Config resolution (in order):
 *  1. NEXT_PUBLIC_FIREBASE_* baked at build time (when present)
 *  2. GET /api/config/firebase at runtime (reads live server env —
 *     this is what makes Cloudflare dashboard Variables work without
 *     a rebuild)
 */
import { useEffect, useState } from 'react';
import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';

let app: FirebaseApp | null = null;
let runtimeConfig: FirebaseOptions | null = null;
let runtimeConfigPromise: Promise<FirebaseOptions | null> | null = null;

function buildTimeConfig(): FirebaseOptions | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId,
  };
}

/** Resolve the web config, preferring build-time values, else the runtime endpoint. */
export async function getFirebaseConfig(): Promise<FirebaseOptions | null> {
  const built = buildTimeConfig();
  if (built) return built;
  if (runtimeConfig) return runtimeConfig;
  if (!runtimeConfigPromise) {
    runtimeConfigPromise = fetch('/api/config/firebase')
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        if (!json?.success || !json.data?.apiKey) return null;
        return json.data as FirebaseOptions;
      })
      .catch(() => null);
  }
  const cfg = await runtimeConfigPromise;
  if (cfg) runtimeConfig = cfg;
  return cfg;
}

/** Synchronously true only once a config is definitively available. */
export function isFirebaseConfigured(): boolean {
  return buildTimeConfig() !== null || runtimeConfig !== null;
}

/** React hook: 'loading' while the runtime endpoint is tried, then 'ready'/'missing'. */
export function useFirebaseConfig(): 'loading' | 'ready' | 'missing' {
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>(() =>
    buildTimeConfig() || runtimeConfig ? 'ready' : 'loading'
  );

  useEffect(() => {
    let cancelled = false;
    if (buildTimeConfig() || runtimeConfig) {
      setStatus('ready');
      return;
    }
    getFirebaseConfig().then((cfg) => {
      if (!cancelled) setStatus(cfg ? 'ready' : 'missing');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}

export async function firebaseApp(): Promise<FirebaseApp> {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  const cfg = await getFirebaseConfig();
  if (!cfg) {
    throw new Error(
      'Firebase is not configured (no build-time or runtime config). ' +
        'Set the NEXT_PUBLIC_FIREBASE_* variables and redeploy.'
    );
  }
  app = initializeApp(cfg);
  return app;
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getAuth(await firebaseApp()), email, password);
  return cred.user;
}

export async function signUp(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getAuth(await firebaseApp()), email, password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getAuth(await firebaseApp()));
}

/** Current user's ID token (null when signed out). */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const user = getAuth(await firebaseApp()).currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  try {
    return getAuth(await firebaseApp()).currentUser;
  } catch {
    return null;
  }
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  let unsubscribe: (() => void) | undefined;
  let cancelled = false;
  // firebaseApp() is async (may fetch runtime config); subscribe when ready.
  // ConfigError screen owns the missing-config case, so swallow here.
  firebaseApp()
    .then((appInstance) => {
      if (!cancelled) unsubscribe = onAuthStateChanged(getAuth(appInstance), cb);
    })
    .catch(() => undefined);
  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

/** Persist the Firebase session into the httpOnly __session cookie (for middleware). */
export async function persistSession(): Promise<{ ok: boolean; error?: string }> {
  const token = await getIdToken();
  if (!token) return { ok: false, error: 'Could not obtain user ID token from Firebase.' };
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: json?.error || 'Session creation failed on server.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error creating session.' };
  }
}

export async function clearSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
}
