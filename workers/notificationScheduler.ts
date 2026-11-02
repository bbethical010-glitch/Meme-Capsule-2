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

const dispatchSchedule = async (env: Env, schedule: ScheduleRow, now: Date) => {
  const local = localParts(now, schedule.timezone);
  if (local.time !== schedule.time_local || !schedule.days_of_week.split(",").includes(local.weekday)) return;

  const occurrenceKey = `${local.date}T${schedule.time_local}`;
  const claim = await env.DB.prepare(`
    INSERT OR IGNORE INTO notification_delivery_runs
      (id, schedule_id, occurrence_key, status)
    VALUES (?, ?, ?, 'processing')
  `).bind(crypto.randomUUID(), schedule.id, occurrenceKey).run();
  if (!claim.meta.changes) return;

  let attempted = 0;
  let sent = 0;
  let stalePruned = 0;
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
          if (result.unregistered) {
            stalePruned++;
            await env.DB.prepare(
              "UPDATE notification_tokens SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE token = ?"
            ).bind(batch[resultIndex].token).run();
          }
        }
      }
    }
    await env.DB.prepare(`
      UPDATE notification_delivery_runs
      SET status = 'sent', total_attempted = ?, total_sent = ?, stale_pruned = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE schedule_id = ? AND occurrence_key = ?
    `).bind(attempted, sent, stalePruned, schedule.id, occurrenceKey).run();
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

export default {
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const schedules = (await env.DB.prepare(`
      SELECT s.id, s.message_id, s.time_local, s.timezone, s.days_of_week, s.target,
             s.topic, m.title, m.body, m.screen
      FROM notification_schedules s
      INNER JOIN notification_messages m ON m.id = s.message_id
      WHERE s.is_enabled = 1 AND m.is_active = 1
    `).all<ScheduleRow>()).results || [];
    const now = new Date();
    await Promise.all(schedules.map((schedule) => dispatchSchedule(env, schedule, now)));
  },
};
