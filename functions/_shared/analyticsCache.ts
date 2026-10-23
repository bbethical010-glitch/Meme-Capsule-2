/**
 * Analytics KV Cache Helpers
 *
 * Read/write/bust helpers for Cloudflare KV caching of analytics responses.
 * TTL constants match the spec requirements.
 */

// ────────────────────────────────────────────────────────────
// TTL Constants (in seconds)
// ────────────────────────────────────────────────────────────

/** Cache for /api/admin/analytics/overview */
export const OVERVIEW_TTL = 900; // 15 minutes

/** Cache for /api/admin/analytics/rankings (keyed by params) */
export const RANKINGS_TTL = 900; // 15 minutes

/** Cache for /api/admin/analytics/insights */
export const INSIGHTS_TTL = 1800; // 30 minutes

/** Cache for /api/admin/analytics/trends */
export const TRENDS_TTL = 900; // 15 minutes
export const ANDROID_ANALYTICS_TTL = 60; // 1 minute

// No TTL for /api/admin/analytics/meme/:memeId — always fresh

// ────────────────────────────────────────────────────────────
// Cache Key Builders
// ────────────────────────────────────────────────────────────

export const CACHE_PREFIX = "analytics:";

export const overviewCacheKey = (): string =>
  `${CACHE_PREFIX}overview`;

export const rankingsCacheKey = (params: {
  sort_by: string;
  order: string;
  page: number;
  per_page: number;
  min_views: number;
}): string =>
  `${CACHE_PREFIX}rankings:${params.sort_by}:${params.order}:${params.page}:${params.per_page}:${params.min_views}`;

export const insightsCacheKey = (): string =>
  `${CACHE_PREFIX}insights`;

export const trendsCacheKey = (days: number): string =>
  `${CACHE_PREFIX}trends:${days}`;

export const androidAnalyticsCacheKey = (name: string, params = ""): string =>
  `${CACHE_PREFIX}android:${name}${params ? `:${params}` : ""}`;

// ────────────────────────────────────────────────────────────
// Cache Operations
// ────────────────────────────────────────────────────────────

/**
 * Read a cached value from KV. Returns null if not found or expired.
 */
export const getCached = async <T>(
  kv: KVNamespace,
  key: string
): Promise<T | null> => {
  try {
    const raw = await kv.get(key, "text");
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Write a value to KV cache with a TTL in seconds.
 */
export const setCache = async (
  kv: KVNamespace,
  key: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> => {
  try {
    await kv.put(key, JSON.stringify(data), {
      expirationTtl: ttlSeconds
    });
  } catch {
    // Cache write failure is non-fatal — log and continue
    console.error(`Cache write failed for key: ${key}`);
  }
};

/**
 * Bust all cached keys matching a prefix.
 * KV doesn't support prefix deletion natively, so we delete known keys.
 */
export const bustAnalyticsCache = async (kv: KVNamespace): Promise<void> => {
  const knownKeys = [
    overviewCacheKey(),
    insightsCacheKey(),
    // Bust trend caches for common day ranges
    trendsCacheKey(7),
    trendsCacheKey(30),
    trendsCacheKey(90)
  ];

  // Rankings cache has many permutations — list and delete
  try {
    const listed = await kv.list({ prefix: `${CACHE_PREFIX}rankings:` });
    for (const key of listed.keys) {
      knownKeys.push(key.name);
    }
  } catch {
    // Listing may fail on free tier — that's ok
  }

  try {
    const listed = await kv.list({ prefix: `${CACHE_PREFIX}android:` });
    for (const key of listed.keys) knownKeys.push(key.name);
  } catch {
    // Listing may fail on free tier; expiration still bounds stale data.
  }

  await Promise.allSettled(
    knownKeys.map((key) => kv.delete(key))
  );
};
