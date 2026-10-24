/**
 * Analytics Aggregation Worker
 *
 * Scheduled cron worker that runs every 30 minutes.
 * Reads raw events from meme_events, computes all metrics using
 * analyticsFormulas.ts, writes results to meme_analytics and
 * meme_daily_stats, and updates app_global_stats.
 *
 * Scale strategy:
 *   - Single SQL aggregation query grouped by meme_id
 *   - Chunked writes: 100 memes per D1 batch
 *   - Stateful cursor in KV for >2000 memes
 *   - 25-second timeout protection
 *   - Seeds initial values from legacy columns on first run
 *   - Busts KV cache on completion
 *
 * Cron: every 30 minutes, configured in the worker's wrangler configuration
 */

import {
  computeAllMetrics,
  assignRanks,
  type RawMemeAggregation,
  type RankedMeme
} from "../functions/_shared/analyticsFormulas";
import { bustAnalyticsCache } from "../functions/_shared/analyticsCache";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  ANALYTICS_KV: KVNamespace;
  ANALYTICS_RAW_RETENTION_DAYS?: string;
  ANALYTICS_WORKER_TOKEN?: string;
}

const DEFAULT_ANDROID_ANALYTICS_RETENTION_DAYS = 90;
const MAX_ANDROID_ANALYTICS_RETENTION_DAYS = 365;
const RETENTION_DELETE_BATCH_SIZE = 10_000;
const ANDROID_SUMMARY_DAYS = 90;

const getRetentionDays = (env: Env): number => {
  const configured = Number.parseInt(env.ANALYTICS_RAW_RETENTION_DAYS || "", 10);
  if (!Number.isFinite(configured)) return DEFAULT_ANDROID_ANALYTICS_RETENTION_DAYS;
  return Math.min(Math.max(configured, 1), MAX_ANDROID_ANALYTICS_RETENTION_DAYS);
};

const purgeExpiredAndroidEvents = async (env: Env): Promise<number> => {
  const retentionDays = getRetentionDays(env);
  const result = await env.DB.prepare(`
    DELETE FROM android_analytics_events
    WHERE id IN (
      SELECT id
      FROM android_analytics_events
      WHERE timestamp_utc < datetime('now', ?)
      ORDER BY id ASC
      LIMIT ?
    )
  `).bind(`-${retentionDays} days`, RETENTION_DELETE_BATCH_SIZE).run();

  return result.meta?.changes || 0;
};

