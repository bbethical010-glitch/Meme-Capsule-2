/**
 * POST /api/admin/notifications/send
 * Dispatches FCM HTTP v1 notifications to active devices, a topic, or one token.
 */
import type { PagesFunction } from "../../../_shared/pages";
import { getFcmAuth } from "../../../_shared/fcmAuth";
import { json, requireAdmin, type Env } from "../../../_shared/d1r2";

const screens = ["home", "drop", "favorites", "boards", "settings", "store"] as const;
const targets = ["all", "topic", "single"] as const;
type Screen = (typeof screens)[number];
type Target = (typeof targets)[number];

interface SendPayload {
  title?: string;
  body?: string;
  screen?: Screen;
  target?: Target;
  token?: string;
  topic?: string;
}

interface DispatchResult {
  success: boolean;
  stale?: boolean;
}

const sendMessage = async (
  projectId: string,
  accessToken: string,
  payload: Record<string, unknown>
): Promise<DispatchResult> => {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: payload }),
    }
  );

  if (response.ok) return { success: true };
  const error = (await response.json().catch(() => ({}))) as {
    error?: { status?: string; message?: string };
  };
  return {
    success: false,
    stale: error.error?.status === "UNREGISTERED" || error.error?.status === "NOT_FOUND",
  };
};

const makeMessage = (
  title: string,
  body: string,
  screen: Screen,
  recipient: { token: string } | { topic: string }
) => ({
  ...recipient,
  notification: { title, body },
  data: {
    screen,
    action: screen === "drop" ? "drop" : "navigate",
  },
  android: {
    notification: {
      channel_id: "meme_capsule_drops",
      icon: "ic_launcher",
    },
  },
});

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  let payload: SendPayload;
  try {
    payload = (await request.json()) as SendPayload;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const title = payload.title?.trim();
  const body = payload.body?.trim();
  const screen = payload.screen || "home";
  const target = payload.target || "all";
  if (!title || !body) {
    return json({ success: false, error: "title and body are required" }, { status: 400 });
  }
  if (!screens.includes(screen) || !targets.includes(target)) {
    return json({ success: false, error: "Invalid screen or target" }, { status: 400 });
  }
  if (target === "single" && !payload.token?.trim()) {
    return json({ success: false, error: "token is required for a single-device dispatch" }, { status: 400 });
  }
  if (target === "topic" && !payload.topic?.trim()) {
    return json({ success: false, error: "topic is required for a topic dispatch" }, { status: 400 });
  }

  try {
    const { accessToken, projectId } = await getFcmAuth(env);
    if (target === "topic") {
      const result = await sendMessage(
        projectId,
        accessToken,
        makeMessage(title, body, screen, { topic: payload.topic!.trim() })
      );
      return json({
        success: result.success,
        total_attempted: 1,
        total_sent: result.success ? 1 : 0,
        stale_pruned: 0,
      }, { status: result.success ? 200 : 502 });
    }

    const tokens =
      target === "single"
        ? [payload.token!.trim()]
        : ((await env.DB.prepare(
            "SELECT token FROM notification_tokens WHERE is_active = 1"
          ).all<{ token: string }>()).results || []).map((row) => row.token);
    let totalSent = 0;
    let stalePruned = 0;
    const batchSize = 200;

    for (let index = 0; index < tokens.length; index += batchSize) {
      const batch = tokens.slice(index, index + batchSize);
      const results = await Promise.all(
        batch.map((token) =>
          sendMessage(projectId, accessToken, makeMessage(title, body, screen, { token }))
        )
      );
      for (let resultIndex = 0; resultIndex < results.length; resultIndex++) {
        const result = results[resultIndex];
        if (result.success) totalSent++;
        if (result.stale && target === "all") {
          stalePruned++;
          await env.DB.prepare(
            "UPDATE notification_tokens SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE token = ?"
          ).bind(batch[resultIndex]).run();
        }
      }
    }

    return json({
      success: true,
      total_attempted: tokens.length,
      total_sent: totalSent,
      stale_pruned: stalePruned,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push dispatch failed";
    return json({ success: false, error: message }, { status: 500 });
  }
};
