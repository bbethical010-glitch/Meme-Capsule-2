import type { PagesFunction } from "../../../_shared/pages";
import type { Env } from "../../../_shared/d1r2";
import { cachedLive, json, noStore, requireSuperadmin } from "./_shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const url = new URL(request.url);
    const fresh = url.searchParams.get("fresh") === "1";
    const response = await cachedLive(env, "summary", fresh, async () => {
      const now = new Date().toISOString();
      const [presence, windows, minutes, eventRows, versions, today, health, byEvent] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS count FROM android_live_presence WHERE last_seen_at >= datetime('now', '-5 minutes')").first<{ count: number }>(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM android_live_presence WHERE last_seen_at >= datetime('now', '-30 minutes')").first<{ count: number }>(),
        env.DB.prepare(`
          SELECT minute_utc AS minute, SUM(event_count) AS count
          FROM android_live_minute WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', '-60 minutes')
          GROUP BY minute_utc ORDER BY minute_utc ASC
        `).all<{ minute: string; count: number }>(),
        env.DB.prepare(`
          SELECT SUM(event_count) AS count FROM android_live_minute
          WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', '-5 minutes')
        `).first<{ count: number }>(),
        env.DB.prepare(`
          SELECT app_version, COUNT(*) AS users FROM android_live_presence
          WHERE last_seen_at >= datetime('now', '-5 minutes') GROUP BY app_version ORDER BY users DESC
        `).all<{ app_version: string; users: number }>(),
        env.DB.prepare(`
          SELECT COUNT(*) AS events, COUNT(DISTINCT user_hash) AS active_users
          FROM android_analytics_events WHERE COALESCE(received_at, timestamp_utc) >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', 'start of day')
        `).first<{ events: number; active_users: number }>(),
        env.DB.prepare("SELECT component, last_ok_at, last_error_at, last_error, detail FROM android_pipeline_health WHERE component IN ('worker','ingest_rollup')").all(),
        env.DB.prepare(`
          SELECT event_name, SUM(event_count) AS count FROM android_live_minute
          WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', '-60 minutes')
          GROUP BY event_name ORDER BY count DESC
        `).all<{ event_name: string; count: number }>()
      ]);
      const latest = await env.DB.prepare("SELECT MAX(COALESCE(received_at, timestamp_utc)) AS value FROM android_analytics_events").first<{ value: string | null }>();
      const lastEventAt = latest?.value || null;
      const worker = (health.results || []).find((row) => (row as { component: string }).component === "worker") as { last_ok_at?: string | null } | undefined;
      const age = lastEventAt ? Math.max(0, Math.floor((Date.now() - Date.parse(lastEventAt)) / 1000)) : null;
      return {
        server_time: now,
        active_now: Number(presence?.count || 0),
        active_30m: Number(windows?.count || 0),
        events_5m: Number(eventRows?.count || 0),
        events_prev_5m: Number((await env.DB.prepare("SELECT SUM(event_count) AS count FROM android_live_minute WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', '-10 minutes') AND minute_utc < strftime('%Y-%m-%dT%H:%M', 'now', '-5 minutes')").first<{ count: number }>())?.count || 0),
        last_event_at: lastEventAt,
        per_minute: minutes.results || [],
        by_event_last_hour: byEvent.results || [],
        active_versions: versions.results || [],
        today: { events: Number(today?.events || 0), active_users: Number(today?.active_users || 0) },
        pipeline: { status: age === null ? "stale" : age > 600 ? "stale" : "live", last_worker_ok_at: worker?.last_ok_at || null, last_event_age_sec: age },
        next_poll_ms: 10_000
      };
    });
    return json(response, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Live analytics summary unavailable." }, { status: 500, headers: noStore() });
  }
};