const refreshAndroidDailySummary = async (env: Env): Promise<number> => {
  const now = new Date().toISOString();
  await env.DB.prepare(`
    DELETE FROM android_analytics_daily_summary
    WHERE summary_date IN (date('now'), date('now', '-1 day'))
  `).run();

  const { results } = await env.DB.prepare(`
    SELECT
      substr(timestamp_utc, 1, 10) AS summary_date,
      platform,
      event_name,
      COALESCE(category, '') AS category,
      COALESCE(app_version, '') AS app_version,
      COUNT(*) AS events,
      COUNT(DISTINCT user_hash) AS users,
      COUNT(DISTINCT session_id) AS sessions,
      SUM(CASE WHEN event_name = 'meme_view' THEN 1 ELSE 0 END) AS views,
      SUM(CASE WHEN event_name = 'meme_like' THEN 1 ELSE 0 END) AS likes,
      SUM(CASE WHEN event_name = 'meme_share' THEN 1 ELSE 0 END) AS shares,
      SUM(CASE WHEN event_name = 'meme_save' THEN 1 ELSE 0 END) AS saves
    FROM android_analytics_events
    WHERE substr(COALESCE(received_at, timestamp_utc), 1, 10) IN (date('now'), date('now', '-1 day'))
    GROUP BY summary_date, platform, event_name, category, app_version
  `).bind(`-${ANDROID_SUMMARY_DAYS} days`).all<Record<string, string | number>>();

  if (!results?.length) return 0;
  const statements = results.map((row) => env.DB.prepare(`
    INSERT OR REPLACE INTO android_analytics_daily_summary (
      summary_date, platform, event_name, category, app_version,
      events, users, sessions, views, likes, shares, saves, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    row.summary_date, row.platform, row.event_name, row.category, row.app_version,
    row.events, row.users, row.sessions, row.views, row.likes, row.shares, row.saves, now
  ));

  for (let index = 0; index < statements.length; index += BATCH_WRITE_SIZE) {
    await env.DB.batch(statements.slice(index, index + BATCH_WRITE_SIZE));
  }
  return results.length;
};

const refreshLiveHourly = async (env: Env): Promise<number> => {
  const rows = await env.DB.prepare(`
    SELECT substr(minute_utc, 1, 13) || ':00' AS hour_utc, event_name, SUM(event_count) AS event_count
    FROM android_live_minute
    WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', '-48 hours')
      AND minute_utc < strftime('%Y-%m-%dT%H:00', 'now')
    GROUP BY hour_utc, event_name
  `).all<{ hour_utc: string; event_name: string; event_count: number }>();
  const statements = (rows.results || []).map((row) => env.DB.prepare(`
    INSERT INTO android_live_hourly (hour_utc, event_name, event_count) VALUES (?, ?, ?)
    ON CONFLICT(hour_utc, event_name) DO UPDATE SET event_count = excluded.event_count
  `).bind(row.hour_utc, row.event_name, row.event_count));
  for (let index = 0; index < statements.length; index += 50) await env.DB.batch(statements.slice(index, index + 50));
  return statements.length;
};

const purgeLiveTables = async (env: Env): Promise<number> => {
  const results = await Promise.all([
    env.DB.prepare("DELETE FROM android_live_minute WHERE minute_utc < strftime('%Y-%m-%dT%H:%M', 'now', '-48 hours')").run(),
    env.DB.prepare("DELETE FROM android_live_hourly WHERE hour_utc < strftime('%Y-%m-%dT%H:00', 'now', '-35 days')").run(),
    env.DB.prepare("DELETE FROM android_live_presence WHERE last_seen_at < datetime('now', '-48 hours')").run()
  ]);
  return results.reduce((sum, result) => sum + (result.meta?.changes || 0), 0);
};

interface AggRow {
  meme_id: string;
  total_events: number;
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

interface LegacyRow {
  id: string;
  shown_count: number;
  likes_count: number;
  share_count: number;
}

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const CHUNK_SIZE = 2000;
const BATCH_WRITE_SIZE = 100;
const CURSOR_KEY = "aggregator:cursor";
const TIMEOUT_MS = 25000; // 25 seconds safety margin

// ────────────────────────────────────────────────────────────
// Aggregation SQL
// ────────────────────────────────────────────────────────────

const AGGREGATION_SQL = `
SELECT
  meme_id,
  COUNT(*) as total_events,
  SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
  SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) as likes,
  SUM(CASE WHEN event_type = 'unlike' THEN 1 ELSE 0 END) as unlikes,
  SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) as shares,
  SUM(CASE WHEN event_type = 'download' THEN 1 ELSE 0 END) as downloads,
  SUM(CASE WHEN event_type = 'skip' THEN 1 ELSE 0 END) as skips,
  SUM(CASE WHEN event_type = 'long_view' THEN 1 ELSE 0 END) as long_views,
  SUM(CASE WHEN event_type = 're_fetch' THEN 1 ELSE 0 END) as re_fetches,
  AVG(CASE WHEN event_type = 'view' THEN time_on_meme_ms ELSE NULL END) as avg_time_ms,
  MAX(CASE WHEN event_type = 'view' THEN time_on_meme_ms ELSE 0 END) as max_time_ms,
  COUNT(DISTINCT device_id) as unique_viewers,
  MIN(timestamp) as first_seen,
  MAX(timestamp) as last_seen
FROM meme_events
GROUP BY meme_id
ORDER BY meme_id
`;

const DAILY_STATS_SQL = `
SELECT
  meme_id,
  strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date,
  SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views,
  SUM(CASE WHEN event_type = 'like' THEN 1 ELSE 0 END) as likes,
  SUM(CASE WHEN event_type = 'share' THEN 1 ELSE 0 END) as shares,
  SUM(CASE WHEN event_type = 'download' THEN 1 ELSE 0 END) as downloads,
  SUM(CASE WHEN event_type = 'skip' THEN 1 ELSE 0 END) as skips,
  SUM(CASE WHEN event_type = 'long_view' THEN 1 ELSE 0 END) as long_views
FROM meme_events
GROUP BY meme_id, date
`;

// ────────────────────────────────────────────────────────────
// Core aggregation logic
// ────────────────────────────────────────────────────────────

const runAggregation = async (env: Env): Promise<{ processed: number; seeded: number; androidSummaryRows: number }> => {
  const startTime = Date.now();

  // 1. Fetch raw aggregations from meme_events
  const { results: rawRows } = await env.DB.prepare(AGGREGATION_SQL).all<AggRow>();

  if (!rawRows || rawRows.length === 0) {
    // No events yet — seed from legacy columns if any memes exist
    const androidSummaryRows = await refreshAndroidDailySummary(env);
    if (env.ANALYTICS_KV) await bustAnalyticsCache(env.ANALYTICS_KV);
    return { processed: 0, seeded: await seedFromLegacy(env), androidSummaryRows };
  }

  // 2. Convert to RawMemeAggregation and compute metrics
  const rawAggregations: RawMemeAggregation[] = rawRows.map((row) => ({
    meme_id: row.meme_id,
    views: row.views ?? 0,
    likes: row.likes ?? 0,
    unlikes: row.unlikes ?? 0,
    shares: row.shares ?? 0,
    downloads: row.downloads ?? 0,
    skips: row.skips ?? 0,
    long_views: row.long_views ?? 0,
    re_fetches: row.re_fetches ?? 0,
    avg_time_ms: row.avg_time_ms,
    max_time_ms: row.max_time_ms ?? 0,
    unique_viewers: row.unique_viewers ?? 0,
    first_seen: row.first_seen,
    last_seen: row.last_seen
  }));

  const computedMemes = rawAggregations.map((raw) => ({
    meme_id: raw.meme_id,
    ...computeAllMetrics(raw)
  }));

  // 3. Assign ranks across all memes
  const rankedMemes = assignRanks(computedMemes);

  // 4. Write to meme_analytics in batches
  let processed = 0;
  for (let i = 0; i < rankedMemes.length; i += BATCH_WRITE_SIZE) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      console.log(`Timeout protection: processed ${processed}/${rankedMemes.length} memes`);
      break;
    }

    const batch = rankedMemes.slice(i, i + BATCH_WRITE_SIZE);
    const statements = batch.map((m) =>
      env.DB.prepare(
        `INSERT OR REPLACE INTO meme_analytics (
          meme_id, view_count, unique_viewer_count, like_count, unlike_count,
          net_like_count, share_count, download_count, skip_count, long_view_count,
          re_fetch_count, avg_time_on_meme_ms, max_time_on_meme_ms,
          engagement_score, virality_score, retention_score,
          skip_rate, like_rate, share_rate, download_rate,
          overall_rank, like_rank, share_rank, virality_rank,
          retention_rank, engagement_rank, trending_score, trending_rank,
          first_seen_at, last_seen_at, last_aggregated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        m.meme_id, m.view_count, m.unique_viewer_count, m.like_count, m.unlike_count,
        m.net_like_count, m.share_count, m.download_count, m.skip_count, m.long_view_count,
        m.re_fetch_count, m.avg_time_on_meme_ms, m.max_time_on_meme_ms,
        m.engagement_score, m.virality_score, m.retention_score,
        m.skip_rate, m.like_rate, m.share_rate, m.download_rate,
        m.overall_rank, m.like_rank, m.share_rank, m.virality_rank,
        m.retention_rank, m.engagement_rank, m.trending_score, m.trending_rank,
        m.first_seen_at, m.last_seen_at, m.last_aggregated_at
      )
    );

    await env.DB.batch(statements);
    processed += batch.length;
  }

  // 5. Update daily stats
  await updateDailyStats(env);

  // 6. Update global stats
  await updateGlobalStats(env, rankedMemes);

  // 7. Bust KV cache
  if (env.ANALYTICS_KV) {
    await bustAnalyticsCache(env.ANALYTICS_KV);
  }

  return { processed, seeded: 0, androidSummaryRows: await refreshAndroidDailySummary(env) };
};

