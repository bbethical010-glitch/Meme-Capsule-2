/**
 * POST /api/curate/super/bulk-resolve
 * 
 * Atomically batch-resolves all unanimous judge decisions.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";

interface UnanimousGroupRow {
  meme_id: string;
  corpus_status: string;
  topics: string;
  tone: string | null;
  humour_mechanisms: string;
  duplicate_of: string | null;
  curator_note: string | null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    if (!sessionUser || sessionUser.role !== "superadmin") {
      return json({ error: "Superadmin credentials required." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { action?: string };
    const action = body.action || "unanimous_all";
    const now = new Date().toISOString();

    let candidateRows: UnanimousGroupRow[] = [];

    if (action === "majority_keep" || action === "majority_exclude") {
      const targetStatus = action === "majority_keep" ? "keep" : "excluded";
      const { results } = await env.DB.prepare(`
        SELECT 
          c.meme_id,
          '${targetStatus}' as corpus_status,
          MAX(c.topics) as topics,
          MAX(c.tone) as tone,
          MAX(c.humour_mechanisms) as humour_mechanisms,
          MAX(c.duplicate_of) as duplicate_of,
          MAX(c.curator_note) as curator_note
        FROM meme_curation c
        JOIN cat_users u ON u.id = c.user_id
        WHERE c.meme_id NOT IN (SELECT meme_id FROM meme_curation_final)
          AND u.username IN ('judge1', 'judge2', 'judge3')
          AND c.corpus_status = ?
        GROUP BY c.meme_id
        HAVING COUNT(*) >= 2
      `).bind(targetStatus).all<UnanimousGroupRow>();

      candidateRows = results || [];
    } else {
      // Find all memes reviewed by multiple human judges where all human reviews agree (Unanimous).
      // AI judges (4 & 5) provide reference context only and NEVER drive automated resolution.
      const { results } = await env.DB.prepare(`
        SELECT 
          c.meme_id,
          MIN(c.corpus_status) as corpus_status,
          MIN(c.topics) as topics,
          MIN(c.tone) as tone,
          MIN(c.humour_mechanisms) as humour_mechanisms,
          MIN(c.duplicate_of) as duplicate_of,
          MIN(c.curator_note) as curator_note,
          COUNT(DISTINCT c.corpus_status) as status_variants,
          COUNT(*) as total_reviews
        FROM meme_curation c
        JOIN cat_users u ON u.id = c.user_id
        WHERE c.meme_id NOT IN (SELECT meme_id FROM meme_curation_final)
          AND u.username IN ('judge1', 'judge2', 'judge3')
        GROUP BY c.meme_id
        HAVING status_variants = 1 AND total_reviews >= 2
      `).all<UnanimousGroupRow & { status_variants: number; total_reviews: number }>();

      candidateRows = (results || []).filter((r) => {
        if (action === "unanimous_keep") return r.corpus_status === "keep";
        if (action === "unanimous_exclude") return r.corpus_status === "excluded";
        return true;
      });
    }

    if (candidateRows.length === 0) {
      const label = action.startsWith("majority") ? "majority" : "unanimous";
      return json({ success: true, count: 0, message: `No ${label} memes pending resolution.` });
    }

    const stmts: D1PreparedStatement[] = [];

    for (const r of candidateRows) {
      stmts.push(
        env.DB.prepare(`
          INSERT INTO meme_curation_final (
            meme_id, corpus_status, duplicate_of, topics, tone, humour_mechanisms,
            curator_note, resolved_by, resolved_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(meme_id) DO UPDATE SET
            corpus_status = excluded.corpus_status,
            duplicate_of = excluded.duplicate_of,
            topics = excluded.topics,
            tone = excluded.tone,
            humour_mechanisms = excluded.humour_mechanisms,
            curator_note = excluded.curator_note,
            resolved_by = excluded.resolved_by,
            resolved_at = excluded.resolved_at,
            updated_at = excluded.updated_at
        `).bind(
          r.meme_id,
          r.corpus_status,
          r.duplicate_of || null,
          r.topics || "[]",
          r.tone || null,
          r.humour_mechanisms || "[]",
          r.curator_note || null,
          `Batch (${sessionUser.display_name})`,
          now,
          now
        )
      );

      // Superadmin Finalization: ONLY 'keep' becomes active, everything else becomes archived
      const isActive = r.corpus_status === "keep" ? 1 : 0;
      const newStatus = r.corpus_status === "keep" ? "active" : "archived";

      stmts.push(
        env.DB.prepare("UPDATE memes SET is_active = ?, status = ?, curation_status = ? WHERE id = ?").bind(isActive, newStatus, r.corpus_status, r.meme_id)
      );
    }

    // Run in batches of 50 to stay well within D1 batch limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < stmts.length; i += CHUNK_SIZE) {
      await env.DB.batch(stmts.slice(i, i + CHUNK_SIZE));
    }

    return json({
      success: true,
      count: candidateRows.length,
      message: `Successfully resolved ${candidateRows.length} ${action.startsWith("majority") ? "majority" : "unanimous"} memes.`
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error bulk resolving memes";
    return json({ error: msg }, { status: 500 });
  }
};
