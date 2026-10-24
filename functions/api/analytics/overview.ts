import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireSuperadmin, noStore } from "../../_shared/liveAnalytics";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

const clampDays = (value: string | null) => Math.min(90, Math.max(1, Number.parseInt(value || "30", 10) || 30));

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const url = new URL(request.url);
    const fresh = url.searchParams.get("fresh") === "1";
    const days = clampDays(url.searchParams.get("days"));
    const platform = url.searchParams.get("platform");
    const platformFilter = platform === "android" ? "AND platform = 'android'" : "";

    const cacheKey = androidAnalyticsCacheKey("overview", `${days}:${platform || "all"}`);
    const cached = !fresh && env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached, { headers: noStore() });
    const row = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total_events,
        COUNT(DISTINCT user_hash) AS active_users,
        COUNT(DISTINCT session_id) AS sessions,
        SUM(CASE WHEN event_name = 'meme_view' THEN 1 ELSE 0 END) AS views,
        SUM(CASE WHEN event_name = 'meme_like' THEN 1 ELSE 0 END) AS likes,
        SUM(CASE WHEN event_name = 'meme_share' THEN 1 ELSE 0 END) AS shares,
        SUM(CASE WHEN event_name = 'meme_save' THEN 1 ELSE 0 END) AS saves,
        SUM(CASE WHEN event_name = 'meme_scroll' THEN 1 ELSE 0 END) AS scrolls,
        COUNT(DISTINCT app_version) AS app_versions,
        MAX(timestamp_utc) AS last_event_at
      FROM android_analytics_events
      WHERE timestamp_utc >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || ? || ' days')
      ${platformFilter}
    `).bind(days).first<Record<string, number | string | null>>();

    const events = Number(row?.total_events || 0);
    const sessions = Number(row?.sessions || 0);
    const views = Number(row?.views || 0);
    const actions = Number(row?.likes || 0) + Number(row?.shares || 0) + Number(row?.saves || 0);
    const lastEventAt = row?.last_event_at || null;

    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      days,
      platform: platform || "all",
      live: true,
      source: days === 1 ? "live" : "live+summary",
      timezone: "UTC",
      freshness: {
        last_event_at: lastEventAt,
        is_empty: events === 0,
        age_seconds: lastEventAt
          ? Math.max(0, Math.floor((Date.now() - Date.parse(String(lastEventAt))) / 1000))
          : null
      },
      kpis: {
        active_users: Number(row?.active_users || 0),
        sessions,
        total_events: events,
        views,
        likes: Number(row?.likes || 0),
        shares: Number(row?.shares || 0),
        saves: Number(row?.saves || 0),
        engagement_rate: sessions ? actions / sessions : 0,
        view_to_action_rate: views ? actions / views : 0,
        app_versions: Number(row?.app_versions || 0),
        last_event_at: lastEventAt
      }
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android analytics overview error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics overview unavailable." }, { status: 500, headers: noStore() });
  }
};