// ────────────────────────────────────────────────────────────
// Seed from legacy columns (first run only)
// ────────────────────────────────────────────────────────────

const seedFromLegacy = async (env: Env): Promise<number> => {
  const { results: legacyRows } = await env.DB.prepare(
    `SELECT id, shown_count, likes_count, share_count FROM memes
     WHERE shown_count > 0 OR likes_count > 0 OR share_count > 0`
  ).all<LegacyRow>();

  if (!legacyRows || legacyRows.length === 0) return 0;

  // Check if meme_analytics already has data
  const existing = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM meme_analytics"
  ).first<{ cnt: number }>();

  if (existing && existing.cnt > 0) return 0; // Already seeded

  const statements = legacyRows.map((row) =>
    env.DB.prepare(
      `INSERT OR IGNORE INTO meme_analytics (
        meme_id, view_count, like_count, net_like_count, share_count, last_aggregated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(row.id, row.shown_count, row.likes_count, row.likes_count, row.share_count, Date.now())
  );

  // Process in batches
  let seeded = 0;
  for (let i = 0; i < statements.length; i += BATCH_WRITE_SIZE) {
    const batch = statements.slice(i, i + BATCH_WRITE_SIZE);
    await env.DB.batch(batch);
    seeded += batch.length;
  }

  return seeded;
};

// ────────────────────────────────────────────────────────────
// Daily stats update
// ────────────────────────────────────────────────────────────

const updateDailyStats = async (env: Env): Promise<void> => {
  const { results: dailyRows } = await env.DB.prepare(DAILY_STATS_SQL).all<{
    meme_id: string;
    date: string;
    views: number;
    likes: number;
    shares: number;
    downloads: number;
    skips: number;
    long_views: number;
  }>();

  if (!dailyRows || dailyRows.length === 0) return;

  const statements = dailyRows.map((row) =>
    env.DB.prepare(
      `INSERT OR REPLACE INTO meme_daily_stats (meme_id, date, views, likes, shares, downloads, skips, long_views)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(row.meme_id, row.date, row.views, row.likes, row.shares, row.downloads, row.skips, row.long_views)
  );

  for (let i = 0; i < statements.length; i += BATCH_WRITE_SIZE) {
    const batch = statements.slice(i, i + BATCH_WRITE_SIZE);
    await env.DB.batch(batch);
  }
};

