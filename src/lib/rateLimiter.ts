/**
 * Rate Limiter Utility for API calls
 * Implements a simple sliding window rate limiter
 */

interface RateLimiterConfig {
    maxRequests: number;
    windowMs: number;
}

interface RateLimiterState {
    requests: number[];
}

// In-memory store for rate limiting (per API)
const rateLimiters: Map<string, RateLimiterState> = new Map();

/**
 * Check if a request should be allowed based on rate limit
 * @param key Unique identifier for the rate limiter (e.g., 'gemini', 'openweather')
 * @param config Rate limit configuration
 * @returns Object with allowed status and wait time if not allowed
 */
export function checkRateLimit(
    key: string,
    config: RateLimiterConfig
): { allowed: boolean; waitMs: number; remaining: number } {
    const now = Date.now();

    // Get or create state for this key
    let state = rateLimiters.get(key);
    if (!state) {
        state = { requests: [] };
        rateLimiters.set(key, state);
    }

    // Remove expired requests (outside the window)
    const windowStart = now - config.windowMs;
    state.requests = state.requests.filter(timestamp => timestamp > windowStart);

    // Check if we're at the limit
    if (state.requests.length >= config.maxRequests) {
        const oldestRequest = state.requests[0];
        const waitMs = oldestRequest + config.windowMs - now;
        return {
            allowed: false,
            waitMs: Math.max(0, waitMs),
            remaining: 0
        };
    }

    // Allow the request and record it
    state.requests.push(now);

    return {
        allowed: true,
        waitMs: 0,
        remaining: config.maxRequests - state.requests.length
    };
}

/**
 * Wait for rate limit to clear (async helper)
 */
export async function waitForRateLimit(
    key: string,
    config: RateLimiterConfig
): Promise<void> {
    const result = checkRateLimit(key, config);

    if (!result.allowed && result.waitMs > 0) {
        console.log(`[RateLimit] ${key}: Waiting ${result.waitMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, result.waitMs));
        // Re-check after waiting
        return waitForRateLimit(key, config);
    }
}

// Pre-configured rate limiters for common APIs
export const RATE_LIMITS = {
    gemini: {
        maxRequests: 5,
        windowMs: 60 * 1000, // 5 requests per minute
    },
    openweather: {
        maxRequests: 30,
        windowMs: 60 * 1000, // 30 requests per minute
    },
} as const;

/**
 * Gemini-specific rate limit check
 */
export function checkGeminiRateLimit(): { allowed: boolean; waitMs: number; remaining: number } {
    return checkRateLimit('gemini', RATE_LIMITS.gemini);
}

/**
 * Wait for Gemini rate limit to clear
 */
export async function waitForGeminiRateLimit(): Promise<void> {
    return waitForRateLimit('gemini', RATE_LIMITS.gemini);
}
