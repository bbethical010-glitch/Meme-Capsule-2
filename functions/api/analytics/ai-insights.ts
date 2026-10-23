import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireAuth(request, env);
    const cacheKey = androidAnalyticsCacheKey("ai-insights");
    const cached = env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached);
    const row = await env.DB.prepare(`
      SELECT
        COUNT(DISTINCT user_hash) AS users,
        COUNT(DISTINCT session_id) AS sessions,
        SUM(CASE WHEN event_name = 'meme_view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_name IN ('meme_like', 'meme_share', 'meme_save') THEN 1 ELSE 0 END) AS actions,
        MAX(timestamp_utc) AS last_event_at
      FROM android_analytics_events
    `).first<Record<string, number | string | null>>();
    const views = Number(row?.views || 0);
    const actions = Number(row?.actions || 0);
    const rate = views ? actions / views : 0;

    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      generated_by: "deterministic-analytics",
      insights: [
        {
          title: "Engagement signal",
          value: `${(rate * 100).toFixed(1)}%`,
          note: "Likes, shares, and saves divided by Android meme views."
        },
        {
          title: "Audience health",
          value: `${Number(row?.users || 0).toLocaleString()} users`,
          note: `${Number(row?.sessions || 0).toLocaleString()} consented sessions observed.`
        },
        {
          title: "Data freshness",
          value: row?.last_event_at || "Awaiting events",
          note: "Latest accepted Android event timestamp."
        }
      ]
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android analytics insights error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics insights unavailable." }, { status: 500 });
  }
};
