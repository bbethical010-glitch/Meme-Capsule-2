/**
 * POST /api/admin/send-push
 * Protected by ADMIN_API_TOKEN.
 * Broadcasts or tests push notifications across registered FCM devices.
 */
import type { PagesFunction } from "../../_shared/pages";
import { json, requireAdmin, handleD1Error, type Env } from "../../_shared/d1r2";
import { getGoogleOAuthToken, sendFcmMessage } from "../notifications/_fcm";

interface PushRequestPayload {
  title: string;
  body: string;
  screen?: string;
  meme_id?: string;
  test_token?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authErr = requireAdmin(request, env);
  if (authErr) return authErr;

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    return json(
      {
        success: false,
        error: "Firebase secrets (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not configured.",
      },
      { status: 503 }
    );
  }

  let payload: PushRequestPayload;
  try {
    payload = (await request.json()) as PushRequestPayload;
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, body, screen = "home", meme_id = "", test_token } = payload;
  if (!title || !body) {
    return json({ success: false, error: "'title' and 'body' are required." }, { status: 400 });
  }

  try {
    const accessToken = await getGoogleOAuthToken(
      env.FIREBASE_CLIENT_EMAIL,
      env.FIREBASE_PRIVATE_KEY
    );

    let tokens: string[] = [];
    if (test_token) {
      tokens = [test_token.trim()];
    } else {
      const { results } = await env.DB.prepare(
        "SELECT token FROM notification_tokens WHERE is_active = 1"
      ).all<{ token: string }>();
      tokens = (results || []).map((r) => r.token);
    }

    if (tokens.length === 0) {
      return json({ success: true, message: "No active devices found to notify.", total: 0 });
    }

    let sent = 0;
    let failed = 0;
    let deactivated = 0;

    const CHUNK_SIZE = 25;
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map((tok) =>
          sendFcmMessage(env, accessToken, {
            token: tok,
            title,
            body,
            data: { screen, meme_id },
          })
        )
      );

      for (let j = 0; j < results.length; j++) {
        const res = results[j];
        const tok = chunk[j];
        if (res.success) {
          sent++;
        } else {
          failed++;
          if (res.unregistered) {
            deactivated++;
            await env.DB.prepare(
              "UPDATE notification_tokens SET is_active = 0, updated_at = datetime('now') WHERE token = ?"
            )
              .bind(tok)
              .run();
          }
        }
      }
    }

    return json({
      success: true,
      total: tokens.length,
      sent,
      failed,
      deactivated,
    });
  } catch (err: any) {
    return handleD1Error(err, err?.message || "Failed to dispatch push notifications");
  }
};
