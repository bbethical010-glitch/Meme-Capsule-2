/**
 * GET/POST/PATCH/DELETE /api/admin/notifications/schedules
 * Manages timezone-aware recurring notification schedules.
 */
import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env, handleD1Error } from "../../../_shared/d1r2";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const targetValues = ["all", "topic"] as const;

const validTimezone = (timezone: string) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  try {
    const result = await env.DB.prepare(`
      SELECT s.id, s.message_id, s.time_local, s.timezone, s.days_of_week, s.target,
             s.topic, s.content_file_id, f.file_name AS content_file_name,
             s.is_enabled, s.created_at, s.updated_at,
             m.title, m.body, m.screen
      FROM notification_schedules s
      INNER JOIN notification_messages m ON m.id = s.message_id
      LEFT JOIN notification_content_files f ON f.id = s.content_file_id
      ORDER BY s.time_local ASC
    `).all();
    const runs = await env.DB.prepare(`
      SELECT id, schedule_id, occurrence_key, status, total_attempted, total_sent,
             stale_pruned, error, started_at, completed_at
      FROM notification_delivery_runs ORDER BY started_at DESC LIMIT 50
    `).all();
    return json({ schedules: result.results || [], runs: runs.results || [] });
  } catch (error) {
    return handleD1Error(error, "Failed to load notification schedules");
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  let payload: {
    message_id?: string;
    time_local?: string;
    timezone?: string;
    days_of_week?: string;
    target?: string;
    topic?: string;
    content_file_id?: string;
    is_enabled?: boolean;
  };

  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const timezone = payload.timezone?.trim() || "UTC";
  const timeLocal = payload.time_local?.trim() || "";
  const days = payload.days_of_week?.trim() || "0,1,2,3,4,5,6";
  const target = payload.target || "all";
  const dayValues = days.split(",");
  if (
    (!payload.message_id && !payload.content_file_id) ||
    !timePattern.test(timeLocal) ||
    !validTimezone(timezone) ||
    !dayValues.length ||
    dayValues.some((day) => !/^[0-6]$/.test(day)) ||
    !targetValues.includes(target as (typeof targetValues)[number]) ||
    (target === "topic" && !payload.topic?.trim())
  ) {
    return json({ error: "Invalid message, time, timezone, days, or target" }, { status: 400 });
  }
  try {
    let messageId = payload.message_id?.trim() || "";
    if (messageId) {
      const message = await env.DB.prepare(
        "SELECT id FROM notification_messages WHERE id = ? AND is_active = 1"
      ).bind(messageId).first();
      if (!message) return json({ error: "Active message not found" }, { status: 400 });
    }
    let contentFilePath: string | null = null;
    if (payload.content_file_id) {
      const file = await env.DB.prepare(
        "SELECT id, storage_path FROM notification_content_files WHERE id = ?"
      )
        .bind(payload.content_file_id).first();
      if (!file) return json({ error: "Content file not found" }, { status: 400 });
      contentFilePath = (file as { storage_path: string }).storage_path;
    }
    if (!messageId) {
      messageId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO notification_messages (id, title, body, screen)
        VALUES (?, 'Scheduled content library', 'Content selected from the attached library.', 'drop')
      `).bind(messageId).run();
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO notification_schedules
        (id, message_id, time_local, timezone, days_of_week, target, topic, is_enabled, content_file_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      messageId,
      timeLocal,
      timezone,
      [...new Set(dayValues)].sort().join(","),
      target,
      payload.topic?.trim() || null,
      payload.is_enabled === false ? 0 : 1,
      payload.content_file_id || null
    ).run();
    return json({ success: true, id }, { status: 201 });
  } catch (error) {
    return handleD1Error(error, "Failed to create notification schedule");
  }
};

export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  let payload: { id?: string; is_enabled?: boolean };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload.id || typeof payload.is_enabled !== "boolean") {
    return json({ error: "id and is_enabled are required" }, { status: 400 });
  }
  try {
    const result = await env.DB.prepare(
      "UPDATE notification_schedules SET is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).bind(payload.is_enabled ? 1 : 0, payload.id).run();
    if (!result.meta.changes) return json({ error: "Schedule not found" }, { status: 404 });
    return json({ success: true });
  } catch (error) {
    return handleD1Error(error, "Failed to update notification schedule");
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  let payload: { id?: string };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload.id) return json({ error: "id is required" }, { status: 400 });
  try {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM notification_delivery_runs WHERE schedule_id = ?").bind(payload.id),
      env.DB.prepare("DELETE FROM notification_schedules WHERE id = ?").bind(payload.id),
    ]);
    return json({ success: true });
  } catch (error) {
    return handleD1Error(error, "Failed to delete notification schedule");
  }
};
