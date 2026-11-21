import type { PagesFunction } from "../_shared/pages";
import { json, type Env } from "../_shared/d1r2";

type LikePayload = {
  id: string;
  action: "like" | "unlike";
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const payload = (await request.json()) as LikePayload;
    const { id, action } = payload;

    if (!id || (action !== "like" && action !== "unlike")) {
      return json({ error: "Invalid parameters" }, { status: 400 });
    }

    // Check if the meme exists in D1
    const existing = await env.DB.prepare(
      "SELECT id, likes_count FROM memes WHERE id = ?"
    ).bind(id).first<{ id: string; likes_count: number }>();

    let newCount: number;

    if (existing) {
      // Meme exists in D1 — update likes count in place
      if (action === "like") {
        await env.DB.prepare(
          "UPDATE memes SET likes_count = likes_count + 1 WHERE id = ?"
        ).bind(id).run();
        newCount = existing.likes_count + 1;
      } else {
        await env.DB.prepare(
          "UPDATE memes SET likes_count = CASE WHEN likes_count > 0 THEN likes_count - 1 ELSE 0 END WHERE id = ?"
        ).bind(id).run();
        newCount = Math.max(0, existing.likes_count - 1);
      }
    } else {
      // Meme does not exist in D1 (e.g. static fallback meme or purged meme).
      // Under integrity rules, never auto-create memes rows from client telemetry.
      newCount = action === "like" ? 1 : 0;
    }

    return json({ success: true, likes_count: newCount });
  } catch (err: any) {
    console.error("Like endpoint error:", err);
    return json({ error: err.message || "Internal server error" }, { status: 500 });
  }
};