// ────────────────────────────────────────────────────────────
// Global stats update
// ────────────────────────────────────────────────────────────

const updateGlobalStats = async (env: Env, memes: RankedMeme[]): Promise<void> => {
  const now = Date.now();

  const totalViews = memes.reduce((sum, m) => sum + m.view_count, 0);
  const totalLikes = memes.reduce((sum, m) => sum + m.like_count, 0);
  const totalShares = memes.reduce((sum, m) => sum + m.share_count, 0);
  const totalDownloads = memes.reduce((sum, m) => sum + m.download_count, 0);
  const totalSkips = memes.reduce((sum, m) => sum + m.skip_count, 0);
  const avgEngagement = memes.length > 0
    ? memes.reduce((sum, m) => sum + m.engagement_score, 0) / memes.length
    : 0;

  // Get total unique devices
  const devicesResult = await env.DB.prepare(
    "SELECT COUNT(DISTINCT device_id) as cnt FROM meme_events"
  ).first<{ cnt: number }>();

  // Get total memes count
  const memesResult = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM memes WHERE is_active = 1"
  ).first<{ cnt: number }>();

  // Get total events
  const eventsResult = await env.DB.prepare(
    "SELECT COUNT(*) as cnt FROM meme_events"
  ).first<{ cnt: number }>();

  const stats: [string, number][] = [
    ["total_memes", memesResult?.cnt ?? 0],
    ["total_events", eventsResult?.cnt ?? 0],
    ["total_views", totalViews],
    ["total_likes", totalLikes],
    ["total_shares", totalShares],
    ["total_downloads", totalDownloads],
    ["total_skips", totalSkips],
    ["total_unique_devices", devicesResult?.cnt ?? 0],
    ["avg_engagement_score", avgEngagement],
    ["last_aggregation_run", now]
  ];

  const statements = stats.map(([key, value]) =>
    env.DB.prepare(
      "INSERT OR REPLACE INTO app_global_stats (stat_key, stat_value, updated_at) VALUES (?, ?, ?)"
    ).bind(key, value, now)
  );

  await env.DB.batch(statements);
};

