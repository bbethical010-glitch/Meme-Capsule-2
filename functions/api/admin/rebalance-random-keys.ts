/**
 * POST /api/admin/rebalance-random-keys
 * Redistributes active meme random keys across the [0, 1) range.
 */
import type { PagesFunction } from "../../_shared/pages";
import { json, requireAdmin, type Env, handleD1Error } from "../../_shared/d1r2";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;

  try {
    const result = await env.DB.prepare(`
      UPDATE memes
      SET random_key = (abs(random()) / 9223372036854775807.0)
      WHERE is_active = 1
    `).run();
    return json({
      success: true,
      updated: result.meta.changes || 0,
      message: "Active meme random keys were redistributed.",
    });
  } catch (error) {
    return handleD1Error(error, "Failed to rebalance meme random keys");
  }
};
