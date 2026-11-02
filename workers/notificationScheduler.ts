/**
 * Durable scheduled FCM delivery.
 *
 * This Worker is intentionally separate from Pages so it keeps running when
 * the admin UI is closed. Cloudflare invokes it every minute.
 */
import { getFcmAuth } from "../functions/_shared/fcmAuth";
import { sendFcmMessage } from "../functions/api/notifications/_fcm";

interface Env {
  DB: D1Database;
  MEMES_BUCKET: R2Bucket;
  FIREBASE_SERVICE_ACCOUNT?: string;
  NOTIFICATION_WORKER_TOKEN?: string;
}

interface ScheduleRow {
  id: string;
  message_id: string;
  time_local: string;
  timezone: string;
  days_of_week: string;
  target: string;
  topic: string | null;
  title: string;
  body: string;
  screen: string;
}

const localParts = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays: Record<string, string> = { Sun: "0", Mon: "1", Tue: "2", Wed: "3", Thu: "4", Fri: "5", Sat: "6" };
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    weekday: weekdays[values.weekday],
  };
};

const minuteOffsets = [-2, -1, 0];

const dispatchSchedule = async (env: Env, schedule: ScheduleRow, now: Date, offset: number) => {
  const candidate = new Date(now.getTime() + offset * 60_000);
  const local = localParts(candidate, schedule.timezone);
  if (local.time !== schedule.time_local || !schedule.days_of_week.split(",").includes(local.weekday)) return;

  const occurrenceKey = `${local.date}T${schedule.time_local}`;
  const claim = await env.DB.prepare(`
    INSERT INTO notification_delivery_runs
      (id, schedule_id, occurrence_key, status)
    VALUES (?, ?, ?, 'processing')
    ON CONFLICT(schedule_id, occurrence_key) DO UPDATE SET
      status = 'processing',
      error = NULL,
      started_at = CURRENT_TIMESTAMP,
      completed_at = NULL
    WHERE notification_delivery_runs.status = 'failed'
       OR (notification_delivery_runs.status = 'processing'
           AND notification_delivery_runs.started_at < datetime('now', '-5 minutes'))
  `).bind(crypto.randomUUID(), schedule.id, occurrenceKey).run();
  if (!claim.meta.changes) return;

  let attempted = 0;
  let sent = 0;
  let stalePruned = 0;
  const errors: string[] = [];
  try {
    const { accessToken, projectId } = await getFcmAuth(env);
    if (schedule.target === "topic") {
      attempted = 1;
      const result = await sendFcmMessage(env, accessToken, {
        topic: schedule.topic || "",
        projectId,
        title: schedule.title,
        body: schedule.body,
        data: { screen: schedule.screen, action: schedule.screen === "drop" ? "drop" : "navigate" },
      });
      if (result.success) sent = 1;
      else if (result.error) errors.push(result.error);
    } else {
      const tokens = (await env.DB.prepare(
        "SELECT token FROM notification_tokens WHERE is_active = 1"
      ).all<{ token: string }>()).results || [];
      attempted = tokens.length;
      for (let index = 0; index < tokens.length; index += 100) {
        const batch = tokens.slice(index, index + 100);
        const results = await Promise.all(batch.map((row) => sendFcmMessage(env, accessToken, {
          token: row.token,
          projectId,
          title: schedule.title,
          body: schedule.body,
          data: { screen: schedule.screen, action: schedule.screen === "drop" ? "drop" : "navigate" },
        })));
        for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
          const result = results[resultIndex];
          if (result.success) sent++;
          else if (result.error) errors.push(result.error);
          if (result.unregistered) {
            stalePruned++;
            await env.DB.prepare(
              "UPDATE notification_tokens SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE token = ?"
            ).bind(batch[resultIndex].token).run();
          }
        }
      }
    }
    const status = sent === attempted ? "sent" : sent > 0 ? "partial" : "failed";
    await env.DB.prepare(`
      UPDATE notification_delivery_runs
      SET status = ?, total_attempted = ?, total_sent = ?, stale_pruned = ?, error = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE schedule_id = ? AND occurrence_key = ?
    `).bind(status, attempted, sent, stalePruned, errors.slice(0, 5).join(" | ") || null, schedule.id, occurrenceKey).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled dispatch failed";
    await env.DB.prepare(`
      UPDATE notification_delivery_runs
      SET status = 'failed', total_attempted = ?, total_sent = ?, stale_pruned = ?,
          error = ?, completed_at = CURRENT_TIMESTAMP
      WHERE schedule_id = ? AND occurrence_key = ?
    `).bind(attempted, sent, stalePruned, message.slice(0, 1000), schedule.id, occurrenceKey).run();
    console.error(`Schedule ${schedule.id} failed: ${message}`);
  }
};

const runSchedules = async (env: Env): Promise<void> => {
  const schedules = (await env.DB.prepare(`
    SELECT s.id, s.message_id, s.time_local, s.timezone, s.days_of_week, s.target,
           s.topic, m.title, m.body, m.screen
    FROM notification_schedules s
    INNER JOIN notification_messages m ON m.id = s.message_id
    WHERE s.is_enabled = 1 AND m.is_active = 1
  `).all<ScheduleRow>()).results || [];
  const now = new Date();
  await Promise.all(schedules.flatMap((schedule) =>
    minuteOffsets.map((offset) => dispatchSchedule(env, schedule, now, offset))
  ));
};

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await runSchedules(env);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" || request.headers.get("X-Notification-Worker-Token") !== env.NOTIFICATION_WORKER_TOKEN) {
      return new Response("Unauthorized", { status: 401 });
    }
    await runSchedules(env);
    return new Response(JSON.stringify({ success: true, timestamp: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
