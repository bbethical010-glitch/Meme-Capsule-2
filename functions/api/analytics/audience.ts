import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireSuperadmin, noStore } from "../../_shared/liveAnalytics";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const cacheKey = androidAnalyticsCacheKey("audience");
    const cached = !fresh && env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached, { headers: noStore() });
    const [platforms, versions] = await Promise.all([
      env.DB.prepare(`
        SELECT platform, COUNT(DISTINCT user_hash) AS users, COUNT(*) AS events
        FROM android_analytics_events
        GROUP BY platform
        ORDER BY users DESC
      `).all(),
      env.DB.prepare(`
        SELECT app_version, COUNT(DISTINCT user_hash) AS users, COUNT(*) AS events
        FROM android_analytics_events
        GROUP BY app_version
        ORDER BY users DESC
        LIMIT 10
      `).all()
    ]);

    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      platforms: platforms.results || [],
      app_versions: versions.results || []
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android audience analytics error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics audience unavailable." }, { status: 500, headers: noStore() });
  }
};
