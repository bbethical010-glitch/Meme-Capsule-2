/**
 * GET/POST /api/admin/notifications/messages
 * Manages reusable notification message templates.
 */
import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env, handleD1Error } from "../../../_shared/d1r2";

const screens = ["home", "drop", "favorites", "boards", "settings", "store"] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  try {
    const result = await env.DB.prepare(
      "SELECT id, title, body, screen, is_active, created_at, updated_at FROM notification_messages ORDER BY updated_at DESC"
    ).all();
    return json({ messages: result.results || [] });
  } catch (error) {
    return handleD1Error(error, "Failed to load notification messages");
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  let payload: { title?: string; body?: string; screen?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const screen = payload.screen || "drop";
  if (!title || !body || title.length > 120 || body.length > 300 || !screens.includes(screen as (typeof screens)[number])) {
    return json({ error: "Valid title, body, and screen are required" }, { status: 400 });
  }
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO notification_messages (id, title, body, screen) VALUES (?, ?, ?, ?)"
    ).bind(id, title, body, screen).run();
    return json({ success: true, id }, { status: 201 });
  } catch (error) {
    return handleD1Error(error, "Failed to create notification message");
  }
};
