/**
 * GET /api/curate/next
 *
 * Fetches the next/previous meme in the chosen curation queue for the
 * current curator and exposes the AI pre-judge prediction as read-only
 * context for the human judges.
 *
 * IMPORTANT:
 * - AI predictions are NEVER written into meme_curation.
 * - AI predictions are NEVER written into meme_curation_final.
 * - Human curator decisions remain authoritative.
 * - ai_prediction is returned only as a suggestion/context object.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, handleD1Error, type Env } from "../../_shared/d1r2";
import { validateSession } from "../../_shared/catAuth";
import { ensureAIPredictionTable, ensureCurationTables, ensureForceRemovalsTable } from "../../_shared/curateDb";

// In-memory isolate cache for static total memes count
// Avoids scanning 10,000+ rows on every single swipe
interface StatsCache {
  total: number;
  expiresAt: number;
}
let statsCache: StatsCache | null = null;
const STATS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
let tablesEnsured = false;

interface MemeRow {
  id: string;
  title: string | null;
  image_url: string | null;
  storage_path: string | null;
  is_nsfw: number;
  nsfw_flagged_by?: string | null;

  corpus_status: string | null;
  duplicate_of: string | null;
  topics: string | null;
  tone: string | null;
  humour_mechanisms: string | null;
  curator_note: string | null;
  user_id: string | null;
  user_name: string | null;
  reviewed_at: string | null;
  updated_at: string | null;

  ai_topics: string | null;
  ai_corpus_status: string | null;
  ai_tone: string | null;
  ai_humour_mechanisms: string | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  ai_model: string | null;
  ai_tokens_used: number | null;
  ai_processing_ms: number | null;
  ai_error: string | null;
  ai_updated_at: string | null;
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildCuration(row: MemeRow) {
  if (!row.corpus_status) return null;

  return {
    corpus_status: row.corpus_status,
    duplicate_of: row.duplicate_of,
    topics: parseJsonArray(row.topics),
    tone: row.tone,
    humour_mechanisms: parseJsonArray(row.humour_mechanisms),
    curator_note: row.curator_note,
    user_id: row.user_id,
    user_name: row.user_name,
    reviewed_at: row.reviewed_at,
    updated_at: row.updated_at,
  };
}

function buildAIPrediction(row: MemeRow) {
  // No AI result for this meme yet.
  if (
    !row.ai_corpus_status &&
    !row.ai_topics &&
    !row.ai_tone &&
    !row.ai_humour_mechanisms &&
    row.ai_confidence === null &&
    !row.ai_reasoning &&
    !row.ai_model
  ) {
    return null;
  }

  return {
    topics: parseJsonArray(row.ai_topics),
    corpus_status: row.ai_corpus_status,
    tone: row.ai_tone,
    humour_mechanisms: parseJsonArray(row.ai_humour_mechanisms),
    confidence: Number(row.ai_confidence ?? 0),
    reasoning: row.ai_reasoning,
    model: row.ai_model,
    tokens_used: Number(row.ai_tokens_used ?? 0),
    processing_ms: Number(row.ai_processing_ms ?? 0),
    error: row.ai_error,
    updated_at: row.ai_updated_at,
  };
}

const SELECT_COLUMNS = `
  m.id,
  m.title,
  m.image_url,
  m.storage_path,
  m.is_nsfw,
  m.nsfw_flagged_by,

  COALESCE(c.corpus_status, mcf.corpus_status) AS corpus_status,
  COALESCE(c.duplicate_of, mcf.duplicate_of) AS duplicate_of,
  COALESCE(c.topics, mcf.topics) AS topics,
  COALESCE(c.tone, mcf.tone) AS tone,
  COALESCE(c.humour_mechanisms, mcf.humour_mechanisms) AS humour_mechanisms,
  COALESCE(c.curator_note, mcf.curator_note) AS curator_note,
  COALESCE(c.user_id, mcf.resolved_by) AS user_id,
  COALESCE(c.user_name, mcf.resolved_by) AS user_name,
  COALESCE(c.reviewed_at, mcf.resolved_at) AS reviewed_at,
  COALESCE(c.updated_at, mcf.updated_at) AS updated_at,

  ai.topics            AS ai_topics,
  ai.corpus_status     AS ai_corpus_status,
  ai.tone              AS ai_tone,
  ai.humour_mechanisms AS ai_humour_mechanisms,
  ai.confidence        AS ai_confidence,
  ai.reasoning         AS ai_reasoning,
  ai.model             AS ai_model,
  ai.tokens_used       AS ai_tokens_used,
  ai.processing_ms     AS ai_processing_ms,
  ai.error             AS ai_error,
  ai.updated_at        AS ai_updated_at
`;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    if (!tablesEnsured) {
      await ensureCurationTables(env.DB);
      await ensureAIPredictionTable(env.DB);
      await ensureForceRemovalsTable(env.DB);
      tablesEnsured = true;
    }

    const sessionUser = await validateSession(request, env);
    const userId = sessionUser?.id || "user-judge1";

    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "unreviewed";
    const currentId = url.searchParams.get("current_id") || "";
    const direction = url.searchParams.get("direction") || "next";
    const includeStats = url.searchParams.get("include_stats") === "true";
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "1", 10), 1), 10);
    const publicBase = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");

    // 1. Overall counts for this judge across the entire corpus.
    // Heavy COUNT(*) table scans are COMPLETELY BYPASSED during continuous swiping (saving 25,000 reads/swipe)
    // and executed only on initial load or explicit include_stats=true.
    let statsResponse: { total: number; reviewed: number; remaining: number; current_index: number } | null = null;

    if (includeStats) {
      let total = 0;
      let reviewed = 0;

      const isCacheExpired = !statsCache || Date.now() > statsCache.expiresAt;
      if (!statsCache || isCacheExpired) {
        try {
          const totalRes = await env.DB.prepare("SELECT COUNT(1) as cnt FROM memes").first<{ cnt: number }>();
          const forceRes = await env.DB.prepare("SELECT COUNT(1) as cnt FROM meme_force_removals").first<{ cnt: number }>();
          total = Math.max(0, (totalRes?.cnt ?? 0) - (forceRes?.cnt ?? 0));
        } catch {
          const totalRes = await env.DB.prepare("SELECT COUNT(1) as cnt FROM memes").first<{ cnt: number }>();
          total = totalRes?.cnt ?? 0;
        }

        statsCache = {
          total,
          expiresAt: Date.now() + STATS_CACHE_TTL_MS
        };
      } else {
        total = statsCache.total;
      }

      // Read reviewed count directly from indexed meme_curation table
      // This is an indexed point scan of ~200 rows instead of a 25,000-row table scan
      try {
        const reviewedRes = await env.DB.prepare(
          "SELECT COUNT(1) as cnt FROM meme_curation WHERE user_id = ?"
        ).bind(userId).first<{ cnt: number }>();
        reviewed = reviewedRes?.cnt ?? 0;
      } catch {
        reviewed = 0;
      }

      const remaining = Math.max(0, total - reviewed);
      statsResponse = {
        total,
        reviewed,
        remaining,
        current_index: reviewed + 1,
      };
    }

    // 2. Build the human-curation queue filter.
    // Use indexed LEFT JOIN antijoin for meme_force_removals
    let filterCondition = "";
    if (filter === "unreviewed") {
      filterCondition = "c.corpus_status IS NULL AND mcf.corpus_status IS NULL AND m.curation_status IS NULL";
    } else if (filter === "review_later") {
      filterCondition = "(m.curation_status = 'review_later' OR c.corpus_status = 'review_later' OR mcf.corpus_status = 'review_later')";
    } else if (filter === "keep") {
      filterCondition = "(m.curation_status = 'keep' OR c.corpus_status = 'keep' OR mcf.corpus_status = 'keep')";
    } else if (filter === "excluded") {
      filterCondition = "(m.curation_status = 'excluded' OR c.corpus_status = 'excluded' OR mcf.corpus_status = 'excluded')";
    } else if (filter === "duplicate") {
      filterCondition = "(m.curation_status = 'duplicate' OR c.corpus_status = 'duplicate' OR mcf.corpus_status = 'duplicate')";
    } else {
      filterCondition = "1=1";
    }

    let targetRows: MemeRow[] = [];

    // 3. Next/previous relative to current meme
    let currentUploadedAt: string | null = null;
    if (currentId) {
      const currentMeme = await env.DB.prepare(
        "SELECT id, uploaded_at FROM memes WHERE id = ?"
      ).bind(currentId).first<{ id: string; uploaded_at: string }>();
      if (currentMeme) {
        currentUploadedAt = currentMeme.uploaded_at;
      }
    }

    if (currentUploadedAt) {
      if (direction === "prev") {
        if (filter === "unreviewed") {
          // When looking for PREV in unreviewed mode, the previous meme reviewed by this judge is in meme_curation
          const prevRes = await env.DB.prepare(`
            SELECT
              ${SELECT_COLUMNS}
            FROM memes m
            LEFT JOIN meme_force_removals fr
              ON m.id = fr.meme_id
            LEFT JOIN meme_curation c
              ON m.id = c.meme_id
             AND c.user_id = ?
            LEFT JOIN meme_curation_final mcf
              ON m.id = mcf.meme_id
            LEFT JOIN ai_curation_predictions ai
              ON m.id = ai.meme_id
            WHERE fr.meme_id IS NULL
              AND c.user_id = ?
              AND c.corpus_status IS NOT NULL
              AND m.uploaded_at < ?
            ORDER BY m.uploaded_at DESC
            LIMIT 1
          `).bind(userId, userId, currentUploadedAt).all<MemeRow>();
          targetRows = prevRes.results || [];
        } else {
          const prevRes = await env.DB.prepare(`
            SELECT
              ${SELECT_COLUMNS}
            FROM memes m
            LEFT JOIN meme_force_removals fr
              ON m.id = fr.meme_id
            LEFT JOIN meme_curation c
              ON m.id = c.meme_id
             AND c.user_id = ?
            LEFT JOIN meme_curation_final mcf
              ON m.id = mcf.meme_id
            LEFT JOIN ai_curation_predictions ai
              ON m.id = ai.meme_id
            WHERE fr.meme_id IS NULL
              AND (${filterCondition})
              AND m.uploaded_at < ?
            ORDER BY m.uploaded_at DESC
            LIMIT 1
          `).bind(userId, currentUploadedAt).all<MemeRow>();
          targetRows = prevRes.results || [];
        }
      } else {
        // direction === "next"
        const nextRes = await env.DB.prepare(`
          SELECT
            ${SELECT_COLUMNS}
          FROM memes m
          LEFT JOIN meme_force_removals fr
            ON m.id = fr.meme_id
          LEFT JOIN meme_curation c
            ON m.id = c.meme_id
           AND c.user_id = ?
          LEFT JOIN meme_curation_final mcf
            ON m.id = mcf.meme_id
          LEFT JOIN ai_curation_predictions ai
            ON m.id = ai.meme_id
          WHERE fr.meme_id IS NULL
            AND (${filterCondition})
            AND m.uploaded_at > ?
          ORDER BY m.uploaded_at ASC
          LIMIT ${limit}
        `).bind(userId, currentUploadedAt).all<MemeRow>();
        targetRows = nextRes.results || [];
      }
    }

    // 4. Default: first meme(s) matching the selected queue if targetRows is empty
    if (targetRows.length === 0) {
      const defaultRes = await env.DB.prepare(`
        SELECT
          ${SELECT_COLUMNS}
        FROM memes m
        LEFT JOIN meme_force_removals fr
          ON m.id = fr.meme_id
        LEFT JOIN meme_curation c
          ON m.id = c.meme_id
         AND c.user_id = ?
        LEFT JOIN meme_curation_final mcf
          ON m.id = mcf.meme_id
        LEFT JOIN ai_curation_predictions ai
          ON m.id = ai.meme_id
        WHERE fr.meme_id IS NULL
          AND (${filterCondition})
        ORDER BY m.uploaded_at ASC
        LIMIT ${limit}
      `).bind(userId).all<MemeRow>();
      targetRows = defaultRes.results || [];
    }

    if (targetRows.length === 0) {
      return json({
        meme: null,
        memes: [],
        stats: statsResponse,
      });
    }

    // 5. Fetch Judge 4 and Judge 5 judgements for all fetched memes in a single query
    const targetIds = targetRows.map((r) => r.id);
    const placeholders = targetIds.map(() => "?").join(", ");
    const aiRows = await env.DB.prepare(`
      SELECT * FROM meme_curation 
      WHERE meme_id IN (${placeholders}) AND user_id IN ('user-judge4', 'user-judge5')
    `).bind(...targetIds).all();

    const aiRowsMap = new Map<string, { judge4?: any; judge5?: any }>();
    for (const r of (aiRows.results || []) as any[]) {
      const existing = aiRowsMap.get(r.meme_id) || {};
      if (r.user_id === "user-judge4") existing.judge4 = r;
      if (r.user_id === "user-judge5") existing.judge5 = r;
      aiRowsMap.set(r.meme_id, existing);
    }

    const formatAiCuration = (r: any) => {
      if (!r || !r.corpus_status) return null;
      return {
        corpus_status: r.corpus_status,
        duplicate_of: r.duplicate_of,
        topics: parseJsonArray(r.topics),
        tone: r.tone,
        humour_mechanisms: parseJsonArray(r.humour_mechanisms),
        curator_note: r.curator_note,
        user_id: r.user_id,
        user_name: r.user_name,
        reviewed_at: r.reviewed_at,
        updated_at: r.updated_at,
      };
    };

    const formattedMemes = targetRows.map((targetMeme) => {
      const fullUrl =
        targetMeme.image_url ||
        (
          targetMeme.storage_path &&
          publicBase
            ? `${publicBase}/${targetMeme.storage_path.replace(/^\/+/, "")}`
            : ""
        ) ||
        "";

      const aiData = aiRowsMap.get(targetMeme.id) || {};

      return {
        id: targetMeme.id,
        title: targetMeme.title || "Untitled Meme",
        image_url: fullUrl,
        storage_path: targetMeme.storage_path || "",
        is_nsfw: Boolean(targetMeme.is_nsfw),
        nsfw_flagged_by: targetMeme.nsfw_flagged_by || null,
        curation: buildCuration(targetMeme),
        ai_prediction: buildAIPrediction(targetMeme),
        ai_judgements: {
          judge4: formatAiCuration(aiData.judge4),
          judge5: formatAiCuration(aiData.judge5),
        },
      };
    });

    return json({
      meme: formattedMemes[0] || null,
      memes: formattedMemes,
      stats: statsResponse,
    });
  } catch (err: unknown) {
    return handleD1Error(err, "Error fetching next curation meme");
  }
};
