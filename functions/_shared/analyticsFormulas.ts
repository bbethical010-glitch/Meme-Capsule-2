/**
 * Analytics Formulas Module
 *
 * Pure functions for computing all derived analytics metrics.
 * Every computed field in meme_analytics is calculated here.
 * These functions are used by the aggregation worker and can be tested independently.
 *
 * All formulas match the spec exactly:
 *   - Engagement Score: weighted sum of normalised interaction rates (0–100)
 *   - Virality Score:   organic spread potential (0–100+)
 *   - Retention Score:  attention retention quality (0–100)
 *   - Trending Score:   recency-weighted engagement with exponential decay
 *   - Rates:            event_count / max(view_count, 1), clamped 0–1
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface RawMemeAggregation {
  meme_id: string;
  views: number;
  likes: number;
  unlikes: number;
  shares: number;
  downloads: number;
  skips: number;
  long_views: number;
  re_fetches: number;
  avg_time_ms: number | null;
  max_time_ms: number;
  unique_viewers: number;
  first_seen: number | null;
  last_seen: number | null;
}

export interface ComputedMetrics {
  view_count: number;
  unique_viewer_count: number;
  like_count: number;
  unlike_count: number;
  net_like_count: number;
  share_count: number;
  download_count: number;
  skip_count: number;
  long_view_count: number;
  re_fetch_count: number;
  avg_time_on_meme_ms: number;
  max_time_on_meme_ms: number;
  engagement_score: number;
  virality_score: number;
  retention_score: number;
  skip_rate: number;
  like_rate: number;
  share_rate: number;
  download_rate: number;
  trending_score: number;
  first_seen_at: number | null;
  last_seen_at: number | null;
  last_aggregated_at: number;
}

// ────────────────────────────────────────────────────────────
// Rate Functions
// ────────────────────────────────────────────────────────────

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export const skipRate = (skipCount: number, viewCount: number): number =>
  clamp01(skipCount / Math.max(viewCount, 1));

export const likeRate = (likeCount: number, viewCount: number): number =>
  clamp01(likeCount / Math.max(viewCount, 1));

export const shareRate = (shareCount: number, viewCount: number): number =>
  clamp01(shareCount / Math.max(viewCount, 1));

export const downloadRate = (downloadCount: number, viewCount: number): number =>
  clamp01(downloadCount / Math.max(viewCount, 1));

const longViewRate = (longViewCount: number, viewCount: number): number =>
  clamp01(longViewCount / Math.max(viewCount, 1));

const reFetchRate = (reFetchCount: number, viewCount: number): number =>
  clamp01(reFetchCount / Math.max(viewCount, 1));

// ────────────────────────────────────────────────────────────
// Composite Score Functions
// ────────────────────────────────────────────────────────────

/**
 * Engagement Score — primary composite ranking metric.
 * Weighted sum of normalised interaction rates × 100.
 *
 * engagement_score = (like_rate × 0.30) + (share_rate × 0.25)
 *                  + (download_rate × 0.20) + (long_view_rate × 0.15)
 *                  + (re_fetch_rate × 0.10)
 */
export const engagementScore = (
  likes: number,
  shares: number,
  downloads: number,
  longViews: number,
  reFetches: number,
  views: number
): number => {
  const lr = likeRate(likes, views);
  const sr = shareRate(shares, views);
  const dr = downloadRate(downloads, views);
  const lvr = longViewRate(longViews, views);
  const rfr = reFetchRate(reFetches, views);
  return (lr * 0.30 + sr * 0.25 + dr * 0.20 + lvr * 0.15 + rfr * 0.10) * 100;
};

/**
 * Virality Score — organic spread potential.
 *
 * virality_score = ((share_count × 3) + (download_count × 2) + (like_count × 1))
 *                  / max(view_count, 1) × 100
 */
export const viralityScore = (
  shares: number,
  downloads: number,
  likes: number,
  views: number
): number => {
  return ((shares * 3 + downloads * 2 + likes * 1) / Math.max(views, 1)) * 100;
};

/**
 * Retention Score — how well a meme holds user attention.
 *
 * retention_score = (avg_time_on_meme_ms / 15000) × (1 - skip_rate) × 100
 * Clamped to 0–100. 15000ms = "full attention" baseline.
 */
