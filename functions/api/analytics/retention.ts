import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { requireAuth } from "../../_shared/catAuth";
import { androidAnalyticsCacheKey, ANDROID_ANALYTICS_TTL, getCached, setCache } from "../../_shared/analyticsCache";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireAuth(request, env);
    const cacheKey = androidAnalyticsCacheKey("retention");
    const cached = env.ANALYTICS_KV ? await getCached<Record<string, unknown>>(env.ANALYTICS_KV, cacheKey) : null;
    if (cached) return json(cached);
    const { results } = await env.DB.prepare(`
      WITH first_seen AS (
        SELECT user_hash, MIN(substr(timestamp_utc, 1, 10)) AS cohort_date
        FROM android_analytics_events
        GROUP BY user_hash
      )
      SELECT
        cohort_date,
        COUNT(*) AS cohort_users,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM android_analytics_events e
          WHERE e.user_hash = first_seen.user_hash
            AND date(substr(e.timestamp_utc, 1, 10)) >= date(first_seen.cohort_date, '+1 day')
        ) THEN 1 ELSE 0 END) AS d1_users,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM android_analytics_events e
          WHERE e.user_hash = first_seen.user_hash
            AND date(substr(e.timestamp_utc, 1, 10)) >= date(first_seen.cohort_date, '+7 days')
        ) THEN 1 ELSE 0 END) AS d7_users,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM android_analytics_events e
          WHERE e.user_hash = first_seen.user_hash
            AND date(substr(e.timestamp_utc, 1, 10)) >= date(first_seen.cohort_date, '+30 days')
        ) THEN 1 ELSE 0 END) AS d30_users
      FROM first_seen
      GROUP BY cohort_date
      ORDER BY cohort_date DESC
      LIMIT 30
    `).all();

    const response = {
      success: true,
      generated_at: new Date().toISOString(),
      cohorts: (results || []).map((row) => {
        const cohort = row as Record<string, number | string>;
        const users = Number(cohort.cohort_users || 0);
        return {
          cohort_date: cohort.cohort_date,
          users,
          d1: users ? Number(cohort.d1_users || 0) / users : 0,
          d7: users ? Number(cohort.d7_users || 0) / users : 0,
          d30: users ? Number(cohort.d30_users || 0) / users : 0
        };
      })
    };
    if (env.ANALYTICS_KV) await setCache(env.ANALYTICS_KV, cacheKey, response, ANDROID_ANALYTICS_TTL);
    return json(response);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Android retention error:", error instanceof Error ? error.message : error);
    return json({ error: "Analytics retention unavailable." }, { status: 500 });
  }
};
