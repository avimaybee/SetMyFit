import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Read a server-side env var reliably in every runtime.
 *
 * Why this exists: Next.js statically INLINES `process.env.NEXT_PUBLIC_*`
 * at build time (server bundles included), so reading those names via
 * process.env on Cloudflare always returns the build-time value — usually
 * empty. Accessing the same names through the Cloudflare request-scoped
 * env object is fully dynamic and immune to inlining.
 *
 * Order: Cloudflare request env (production truth: dashboard Variables
 * AND Secrets) -> process.env (local `next dev` via .env.local).
 */
export async function getCloudflareEnv(): Promise<Record<string, unknown> | null> {
  try {
    const ctx = await getCloudflareContext();
    return (ctx?.env as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function serverEnv(name: string): Promise<string> {
  try {
    const env = await getCloudflareEnv();
    if (env) {
      const candidates = [name, name.toUpperCase(), name.toLowerCase()];
      for (const key of candidates) {
        const value = env[key];
        if (value !== undefined && value !== null && value !== '') {
          return String(value);
        }
      }
    }
  } catch {
    // Not running on Cloudflare (local dev) — fall through to process.env.
  }
  return process.env[name] || process.env[name.toUpperCase()] || process.env[name.toLowerCase()] || '';
}
