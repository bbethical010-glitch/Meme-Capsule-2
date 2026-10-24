import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { LIVE_PROPERTY_KEYS } from "../../_shared/liveAnalytics";

const EVENT_NAMES = new Set([
  "app_open", "app_background", "session_start", "session_end", "meme_view",
  "meme_like", "meme_share", "meme_save", "meme_scroll", "category_click",
  "onboarding_complete", "profile_open", "subscription_click", "screen_view",
  "feed_refresh", "meme_reported", "ad_impression", "ad_reward_viewed",
  "retention_checkin"
]);

const HEX_64_RE = /^[0-9a-f]{64}$/i;
const UUID_RE = /^[0-9a-f-]{16,64}$/i;
const MAX_BATCH_SIZE = 200;
const MAX_EVENT_BYTES = 8_192;
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;
const RATE_LIMIT_PER_IP = 1200;
const RATE_LIMIT_PER_TOKEN = 600;
const MAX_INSTALL_EVENTS_PER_HOUR = 1500;
const MAX_SCALAR_PROPERTY_LENGTH = 128;
const FUTURE_EVENT_TOLERANCE_MS = 5 * 60 * 1000;

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type AndroidEvent = {
  schema_version: 1;
  event_id: string;
  event_name: string;
  user_hash: string;
  session_id: string;
  timestamp_utc: string;
  platform: "android";
  app_version: string;
  os_version?: string;
  country?: string;
  meme_id?: string;
  category?: string;
  source_channel?: string;
  screen_name?: string;
  properties?: Record<string, unknown>;
  consent_status: "granted";
  consent_version?: string;
};

type EventRequest = { events: AndroidEvent[] };

function validateEvent(event: AndroidEvent, index: number): string | null {
  if (!event || typeof event !== "object") return `events[${index}] must be an object.`;
  if (event.schema_version !== 1) return `events[${index}].schema_version must be 1.`;
  if (!event.event_id || !UUID_RE.test(event.event_id)) return `events[${index}].event_id is invalid.`;
  if (!event.event_name || !EVENT_NAMES.has(event.event_name)) return `events[${index}].event_name is not supported.`;
  if (!event.user_hash || !HEX_64_RE.test(event.user_hash)) return `events[${index}].user_hash must be SHA-256.`;
  if (!event.session_id || !UUID_RE.test(event.session_id)) return `events[${index}].session_id is invalid.`;
  if (event.platform !== "android") return `events[${index}].platform must be android.`;
  if (!event.app_version || !/^[0-9A-Za-z.+_-]{1,32}$/.test(event.app_version)) return `events[${index}].app_version is invalid.`;
  if (event.consent_status !== "granted") return `events[${index}] requires granted consent.`;
  if (event.consent_version !== undefined &&
      (typeof event.consent_version !== "string" || !/^[a-zA-Z0-9._-]{1,32}$/.test(event.consent_version))) {
    return `events[${index}].consent_version is invalid.`;
  }
  for (const [field, value] of Object.entries({
    os_version: event.os_version,
    country: event.country,
    meme_id: event.meme_id,
    category: event.category,
    source_channel: event.source_channel,
    screen_name: event.screen_name
  })) {
    if (value !== undefined && (typeof value !== "string" || value.length > 128)) {
      return `events[${index}].${field} is invalid.`;
    }
  }

  const timestamp = Date.parse(event.timestamp_utc);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > MAX_CLOCK_SKEW_MS) {
    return `events[${index}].timestamp_utc is invalid or outside the allowed clock window.`;
  }

  if (event.properties !== undefined) {
    if (!event.properties || typeof event.properties !== "object" || Array.isArray(event.properties)) {
      return `events[${index}].properties must be an object.`;
    }
    for (const [key, value] of Object.entries(event.properties)) {
      if (!LIVE_PROPERTY_KEYS.has(key)) return `events[${index}].properties contains an unsupported key.`;
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
        return `events[${index}].properties values must be scalar.`;
      }
      if (typeof value === "string" && value.length > MAX_SCALAR_PROPERTY_LENGTH) {
        return `events[${index}].properties value is too long.`;
      }
    }
    const serializedProperties = JSON.stringify(event.properties);
    if (serializedProperties.length > MAX_EVENT_BYTES) {
      return `events[${index}].properties is too large.`;
    }
  }
  return null;
}

const getClientIp = (request: Request) =>
  request.headers.get("CF-Connecting-IP") || "unknown";

const digest = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const constantTimeEqual = (left: string, right: string): boolean => {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
};

