import type { PagesFunction } from "../../../_shared/pages";
import type { Env } from "../../../_shared/d1r2";
import { json, noStore, requireSuperadmin } from "./_shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const [recent, previous, latest, worker] = await Promise.all([
      env.DB.prepare("SELECT SUM(event_count) AS count FROM android_live_minute WHERE minute_utc >= strftime('%Y-%m-%dT%H:%M', 'now', '-60 minutes')").first<{ count: number }>(),
      env.DB.prepare("SELECT SUM(event_count) AS count FROM android_live_hourly WHERE hour_utc >= strftime('%Y-%m-%dT%H:00', 'now', '-25 hours') AND hour_utc < strftime('%Y-%m-%dT%H:00', 'now', '-24 hours')").first<{ count: number }>(),
      env.DB.prepare("SELECT MAX(COALESCE(received_at, timestamp_utc)) AS value FROM android_analytics_events").first<{ value: string | null }>(),
      env.DB.prepare("SELECT last_ok_at FROM android_pipeline_health WHERE component = 'worker'").first<{ last_ok_at: string | null }>()
    ]);
    const current = Number(recent?.count || 0);
    const baseline = Number(previous?.count || 0);
    const items: Array<Record<string, string | number>> = [];
    if (current >= 50 && baseline >= 50) {
      const change = (current - baseline) / baseline;
      if (Math.abs(change) >= 0.3) items.push({ id: "hour-over-hour", severity: change < 0 ? "warn" : "info", title: "Hourly event volume changed", message: "Compare the Android release, consent funnel, and ingestion health.", metric: "events", value: current, baseline, window: "60m vs same hour yesterday", generated_at: new Date().toISOString() });
    }
    if (!latest?.value || Date.now() - Date.parse(latest.value) > 600_000) items.push({ id: "ingestion-silence", severity: "critical", title: "Ingestion is silent", message: "Check the APK endpoint, consent state, token, queue, and network.", metric: "last_event_age_sec", value: latest?.value ? Math.floor((Date.now() - Date.parse(latest.value)) / 1000) : -1, baseline: 600, window: "10m", generated_at: new Date().toISOString() });
    if (!worker?.last_ok_at || Date.now() - Date.parse(worker.last_ok_at) > 2_700_000) items.push({ id: "worker-stale", severity: "critical", title: "Analytics Worker is stale", message: "Check the Worker deployment, cron trigger, D1 binding, and migration 021.", metric: "worker_age_sec", value: worker?.last_ok_at ? Math.floor((Date.now() - Date.parse(worker.last_ok_at)) / 1000) : -1, baseline: 2700, window: "45m", generated_at: new Date().toISOString() });
    return json({ insights: items.slice(0, 8) }, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Live insights unavailable." }, { status: 500, headers: noStore() });
  }
};