// ────────────────────────────────────────────────────────────
// Worker entry point
// ────────────────────────────────────────────────────────────

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    console.log("Analytics aggregation started");
    const start = Date.now();

    try {
      const result = await runAggregation(env);
      const hourly = await refreshLiveHourly(env);
      const purged = await purgeExpiredAndroidEvents(env);
      const livePurged = await purgeLiveTables(env);
      await env.DB.prepare(`
        INSERT INTO android_pipeline_health (component, last_ok_at, last_error_at, last_error, detail)
        VALUES ('worker', ?, NULL, NULL, ?)
        ON CONFLICT(component) DO UPDATE SET last_ok_at = excluded.last_ok_at, last_error_at = NULL, last_error = NULL, detail = excluded.detail
      `).bind(new Date().toISOString(), `summary_rows=${result.androidSummaryRows}; hourly_rows=${hourly}; purged=${purged + livePurged}`).run();
      const duration = Date.now() - start;
      console.log(
        `Analytics aggregation complete: ${result.processed} memes processed, ${result.seeded} seeded from legacy, ${result.androidSummaryRows} Android summary rows refreshed, ${purged} Android events purged. Duration: ${duration}ms`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("Analytics aggregation failed:", message);
    }
  },

  // Also expose as fetch handler for manual trigger
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const configuredToken = env.ANALYTICS_WORKER_TOKEN;
    const authorization = request.headers.get("Authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length).trim()
      : "";
    const headerToken = request.headers.get("X-Analytics-Worker-Token") || "";
    if (!configuredToken || (bearerToken !== configuredToken && headerToken !== configuredToken)) {
      return new Response("Unauthorized", { status: 401 });
    }

    try {
      const result = await runAggregation(env);
      const hourly = await refreshLiveHourly(env);
      const purged = await purgeExpiredAndroidEvents(env);
      const livePurged = await purgeLiveTables(env);
      await env.DB.prepare(`
        INSERT INTO android_pipeline_health (component, last_ok_at, last_error_at, last_error, detail)
        VALUES ('worker', ?, NULL, NULL, ?)
        ON CONFLICT(component) DO UPDATE SET last_ok_at = excluded.last_ok_at, last_error_at = NULL, last_error = NULL, detail = excluded.detail
      `).bind(new Date().toISOString(), `summary_rows=${result.androidSummaryRows}; hourly_rows=${hourly}; purged=${purged + livePurged}`).run();
      return new Response(JSON.stringify({
        success: true,
        processed: result.processed,
        seeded: result.seeded,
        android_summary_rows: result.androidSummaryRows,
        android_events_purged: purged,
        live_rows_purged: livePurged,
        timestamp: new Date().toISOString()
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};

// Export for use by the recalculate endpoint
export { runAggregation };
