'use client';

/**
 * Authenticated fetch wrapper — attaches the Firebase ID token.
 * Retries once with a force-refreshed token on 401.
 */
import { getIdToken } from './firebase/client';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(path, { ...init, headers });
  };

  let res = await doFetch(await getIdToken());
  if (res.status === 401) {
    const fresh = await getIdToken(true);
    res = await doFetch(fresh);
  }
  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  return (await res.json()) as T;
}