export const retentionScore = (
  avgTimeMs: number,
  skips: number,
  views: number
): number => {
  const sr = skipRate(skips, views);
  const raw = (avgTimeMs / 15000) * (1 - sr) * 100;
  return Math.max(0, Math.min(100, raw));
};

/**
 * Trending Score — recency-weighted engagement.
 *
 * trending_score = engagement_score × decay_factor
 * decay_factor = e^(-λ × hours_since_last_seen)
 * λ = 0.005  → score halves roughly every 6 days of inactivity
 */
export const trendingScore = (
  engScore: number,
  lastSeenTimestamp: number | null,
  nowMs: number
): number => {
  if (!lastSeenTimestamp) return 0;
  const hoursSinceLastSeen = (nowMs - lastSeenTimestamp) / (1000 * 60 * 60);
  const lambda = 0.005;
  const decayFactor = Math.exp(-lambda * Math.max(0, hoursSinceLastSeen));
  return engScore * decayFactor;
};

// ────────────────────────────────────────────────────────────
// Full Computation
// ────────────────────────────────────────────────────────────

/**
 * Compute all derived metrics from raw aggregation data.
 */
export const computeAllMetrics = (raw: RawMemeAggregation): ComputedMetrics => {
  const nowMs = Date.now();
  const avgTime = raw.avg_time_ms ?? 0;

  const engagement = engagementScore(
    raw.likes, raw.shares, raw.downloads,
    raw.long_views, raw.re_fetches, raw.views
  );

  return {
    view_count: raw.views,
    unique_viewer_count: raw.unique_viewers,
    like_count: raw.likes,
    unlike_count: raw.unlikes,
    net_like_count: Math.max(0, raw.likes - raw.unlikes),
    share_count: raw.shares,
    download_count: raw.downloads,
    skip_count: raw.skips,
    long_view_count: raw.long_views,
    re_fetch_count: raw.re_fetches,
    avg_time_on_meme_ms: avgTime,
    max_time_on_meme_ms: raw.max_time_ms,
    engagement_score: engagement,
    virality_score: viralityScore(raw.shares, raw.downloads, raw.likes, raw.views),
    retention_score: retentionScore(avgTime, raw.skips, raw.views),
    skip_rate: skipRate(raw.skips, raw.views),
    like_rate: likeRate(raw.likes, raw.views),
    share_rate: shareRate(raw.shares, raw.views),
    download_rate: downloadRate(raw.downloads, raw.views),
    trending_score: trendingScore(engagement, raw.last_seen, nowMs),
    first_seen_at: raw.first_seen,
    last_seen_at: raw.last_seen,
    last_aggregated_at: nowMs
  };
};

/**
 * Assign rank values to an array of memes sorted by a given metric.
 * Rank 1 = best. Mutates the input array's rank fields.
 */
export interface RankedMeme extends ComputedMetrics {
  meme_id: string;
  overall_rank: number;
  like_rank: number;
  share_rank: number;
  virality_rank: number;
  retention_rank: number;
  engagement_rank: number;
  trending_rank: number;
}

export const assignRanks = (memes: (ComputedMetrics & { meme_id: string })[]): RankedMeme[] => {
  const ranked: RankedMeme[] = memes.map((m) => ({
    ...m,
    overall_rank: 0,
    like_rank: 0,
    share_rank: 0,
    virality_rank: 0,
    retention_rank: 0,
    engagement_rank: 0,
    trending_rank: 0
  }));

  const sortAndAssign = (
    arr: RankedMeme[],
    key: keyof ComputedMetrics,
    rankKey: keyof RankedMeme
  ): void => {
    const sorted = [...arr].sort(
      (a, b) => (b[key] as number) - (a[key] as number)
    );
    const idToRank = new Map<string, number>();
    sorted.forEach((m, i) => idToRank.set(m.meme_id, i + 1));
    for (const m of arr) {
      Object.assign(m, { [rankKey]: idToRank.get(m.meme_id) ?? arr.length });
    }
  };

  sortAndAssign(ranked, "engagement_score", "engagement_rank");
  sortAndAssign(ranked, "engagement_score", "overall_rank");
  sortAndAssign(ranked, "like_count", "like_rank");
  sortAndAssign(ranked, "share_count", "share_rank");
  sortAndAssign(ranked, "virality_score", "virality_rank");
  sortAndAssign(ranked, "retention_score", "retention_rank");
  sortAndAssign(ranked, "trending_score", "trending_rank");

  return ranked;
};
