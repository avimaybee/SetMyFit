'use client';

/**
 * Firebase client (browser) — email/password auth + ID tokens.
 * All API calls go through apiFetch (@/lib/api) which attaches the token.
 */
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';

let app: FirebaseApp | null = null;

export function firebaseApp(): FirebaseApp {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }
  app = initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return app;
}

export async function signIn(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getAuth(firebaseApp()), email, password);
  return cred.user;
}

export async function signUp(email: string, password: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getAuth(firebaseApp()), email, password);
  return cred.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(getAuth(firebaseApp()));
}

/** Current user's ID token (null when signed out). */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const user = getAuth(firebaseApp()).currentUser;
    if (!user) return null;
    return await user.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function currentUser(): Promise<User | null> {
  try {
    return getAuth(firebaseApp()).currentUser;
  } catch {
    return null;
  }
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuth(firebaseApp()), cb);
}

/** Persist the Firebase session into the httpOnly __session cookie (for middleware). Returns true when the cookie was set. */
export async function persistSession(): Promise<boolean> {
  const token = await getIdToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function clearSession(): Promise<void> {
  await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => undefined);
}
