/**
 * GET /api/curate/super/memes
 * 
 * Returns paginated memes with multi-judge comparison matrices and final resolution status.
 */

import type { PagesFunction } from "../../../_shared/pages";
import { json, type Env } from "../../../_shared/d1r2";
import { validateSession } from "../../../_shared/catAuth";
import { ensureCurationTables } from "../../../_shared/curateDb";
import { hasCorpusStatusColumn } from "../../../_shared/corpus";
import { evaluateConsensus } from "../../../_shared/corpus";

interface MemeRow {
  id: string;
  title: string | null;
  image_url: string | null;
  storage_path: string | null;
  corpus_status: string;
  excluded_at: string | null;
  purge_at: string | null;
  exclusion_reason: string | null;
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
    const filter = (url.searchParams.get("filter") || "all").toLowerCase();
    const search = (url.searchParams.get("search") || "").trim();
    const offset = (page - 1) * perPage;
    const publicBase = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

    const hasCol = await hasCorpusStatusColumn(env.DB);
    let baseQuery = `
      FROM memes m
      LEFT JOIN meme_curation_final f ON m.id = f.meme_id
      WHERE NOT EXISTS (SELECT 1 FROM meme_force_removals r WHERE r.meme_id = m.id)
    `;
    const params: (string | number)[] = [];

    if (search) {
      baseQuery += " AND (m.id LIKE ? OR m.title LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    if (["draft", "archive", "active", "conflict", "conflicts", "excluded"].includes(filter)) {
      const targetState = filter === "conflicts" ? "conflict" : filter;
      if (hasCol) {
        baseQuery += ` AND (m.corpus_status = ? OR (m.corpus_status IS NULL AND CASE 
          WHEN m.is_active = 1 AND m.status = 'active' THEN 'active'
          WHEN m.curation_status = 'excluded' THEN 'excluded'
          WHEN m.status = 'archived' THEN 'archive'
          WHEN m.status = 'draft' THEN 'draft'
          ELSE 'draft'
        END = ?))`;
        params.push(targetState, targetState);
      } else {
        if (targetState === "active") {
          baseQuery += " AND m.is_active = 1 AND m.status = 'active'";
        } else if (targetState === "excluded") {
          baseQuery += " AND m.curation_status = 'excluded'";
        } else if (targetState === "archive") {
          baseQuery += " AND m.status = 'archived' AND (m.curation_status IS NULL OR m.curation_status != 'excluded')";
        } else if (targetState === "draft") {
          baseQuery += " AND m.status = 'draft'";
        } else {
          baseQuery += " AND 1=0";
        }
      }
    } else if (filter === "resolved") {
      if (hasCol) {
        baseQuery += " AND (m.corpus_status IN ('active', 'excluded') OR (m.corpus_status IS NULL AND (m.is_active = 1 OR m.curation_status = 'excluded')))";
      } else {
        baseQuery += " AND (m.is_active = 1 OR m.curation_status = 'excluded')";
      }
    } else if (filter === "unresolved") {
      if (hasCol) {
        baseQuery += " AND m.corpus_status = 'conflict'";
      } else {
        baseQuery += " AND 1=0";
      }
    }

    // Get total count
    const countRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt ${baseQuery}
    `).bind(...params).first<{ cnt: number }>();
    const total = countRes?.cnt ?? 0;
    const totalPages = Math.ceil(total / perPage);

    // Fetch memes for current page - ultra-fast indexed execution
    const selectCols = hasCol
      ? `
        m.id, m.title, m.image_url, m.storage_path,
        COALESCE(m.corpus_status, CASE 
          WHEN m.is_active = 1 AND m.status = 'active' THEN 'active'
          WHEN m.curation_status = 'excluded' THEN 'excluded'
          WHEN m.status = 'archived' THEN 'archive'
          WHEN m.status = 'draft' THEN 'draft'
          ELSE 'draft'
        END) as corpus_status,
        m.excluded_at, m.purge_at, m.exclusion_reason,
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
      `
      : `
        m.id, m.title, m.image_url, m.storage_path,
        CASE 
          WHEN m.is_active = 1 AND m.status = 'active' THEN 'active'
          WHEN m.curation_status = 'excluded' THEN 'excluded'
          WHEN m.status = 'archived' THEN 'archive'
          WHEN m.status = 'draft' THEN 'draft'
          ELSE 'draft'
        END as corpus_status,
        NULL as excluded_at, NULL as purge_at, NULL as exclusion_reason,
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
      `;

    const query = `
      SELECT ${selectCols}
      ${baseQuery}
      ORDER BY m.uploaded_at DESC
      LIMIT ? OFFSET ?
    `;

    const { results: memeRows } = await env.DB.prepare(query)
      .bind(...params, perPage, offset)
      .all<MemeRow>();

    const memes = memeRows || [];
    const memeIds = memes.map((m) => m.id);

    // Fetch all judge reviews for these memes (Human and AI judges)
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
          AND (u.username IN ('judge1', 'judge2', 'judge3', 'judge4', 'ai-judge') OR u.id = 'user-judge4')
        ORDER BY 
          CASE u.username
            WHEN 'judge1' THEN 1
            WHEN 'judge2' THEN 2
            WHEN 'judge3' THEN 3
            WHEN 'judge4' THEN 4
            WHEN 'ai-judge' THEN 4
            ELSE 5
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

      // Consensus evaluated strictly from designated human judges
      const humanReviews = memeReviews.filter((r) => ["judge1", "judge2", "judge3"].includes(r.username || ""));

      // Build vote decision list for evaluateConsensus
      const voteEntries = humanReviews.map((r) => ({
        userId: r.user_id,
        decision: (r.corpus_status === "keep" || r.corpus_status === "excluded" || r.corpus_status === "duplicate")
          ? (r.corpus_status as "keep" | "excluded" | "duplicate")
          : ("excluded" as const),
        duplicateOf: r.duplicate_of || undefined
      }));

      const consensus = evaluateConsensus(voteEntries);

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
        corpus_status: m.corpus_status,
        excluded_at: m.excluded_at,
        purge_at: m.purge_at,
        exclusion_reason: m.exclusion_reason,
        consensus_status: consensus.outcome,
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
