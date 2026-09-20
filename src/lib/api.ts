'use client';

/**
 * Authenticated fetch wrapper — attaches the Firebase ID token.
 * Retries once with a force-refreshed token on 401.
 */
import { getIdToken } from './firebase/client';
import { clientLogger } from './clientLogger';

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  let bodyPreview: unknown = undefined;
  if (init.body && typeof init.body === 'string') {
    try {
      bodyPreview = JSON.parse(init.body);
    } catch {
      bodyPreview = init.body.slice(0, 100);
    }
  }

  clientLogger.network.request(method, path, bodyPreview);

  const doFetch = async (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(path, { ...init, headers });
  };

  try {
    let res = await doFetch(await getIdToken());
    if (res.status === 401) {
      clientLogger.auth.warn('Received 401, refreshing Firebase ID token...');
      const fresh = await getIdToken(true);
      res = await doFetch(fresh);
    }

    const duration = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
    clientLogger.network.response(method, path, res.status, undefined, duration);
    return res;
  } catch (fetchErr) {
    clientLogger.network.error(method, path, fetchErr);
    throw fetchErr;
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  return (await res.json()) as T;
}

