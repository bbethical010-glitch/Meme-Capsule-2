import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireSuperadmin, noStore } from "../../_shared/liveAnalytics";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const url = new URL(request.url);
    const fresh = url.searchParams.get("fresh") === "1";
    const days = Math.min(90, Math.max(1, Number.parseInt(url.searchParams.get("days") || "30", 10) || 30));
    const cacheKey = androidAnalyticsCacheKey("trends", String(days));
    const cached = !fresh && env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached, { headers: noStore() });

    const { results } = await env.DB.prepare(`
      WITH completed AS (
        SELECT
          summary_date AS date,
          SUM(events) AS events,
          SUM(users) AS active_users,
          SUM(views) AS views,
          SUM(likes) AS likes,
          SUM(shares) AS shares,
          SUM(saves) AS saves,
          'summary' AS source
        FROM android_analytics_daily_summary
        WHERE summary_date >= date('now', '-' || ? || ' days')
          AND summary_date < date('now')
        GROUP BY summary_date
      ),
      current_day AS (
        SELECT
          date('now') AS date,
          SUM(event_count) AS events,
          (SELECT COUNT(*) FROM android_live_presence WHERE last_seen_at >= datetime('now', '-24 hours')) AS active_users,
          SUM(CASE WHEN event_name = 'meme_view' THEN event_count ELSE 0 END) AS views,
          SUM(CASE WHEN event_name = 'meme_like' THEN event_count ELSE 0 END) AS likes,
          SUM(CASE WHEN event_name = 'meme_share' THEN event_count ELSE 0 END) AS shares,
          SUM(CASE WHEN event_name = 'meme_save' THEN event_count ELSE 0 END) AS saves,
          'live' AS source
        FROM android_live_minute
        WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', 'start of day')
      )
      SELECT * FROM completed
      UNION ALL
      SELECT * FROM current_day
      ORDER BY date ASC
    `).bind(days).all();

    const trends = results || [];
    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      days,
      live: true,
      freshness: {
        last_event_at: trends.length ? trends[trends.length - 1].date : null,
        timezone: "UTC",
        is_empty: trends.length === 0
      },
      trends
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android analytics trends error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics trends unavailable." }, { status: 500, headers: noStore() });
  }
};
