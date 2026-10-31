/**
 * POST /api/notifications/register
 * Registers or updates an FCM device token in D1.
 */
import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";

interface RegisterPayload {
  token?: string;
  platform?: string;
  app_version?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: RegisterPayload;
  try {
    body = (await request.json()) as RegisterPayload;
  } catch {
    return json({ success: false, error: "Invalid JSON payload" }, { status: 400 });
  }

  const { token, platform = "android", app_version = "3.8" } = body;

  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return json({ success: false, error: "Valid FCM token is required" }, { status: 400 });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO notification_tokens (token, platform, app_version, is_active, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(token) DO UPDATE SET
         platform = excluded.platform,
         app_version = excluded.app_version,
         is_active = 1,
         updated_at = datetime('now')`
    )
      .bind(token.trim(), platform.trim().toLowerCase(), app_version.trim())
      .run();

    return json({ success: true, message: "Device token registered successfully" });
  } catch (err) {
    return handleD1Error(err, "Failed to register device token");
  }
};
