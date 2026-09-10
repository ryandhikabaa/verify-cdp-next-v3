interface RateLimitOptions {
  max: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
const rateLimitStore: Map<string, RateLimitEntry> = new Map();

export function rateLimit(identifier: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  // Reset if window has expired
  if (!existing || existing.resetTime <= now) {
    const newEntry: RateLimitEntry = {count: 1, resetTime: now + options.windowMs};
    rateLimitStore.set(identifier, newEntry);
    return {
      success: true,
      limit: options.max,
      remaining: options.max - 1,
      reset: newEntry.resetTime,
    };
  }

  // Check if limit exceeded
  if (existing.count >= options.max) {
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      reset: existing.resetTime,
    };
  }

  // Increment counter
  existing.count += 1;
  rateLimitStore.set(identifier, existing);
  return {
    success: true,
    limit: options.max,
    remaining: options.max - existing.count,
    reset: existing.resetTime,
  };
}
