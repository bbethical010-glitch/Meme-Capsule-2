import type { PagesFunction } from "../../../_shared/pages";
import type { Env } from "../../../_shared/d1r2";
import { eventGroup, LIVE_PROPERTY_KEYS } from "../../../_shared/liveAnalytics";
import { json, noStore, requireSuperadmin } from "./_shared";

const parseProperties = (raw: string): Record<string, string | number | boolean> => {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([key, value]) =>
      LIVE_PROPERTY_KEYS.has(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    ).slice(0, 3));
  } catch {
    return {};
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const cursor = new URL(request.url).searchParams.get("cursor");
    const max = await env.DB.prepare("SELECT MAX(id) AS id FROM android_analytics_events").first<{ id: number | null }>();
    if (cursor && Number(cursor) > Number(max?.id || 0)) return json({ reset: true, items: [], has_more: false }, { headers: noStore() });
    const rows = cursor
      ? await env.DB.prepare("SELECT id, event_name, received_at, timestamp_utc, app_version, properties_json FROM android_analytics_events WHERE id > ? ORDER BY id ASC LIMIT 101").bind(Number(cursor)).all()
      : await env.DB.prepare("SELECT id, event_name, received_at, timestamp_utc, app_version, properties_json FROM android_analytics_events ORDER BY id DESC LIMIT 50").all();
    const raw = rows.results || [];
    const limited = raw.slice(0, cursor ? 100 : 50) as Array<Record<string, string | number>>;
    return json({
      items: limited.map((row) => ({
        id: Number(row.id),
        event_name: row.event_name,
        group: eventGroup(String(row.event_name)),
        received_at: row.received_at || row.timestamp_utc,
        app_version: row.app_version,
        props: parseProperties(String(row.properties_json || "{}"))
      })),
      has_more: raw.length > limited.length,
      cursor: limited.length ? Number(limited[limited.length - 1].id) : cursor ? Number(cursor) : null
    }, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Live event feed unavailable." }, { status: 500, headers: noStore() });
  }
};
