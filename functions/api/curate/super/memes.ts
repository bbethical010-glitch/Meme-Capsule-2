/**
 * GET /api/curate/super/memes
 * 
 * Returns paginated memes with multi-judge comparison matrices and final resolution status.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";

interface MemeRow {
  id: string;
  title: string | null;
  image_url: string | null;
  storage_path: string | null;
  curation_status: string | null;
  duplicate_of: string | null;
  topics: string | null;
  tone: string | null;
  humour_mechanisms: string | null;
  final_status: string | null;
  final_duplicate_of: string | null;
  final_topics: string | null;
  final_tone: string | null;
  final_mechanisms: string | null;
  final_note: string | null;
  resolved_at: string | null;
}

interface JudgeReviewRow {
  meme_id: string;
  user_id: string;
  user_name: string;
  username?: string;
  corpus_status: string;
  duplicate_of: string | null;
  topics: string;
  tone: string | null;
  humour_mechanisms: string;
  curator_note: string | null;
  reviewed_at: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    await ensureCurationTables(env.DB);
    const sessionUser = await validateSession(request, env);
    if (!sessionUser || sessionUser.role !== "superadmin") {
      return json({ error: "Superadmin credentials required." }, { status: 401 });
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get("per_page") || "20", 10)));
    const filter = url.searchParams.get("filter") || "all";
    const search = (url.searchParams.get("search") || "").trim();
    const offset = (page - 1) * perPage;
    const publicBase = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

    let baseQuery = `
      FROM memes m
      LEFT JOIN meme_curation_final f ON m.id = f.meme_id
      WHERE m.id NOT IN (SELECT meme_id FROM meme_force_removals)
    `;
    const params: (string | number)[] = [];

    if (search) {
      baseQuery += " AND (m.id LIKE ? OR m.title LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (filter === "resolved") {
      baseQuery += " AND COALESCE(f.corpus_status, m.curation_status) IS NOT NULL";
    } else if (filter === "unresolved") {
      baseQuery += `
        AND COALESCE(f.corpus_status, m.curation_status) IS NULL
        AND (
          SELECT COUNT(DISTINCT c.user_id)
          FROM meme_curation c JOIN cat_users u ON u.id = c.user_id
          WHERE c.meme_id = m.id AND u.username IN ('judge1', 'judge2', 'judge3')
        ) = 3
        AND (
          (
            SELECT COUNT(DISTINCT c.corpus_status)
            FROM meme_curation c JOIN cat_users u ON u.id = c.user_id
            WHERE c.meme_id = m.id AND u.username IN ('judge1', 'judge2', 'judge3')
          ) = 3
          OR (
            (SELECT COUNT(*) FROM meme_curation c JOIN cat_users u ON u.id = c.user_id
             WHERE c.meme_id = m.id AND u.username IN ('judge1', 'judge2', 'judge3') AND c.corpus_status = 'duplicate') >= 2
            AND (
              (SELECT COUNT(DISTINCT c.duplicate_of) FROM meme_curation c JOIN cat_users u ON u.id = c.user_id
               WHERE c.meme_id = m.id AND u.username IN ('judge1', 'judge2', 'judge3') AND c.corpus_status = 'duplicate') <> 1
              OR EXISTS (SELECT 1 FROM meme_curation c JOIN cat_users u ON u.id = c.user_id
                         WHERE c.meme_id = m.id AND u.username IN ('judge1', 'judge2', 'judge3')
                           AND c.corpus_status = 'duplicate' AND c.duplicate_of IS NULL)
            )
          )
        )
      `;
    }

    // Get total count
    const countRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt ${baseQuery}
    `).bind(...params).first<{ cnt: number }>();
    const total = countRes?.cnt ?? 0;
    const totalPages = Math.ceil(total / perPage);

    // Fetch memes for current page
    const query = `
      SELECT 
        m.id, m.title, m.image_url, m.storage_path,
        m.curation_status,
        m.duplicate_of,
        m.topics,
        m.tone,
        m.humour_mechanisms,
        COALESCE(f.corpus_status, m.curation_status) as final_status,
        COALESCE(f.duplicate_of, m.duplicate_of) as final_duplicate_of,
        COALESCE(f.topics, m.topics) as final_topics,
        COALESCE(f.tone, m.tone) as final_tone,
        COALESCE(f.humour_mechanisms, m.humour_mechanisms) as final_mechanisms,
        f.curator_note as final_note,
        f.resolved_at
      ${baseQuery}
      ORDER BY 
        CASE WHEN COALESCE(f.corpus_status, m.curation_status) IS NULL THEN 0 ELSE 1 END ASC,
        m.uploaded_at ASC
      LIMIT ? OFFSET ?
    `;

    const { results: memeRows } = await env.DB.prepare(query)
      .bind(...params, perPage, offset)
      .all<MemeRow>();

    const memes = memeRows || [];
    const memeIds = memes.map((m) => m.id);

    // Fetch all judge reviews for these memes (Both Human and AI judges)
    let reviews: JudgeReviewRow[] = [];
    if (memeIds.length > 0) {
      const placeholders = memeIds.map(() => "?").join(",");
      const { results: reviewResults } = await env.DB.prepare(`
        SELECT 
          c.meme_id, c.user_id, c.user_name, c.corpus_status, c.duplicate_of,
          c.topics, c.tone, c.humour_mechanisms, c.curator_note, c.reviewed_at,
          u.username
        FROM meme_curation c
        JOIN cat_users u ON u.id = c.user_id
        WHERE c.meme_id IN (${placeholders})
          AND u.username IN ('judge1', 'judge2', 'judge3', 'judge4', 'judge5')
        ORDER BY 
          CASE u.username
            WHEN 'judge1' THEN 1
            WHEN 'judge2' THEN 2
            WHEN 'judge3' THEN 3
            WHEN 'judge4' THEN 4
            WHEN 'judge5' THEN 5
            ELSE 6
          END ASC
      `).bind(...memeIds).all<JudgeReviewRow>();
      reviews = reviewResults || [];
    }

    const reviewsByMeme = new Map<string, JudgeReviewRow[]>();
    for (const r of reviews) {
      if (!reviewsByMeme.has(r.meme_id)) {
        reviewsByMeme.set(r.meme_id, []);
      }
      reviewsByMeme.get(r.meme_id)!.push(r);
    }

    const data = memes.map((m) => {
      const fullUrl = m.image_url || (m.storage_path && publicBase ? `${publicBase}/${m.storage_path.replace(/^\/+/, "")}` : "") || "";
      const memeReviews = reviewsByMeme.get(m.id) || [];

      // Determine consensus state STRICTLY from the 3 human judges.
      // AI Judges (Judge 4 & 5) provide reference context only and NEVER push conflicts.
      const humanReviews = memeReviews.filter((r) => ["judge1", "judge2", "judge3"].includes(r.username || ""));

      let consensusStatus = "unreviewed";
      if (m.final_status) {
        consensusStatus = "resolved";
      } else if (humanReviews.length === 0) {
        consensusStatus = "unreviewed";
      } else if (humanReviews.length < 3) {
        consensusStatus = "pending_reviews";
      } else {
        // All 3 human judges have submitted reviews
        const statusCounts = new Map<string, number>();
        for (const r of humanReviews) {
          statusCounts.set(r.corpus_status, (statusCounts.get(r.corpus_status) || 0) + 1);
        }

        const keepCount = statusCounts.get("keep") || 0;
        const excludeCount = statusCounts.get("excluded") || 0;
        const dupCount = statusCounts.get("duplicate") || 0;
        const laterCount = statusCounts.get("review_later") || 0;

        // 1. Unanimous (3:0) agreements
        if (keepCount === 3) {
          consensusStatus = "unanimous_keep";
        } else if (excludeCount === 3) {
          consensusStatus = "unanimous_exclude";
        } else if (dupCount === 3) {
          const targets = new Set(humanReviews.filter((r) => r.corpus_status === "duplicate").map((r) => r.duplicate_of?.trim() || null));
          consensusStatus = (targets.size === 1 && !targets.has(null)) ? "unanimous_duplicate" : "conflict";
        } else if (laterCount === 3) {
          consensusStatus = "unanimous_review_later";
        }
        // 2. Clear 2:1 Majorities (Majority wins!)
        else if (keepCount === 2) {
          consensusStatus = "majority_keep";
        } else if (excludeCount === 2) {
          consensusStatus = "majority_exclude";
        } else if (dupCount === 2) {
          const targets = new Set(humanReviews.filter((r) => r.corpus_status === "duplicate").map((r) => r.duplicate_of?.trim() || null));
          consensusStatus = (targets.size === 1 && !targets.has(null)) ? "majority_duplicate" : "conflict";
        } else if (laterCount === 2) {
          consensusStatus = "majority_review_later";
        }
        // 3. True 1:1:1 Split (each judge voted differently)
        else {
          consensusStatus = "conflict";
        }
      }

      let parsedFinalTopics: string[] = [];
      let parsedFinalMechanisms: string[] = [];
      try {
        if (m.final_topics) parsedFinalTopics = JSON.parse(m.final_topics);
      } catch {
        parsedFinalTopics = [];
      }
      try {
        if (m.final_mechanisms) parsedFinalMechanisms = JSON.parse(m.final_mechanisms);
      } catch {
        parsedFinalMechanisms = [];
      }

      const formattedReviews = memeReviews.map((r) => {
        let tList: string[] = [];
        let mList: string[] = [];
        try {
          tList = JSON.parse(r.topics);
        } catch {
          tList = [];
        }
        try {
          mList = JSON.parse(r.humour_mechanisms);
        } catch {
          mList = [];
        }
        return {
          user_id: r.user_id,
          user_name: r.user_name,
          corpus_status: r.corpus_status,
          duplicate_of: r.duplicate_of,
          topics: tList,
          tone: r.tone,
          humour_mechanisms: mList,
          curator_note: r.curator_note,
          reviewed_at: r.reviewed_at
        };
      });

      return {
        id: m.id,
        title: m.title || "Untitled Meme",
        image_url: fullUrl,
        consensus_status: consensusStatus,
        judges_count: memeReviews.length,
        judges: formattedReviews,
        ai_judge: null,
        final_decision: m.final_status ? {
          corpus_status: m.final_status,
          duplicate_of: m.final_duplicate_of,
          topics: parsedFinalTopics,
          tone: m.final_tone,
          humour_mechanisms: parsedFinalMechanisms,
          curator_note: m.final_note,
          resolved_at: m.resolved_at
        } : null
      };
    });

    return json({
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      memes: data
    });
  } catch (err: unknown) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Error listing superadmin memes";
    return json({ error: msg }, { status: 500 });
  }
};
