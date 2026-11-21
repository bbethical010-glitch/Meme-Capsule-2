/**
 * POST /api/curate/super/bulk-resolve
 * 
 * Auto-resolve is now automatic on the third vote.
 * This endpoint self-heals any backlog by running applyConsensus on unfinalized memes.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";
import { applyConsensus } from "../../../_shared/corpus";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    if (!sessionUser || sessionUser.role !== "superadmin") {
      return json({ error: "Superadmin credentials required." }, { status: 401 });
    }

    // Find all archive memes with 3 votes that have not been settled
    const { results } = await env.DB.prepare(`
      SELECT m.id
      FROM memes m
      JOIN (
        SELECT meme_id, COUNT(DISTINCT user_id) as v_cnt
        FROM meme_curation
        WHERE user_id IN ('user-judge1', 'user-judge2', 'user-judge3')
        GROUP BY meme_id
        HAVING v_cnt >= 3
      ) v ON m.id = v.meme_id
      WHERE m.corpus_status = 'archive'
      LIMIT 100
    `).all<{ id: string }>();

    let resolvedCount = 0;
    for (const row of results || []) {
      const res = await applyConsensus(env, row.id);
      if (res.settled) resolvedCount++;
    }

    return json({
      success: true,
      message: "Bulk consensus evaluation completed.",
      resolved: resolvedCount,
      total_candidates: results?.length || 0
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error executing bulk resolve";
    return json({ error: msg }, { status: 500 });
  }
};
