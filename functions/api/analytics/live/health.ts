import type { PagesFunction } from "../../../_shared/pages";
import type { Env } from "../../../_shared/d1r2";
import { json, noStore, requireSuperadmin } from "./_shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const bucket = Math.floor(Date.now() / 3600000);
    const metrics = await Promise.all(["accepted", "rejected", "unauthorized_unknown_token", "rate_limited", "quota", "rollup_failed"].map(async (metric) => ({
      reason: metric,
      count: Number.parseInt(await env.ANALYTICS_KV?.get(`analytics:metric:${bucket}:${metric}`) || "0", 10) || 0
    })));
    const health = await env.DB.prepare("SELECT component, last_ok_at, last_error_at, last_error, detail FROM android_pipeline_health").all();
    const latest = await env.DB.prepare("SELECT MAX(COALESCE(received_at, timestamp_utc)) AS value FROM android_analytics_events").first<{ value: string | null }>();
    const age = latest?.value ? Math.max(0, Math.floor((Date.now() - Date.parse(latest.value)) / 1000)) : null;
    return json({ metrics, health: health.results || [], last_event_age_sec: age, staleness: age === null || age > 600 ? "stale" : age > 300 ? "delayed" : "live" }, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Live analytics health unavailable." }, { status: 500, headers: noStore() });
  }
};
