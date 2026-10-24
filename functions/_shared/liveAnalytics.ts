import { requireAuth } from "./catAuth";
import type { Env } from "./d1r2";

export const LIVE_EVENT_NAMES = new Set([
  "app_open", "app_background", "session_start", "session_end", "meme_view",
  "meme_like", "meme_share", "meme_save", "meme_scroll", "category_click",
  "onboarding_complete", "profile_open", "subscription_click", "screen_view",
  "feed_refresh", "meme_reported", "ad_impression", "ad_reward_viewed",
  "retention_checkin"
]);

export const LIVE_PROPERTY_KEYS = new Set([
  "time_on_screen_ms", "scroll_depth_pct", "rewarded_offered", "rewarded_completed",
  "ad_format", "error_code", "source", "screen", "content_type"
]);

export const eventGroup = (eventName: string): string => {
  if (eventName.startsWith("meme_") || eventName === "category_click") return "interactions";
  if (eventName === "ad_impression" || eventName === "ad_reward_viewed") return "ads";
  if (eventName === "subscription_click") return "purchases";
  if (eventName === "app_open" || eventName === "app_background" || eventName.startsWith("session_")) return "system";
  return eventName === "screen_view" || eventName === "feed_refresh" ? "views" : "system";
};

export const requireSuperadmin = (request: Request, env: Env) =>
  requireAuth(request, env, "superadmin");

export const noStore = (headers: Record<string, string> = {}) => ({
  ...headers,
  "Cache-Control": "no-store"
});

export const isoMinutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString().slice(0, 16);

export const isoHoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000).toISOString();
