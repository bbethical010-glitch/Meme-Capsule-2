/**
 * GET /api/admin/notifications/stats
 * Returns registered-device counts for the admin notification console.
 */
import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";

interface DeviceCount {
  app_version: string | null;
  platform: string;
  count: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  try {
    const [total, active, breakdown] = await env.DB.batch([
      env.DB.prepare("SELECT COUNT(*) AS count FROM notification_tokens"),
      env.DB.prepare("SELECT COUNT(*) AS count FROM notification_tokens WHERE is_active = 1"),
      env.DB.prepare(
        "SELECT app_version, platform, COUNT(*) AS count FROM notification_tokens GROUP BY app_version, platform ORDER BY app_version DESC, platform ASC"
      ),
    ]);
    return json({
      success: true,
      total_devices: Number((total.results[0] as { count: number } | undefined)?.count || 0),
      active_devices: Number((active.results[0] as { count: number } | undefined)?.count || 0),
      breakdown: (breakdown.results || []) as DeviceCount[],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load notification stats";
    return json({ success: false, error: message }, { status: 500 });
  }
};
