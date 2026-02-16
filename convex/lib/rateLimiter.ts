import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Rate limit configurations per API
export const RATE_LIMITS = {
  companies_house: {
    requestsPerWindow: 600, // Companies House allows 600 requests per 5 minutes
    windowMs: 5 * 60 * 1000, // 5 minutes
    retryAfterMs: 1000, // Wait 1 second between retries
  },
  exa: {
    requestsPerWindow: 100, // Exa.ai rate limit (adjust based on your plan)
    windowMs: 60 * 1000, // 1 minute
    retryAfterMs: 2000,
  },
  resend: {
    requestsPerWindow: 10, // Resend free tier: 100/day, we'll be conservative
    windowMs: 60 * 1000, // 1 minute
    retryAfterMs: 5000,
  },
  apollo: {
    requestsPerWindow: 50, // Apollo.io rate limit (adjust based on your plan)
    windowMs: 60 * 1000, // 1 minute
    retryAfterMs: 3000,
  },
  hunter: {
    requestsPerWindow: 25, // Hunter.io rate limit
    windowMs: 60 * 1000, // 1 minute
    retryAfterMs: 3000,
  },
} as const;

export type ApiName = keyof typeof RATE_LIMITS;

// Check if we can make a request (doesn't consume the limit)
export async function canMakeRequest(
  ctx: QueryCtx,
  userId: string,
  apiName: ApiName
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const config = RATE_LIMITS[apiName];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const rateLimit = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_and_api", (q) =>
      q.eq("userId", userId).eq("apiName", apiName)
    )
    .first();

  if (!rateLimit) {
    return { allowed: true };
  }

  // If window has expired, reset is allowed
  if (rateLimit.windowStart < windowStart) {
    return { allowed: true };
  }

  // Check if under limit
  if (rateLimit.requestCount < config.requestsPerWindow) {
    return { allowed: true };
  }

  // Over limit - calculate retry time
  const retryAfterMs = rateLimit.windowStart + config.windowMs - now;
  return { allowed: false, retryAfterMs };
}

// Record a request (call this after making an API call)
export async function recordRequest(
  ctx: MutationCtx,
  userId: string,
  apiName: ApiName
): Promise<void> {
  const config = RATE_LIMITS[apiName];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_and_api", (q) =>
      q.eq("userId", userId).eq("apiName", apiName)
    )
    .first();

  if (!existing) {
    await ctx.db.insert("rateLimits", {
      userId,
      apiName,
      windowStart: now,
      requestCount: 1,
      lastRequestAt: now,
    });
  } else if (existing.windowStart < windowStart) {
    // Window expired, reset
    await ctx.db.patch(existing._id, {
      windowStart: now,
      requestCount: 1,
      lastRequestAt: now,
    });
  } else {
    // Increment counter
    await ctx.db.patch(existing._id, {
      requestCount: existing.requestCount + 1,
      lastRequestAt: now,
    });
  }
}

// Get current rate limit status for display
export async function getRateLimitStatus(
  ctx: QueryCtx,
  userId: string,
  apiName: ApiName
): Promise<{
  used: number;
  limit: number;
  resetsAt: number;
}> {
  const config = RATE_LIMITS[apiName];
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const rateLimit = await ctx.db
    .query("rateLimits")
    .withIndex("by_user_and_api", (q) =>
      q.eq("userId", userId).eq("apiName", apiName)
    )
    .first();

  if (!rateLimit || rateLimit.windowStart < windowStart) {
    return {
      used: 0,
      limit: config.requestsPerWindow,
      resetsAt: now + config.windowMs,
    };
  }

  return {
    used: rateLimit.requestCount,
    limit: config.requestsPerWindow,
    resetsAt: rateLimit.windowStart + config.windowMs,
  };
}

// Utility to wait with exponential backoff
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry wrapper with exponential backoff
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onError?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    onError,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (onError) {
        onError(lastError, attempt);
      }

      if (attempt === maxAttempts) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelayMs
      );

      await sleep(delay);
    }
  }

  throw lastError;
}
