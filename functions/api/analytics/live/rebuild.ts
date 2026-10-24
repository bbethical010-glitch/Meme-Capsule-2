import type { PagesFunction } from "../../../_shared/pages";
import type { Env } from "../../../_shared/d1r2";
import { json, noStore, requireSuperadmin } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await requireSuperadmin(request, env);
    const rows = await env.DB.prepare(`
      SELECT substr(COALESCE(received_at, timestamp_utc), 1, 16) AS minute_utc, event_name, COUNT(*) AS event_count
      FROM android_analytics_events
      WHERE COALESCE(received_at, timestamp_utc) >= datetime('now', '-2 hours')
      GROUP BY minute_utc, event_name
    `).all<{ minute_utc: string; event_name: string; event_count: number }>();
    for (let index = 0; index < (rows.results || []).length; index += 50) {
      await env.DB.batch((rows.results || []).slice(index, index + 50).map((row) => env.DB.prepare(`
        INSERT INTO android_live_minute (minute_utc, event_name, event_count) VALUES (?, ?, ?)
        ON CONFLICT(minute_utc, event_name) DO UPDATE SET event_count = excluded.event_count
      `).bind(row.minute_utc, row.event_name, row.event_count)));
    }
    return json({ success: true, rebuilt_rows: rows.results?.length || 0 }, { headers: noStore() });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Live analytics rebuild failed." }, { status: 500, headers: noStore() });
  }
};