const consumeRateLimit = async (
  kv: KVNamespace | undefined,
  key: string,
  limit: number
): Promise<RateLimitResult> => {
  if (!kv) return { allowed: true, retryAfterSeconds: 0 };

  const now = Math.floor(Date.now() / 1000);
  const window = Math.floor(now / RATE_LIMIT_WINDOW_SECONDS);
  const bucketKey = `analytics:rate:${window}:${key}`;
  const current = Number.parseInt(await kv.get(bucketKey) || "0", 10);
  const retryAfterSeconds = RATE_LIMIT_WINDOW_SECONDS - (now % RATE_LIMIT_WINDOW_SECONDS);

  if (!Number.isFinite(current) || current >= limit) {
    return { allowed: false, retryAfterSeconds };
  }

  await kv.put(bucketKey, String(current + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS + 60 });
  return { allowed: true, retryAfterSeconds: 0 };
};

const recordMetric = async (
  kv: KVNamespace | undefined,
  metric: "accepted" | "rejected" | "unauthorized" | "unauthorized_missing_token" | "unauthorized_unknown_token" | "rate_limited" | "quota" | "future_timestamp" | "rollup_failed" | "duplicates"
) => {
  if (!kv) return;
  try {
    const bucket = Math.floor(Date.now() / 3600000);
    const key = `analytics:metric:${bucket}:${metric}`;
    const current = Number.parseInt(await kv.get(key) || "0", 10);
    await kv.put(key, String((Number.isFinite(current) ? current : 0) + 1), {
      expirationTtl: 8 * 24 * 60 * 60
    });
  } catch (error) {
    console.error("Analytics metric write failed:", error instanceof Error ? error.message : "unknown error");
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!env.ANALYTICS_APP_TOKEN) {
      await recordMetric(env.ANALYTICS_KV, "unauthorized_missing_token");
      return json({ error: "Analytics app ingestion is not configured." }, { status: 503 });
    }
    if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
      await recordMetric(env.ANALYTICS_KV, "rejected");
      return json({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const suppliedToken = request.headers.get("X-Analytics-App-Token") || "";
    const tokenAccepted = constantTimeEqual(suppliedToken, env.ANALYTICS_APP_TOKEN)
      || Boolean(env.ANALYTICS_APP_TOKEN_PREVIOUS && constantTimeEqual(suppliedToken, env.ANALYTICS_APP_TOKEN_PREVIOUS));
    if (!tokenAccepted) {
      await recordMetric(env.ANALYTICS_KV, "unauthorized_unknown_token");
      return json({ error: "Unauthorized analytics client." }, { status: 401 });
    }

    const contentLength = Number.parseInt(request.headers.get("Content-Length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      await recordMetric(env.ANALYTICS_KV, "rejected");
      return json({ error: "Analytics request body is too large." }, { status: 413 });
    }

    const tokenKey = await digest(suppliedToken);
    const ipKey = await digest(getClientIp(request));
    const [ipLimit, tokenLimit] = await Promise.all([
      consumeRateLimit(env.ANALYTICS_KV, `ip:${ipKey}`, RATE_LIMIT_PER_IP),
      consumeRateLimit(env.ANALYTICS_KV, `token:${tokenKey}`, RATE_LIMIT_PER_TOKEN)
    ]);
    if (!ipLimit.allowed || !tokenLimit.allowed) {
      await recordMetric(env.ANALYTICS_KV, "rate_limited");
      const retryAfterSeconds = Math.max(ipLimit.retryAfterSeconds, tokenLimit.retryAfterSeconds);
      return json(
        { error: "Analytics ingestion rate limit exceeded." },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      await recordMetric(env.ANALYTICS_KV, "rejected");
      return json({ error: "Analytics request body is too large." }, { status: 413 });
    }

    let body: EventRequest;
    try {
      body = JSON.parse(rawBody) as EventRequest;
    } catch {
      await recordMetric(env.ANALYTICS_KV, "rejected");
      return json({ error: "Request body must be valid JSON." }, { status: 400 });
    }

    if (!body || !Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_BATCH_SIZE) {
      await recordMetric(env.ANALYTICS_KV, "rejected");
      return json({ error: `events must contain 1-${MAX_BATCH_SIZE} items.` }, { status: 400 });
    }

    for (let index = 0; index < body.events.length; index += 1) {
      const error = validateEvent(body.events[index], index);
      if (error) {
        await recordMetric(env.ANALYTICS_KV, "rejected");
        return json({ error }, { status: 400 });
      }
    }

    const receivedAt = new Date().toISOString();
    const maxInstallEvents = Number.parseInt(env.ANALYTICS_MAX_EVENTS_PER_INSTALL_HOUR || "", 10) || MAX_INSTALL_EVENTS_PER_HOUR;
    const installHashes = [...new Set(body.events.map((event) => event.user_hash))];
    for (const installHash of installHashes) {
      const quotaStatement = env.DB.prepare(`
        SELECT window_start, window_events FROM android_live_presence WHERE user_hash = ?
      `).bind(installHash);
      const existing = typeof (quotaStatement as D1PreparedStatement & { first?: unknown }).first === "function"
        ? await quotaStatement.first<{ window_start: string; window_events: number }>()
        : null;
      const withinWindow = existing && Date.parse(existing.window_start) >= Date.now() - 3_600_000;
      const incoming = body.events.filter((event) => event.user_hash === installHash).length;
      if (withinWindow && Number(existing?.window_events || 0) + incoming > maxInstallEvents) {
        await recordMetric(env.ANALYTICS_KV, "quota");
        return json({ error: "Analytics install event quota exceeded." }, {
          status: 429,
          headers: { "Retry-After": "3600" }
        });
      }
    }
    const statements = body.events.map((event) => env.DB.prepare(`
      INSERT OR IGNORE INTO android_analytics_events (
        schema_version, event_id, event_name, user_hash, session_id, timestamp_utc, platform,
        app_version, os_version, country, meme_id, category, source_channel,
        screen_name, properties_json, consent_status, consent_version, received_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.schema_version,
      event.event_id,
      event.event_name,
      event.user_hash,
      event.session_id,
      new Date(event.timestamp_utc).toISOString(),
      event.platform,
      event.app_version,
      event.os_version || null,
      event.country || null,
      event.meme_id || null,
      event.category || null,
      event.source_channel || null,
      event.screen_name || null,
      JSON.stringify(event.properties || {}),
      event.consent_status,
      event.consent_version || "v1",
      receivedAt
    ));

    const results = await env.DB.batch(statements);
    const accepted = results.reduce((count, result) => count + (result.meta?.changes || 0), 0);
    const insertedEvents = body.events.filter((_event, index) => (results[index]?.meta?.changes || 0) > 0);
    try {
      const minuteCounts = new Map<string, number>();
      for (const event of insertedEvents) {
        if (Date.parse(event.timestamp_utc) - Date.now() > FUTURE_EVENT_TOLERANCE_MS) {
          await recordMetric(env.ANALYTICS_KV, "future_timestamp");
          continue;
        }
        const minute = new Date(event.timestamp_utc).toISOString().slice(0, 16);
        const key = `${minute}\u0000${event.event_name}`;
        minuteCounts.set(key, (minuteCounts.get(key) || 0) + 1);
      }
      const rollupStatements = [...minuteCounts.entries()].map(([key, count]) => {
        const [minute, eventName] = key.split("\u0000");
        return env.DB.prepare(`
          INSERT INTO android_live_minute (minute_utc, event_name, event_count)
          VALUES (?, ?, ?)
          ON CONFLICT(minute_utc, event_name) DO UPDATE SET event_count = event_count + excluded.event_count
        `).bind(minute, eventName, count);
      });
      for (const hash of installHashes) {
        const installEvents = insertedEvents.filter((event) => event.user_hash === hash);
        if (!installEvents.length) continue;
        const first = installEvents[0];
        const existing = await env.DB.prepare("SELECT first_seen_at, window_start, window_events FROM android_live_presence WHERE user_hash = ?").bind(hash).first<{ first_seen_at: string; window_start: string; window_events: number }>();
        const currentWindow = existing && Date.parse(existing.window_start) >= Date.now() - 3_600_000;
        rollupStatements.push(env.DB.prepare(`
          INSERT INTO android_live_presence (user_hash, first_seen_at, last_seen_at, app_version, window_start, window_events)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_hash) DO UPDATE SET
            last_seen_at = excluded.last_seen_at,
            app_version = excluded.app_version,
            window_start = excluded.window_start,
            window_events = excluded.window_events
        `).bind(
          hash,
          existing?.first_seen_at || receivedAt,
          receivedAt,
          first.app_version,
          currentWindow ? existing?.window_start : receivedAt,
          (currentWindow ? Number(existing?.window_events || 0) : 0) + installEvents.length
        ));
      }
      for (let index = 0; index < rollupStatements.length; index += 50) {
        await env.DB.batch(rollupStatements.slice(index, index + 50));
      }
    } catch (error) {
      await recordMetric(env.ANALYTICS_KV, "rollup_failed");
      try {
        await env.DB.prepare(`
          INSERT INTO android_pipeline_health (component, last_error_at, last_error, detail)
          VALUES ('ingest_rollup', ?, ?, ?)
          ON CONFLICT(component) DO UPDATE SET last_error_at = excluded.last_error_at, last_error = excluded.last_error, detail = excluded.detail
        `).bind(receivedAt, error instanceof Error ? error.message : "rollup failed", "rollup failure did not reject ingestion").run();
      } catch {
        // Health reporting must not alter the accepted upload response.
      }
    }
    await recordMetric(env.ANALYTICS_KV, "accepted");
    if (accepted < body.events.length) {
      await recordMetric(env.ANALYTICS_KV, "duplicates");
    }
    return json({ success: true, accepted, rejected: body.events.length - accepted, message: "events processed" });
  } catch (error) {
    console.error("Android analytics ingestion error:", error instanceof Error ? error.message : error);
    await recordMetric(env.ANALYTICS_KV, "rejected");
    return json({ error: "Analytics ingestion failed." }, { status: 500 });
  }
};
