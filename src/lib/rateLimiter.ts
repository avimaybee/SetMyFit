/**
 * Gemini call wrapper — 429/5xx-aware retry with exponential backoff + jitter.
 *
 * Replaces the old preemptive in-memory rate limiter, which is wrong on
 * serverless (per-isolate counters = no real limiting) and burns billable
 * CPU time by sleeping inside workers. Now we just call the API and back
 * off only when it actually tells us to slow down.
 */

export interface GeminiRetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}

const DEFAULTS = {
  maxRetries: 2,
  initialDelayMs: 1000,
  maxDelayMs: 15000,
  timeoutMs: 30000,
} as const;

/** True for errors worth retrying: 429, 5xx, timeouts, network blips. */
export function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { status?: unknown; code?: unknown; name?: unknown; message?: unknown };

  if (typeof err.status === 'number' && (err.status === 429 || err.status >= 500)) return true;
  // @google/genai ApiError also exposes numeric `code`
  if (typeof err.code === 'number' && (err.code === 429 || err.code >= 500)) return true;

  const name = String(err.name ?? '');
  const message = String(err.message ?? '').toLowerCase();
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  if (/(fetch failed|network|econnreset|etimedout|socket hang up|429|rate limit|overloaded|unavailable)/.test(message)) {
    return true;
  }
  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Race a promise against a timeout (named AbortError-style so retries catch it). */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Gemini request'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      error.name = 'TimeoutError';
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function withGeminiRetry<T>(
  fn: () => Promise<T>,
  options: GeminiRetryOptions = {}
): Promise<T> {
  const { maxRetries, initialDelayMs, maxDelayMs, timeoutMs } = { ...DEFAULTS, ...options };
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = Math.random() * 500;
      console.warn(`[Gemini] retry ${attempt}/${maxRetries} after ${Math.round(backoff + jitter)}ms`);
      await sleep(backoff + jitter);
    }
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) break;
      console.warn('[Gemini] retryable error:', error instanceof Error ? error.message : String(error));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
