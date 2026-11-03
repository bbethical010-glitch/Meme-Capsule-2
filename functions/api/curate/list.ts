/**
 * GET /api/curate/list
 * 
 * Returns paginated browse list of memes with their curation state.
 */

import type { PagesFunction } from "../../_shared/pages";
import { json, type Env } from "../../_shared/d1r2";
import { hasIngestionSchema } from "../../_shared/ingestion";

interface MemeRow {
  id: string;
  title: string | null;
  image_url: string | null;
  storage_path: string | null;
  corpus_status: string | null;
  duplicate_of: string | null;
  topics: string | null;
  tone: string | null;
  humour_mechanisms: string | null;
  curator_note: string | null;
  reviewed_at: string | null;
  updated_at: string | null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "24", 10)));
    const filter = url.searchParams.get("filter") || "all";
    const offset = (page - 1) * perPage;
    const publicBase = (env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
    const ingestionReady = await hasIngestionSchema(env.DB);
    const ingestionJoin = ingestionReady ? "LEFT JOIN ingestion_jobs ij ON m.id = ij.meme_id" : "";

    let whereClause = "WHERE m.id NOT IN (SELECT meme_id FROM meme_force_removals)";
    if (ingestionReady) {
      whereClause += " AND (ij.meme_id IS NULL OR ij.state = 'human_ready')";
    }
    if (filter === "unreviewed") {
      whereClause += " AND c.corpus_status IS NULL";
    } else if (filter === "review_later") {
      whereClause += " AND c.corpus_status = 'review_later'";
    } else if (filter === "keep") {
      whereClause += " AND c.corpus_status = 'keep'";
    } else if (filter === "excluded") {
      whereClause += " AND c.corpus_status = 'excluded'";
    } else if (filter === "duplicate") {
      whereClause += " AND c.corpus_status = 'duplicate'";
    }

    const countRes = await env.DB.prepare(`
      SELECT COUNT(*) as cnt
      FROM memes m
      LEFT JOIN meme_curation c ON m.id = c.meme_id
      ${ingestionJoin}
      ${whereClause}
    `).first<{ cnt: number }>();
    const total = countRes?.cnt ?? 0;
    const totalPages = Math.ceil(total / perPage);

    const { results } = await env.DB.prepare(`
      SELECT 
        m.id, m.title, m.image_url, m.storage_path,
        c.corpus_status, c.duplicate_of, c.topics, c.tone,
        c.humour_mechanisms, c.curator_note, c.reviewed_at, c.updated_at
      FROM memes m
      LEFT JOIN meme_curation c ON m.id = c.meme_id
      ${ingestionJoin}
      ${whereClause}
      ORDER BY 
        CASE WHEN c.corpus_status IS NULL THEN 0 ELSE 1 END ASC,
        m.uploaded_at ASC
      LIMIT ? OFFSET ?
    `).bind(perPage, offset).all<MemeRow>();

    const rows = results || [];

    const memes = rows.map((r) => {
      const fullUrl = r.image_url || (r.storage_path && publicBase ? `${publicBase}/${r.storage_path.replace(/^\/+/, "")}` : "") || "";
      let topicsList: string[] = [];
      let mechanismsList: string[] = [];

      try {
        if (r.topics) topicsList = JSON.parse(r.topics);
      } catch {
        topicsList = [];
      }
      try {
        if (r.humour_mechanisms) mechanismsList = JSON.parse(r.humour_mechanisms);
      } catch {
        mechanismsList = [];
      }

      return {
        id: r.id,
        title: r.title || "Untitled Meme",
        image_url: fullUrl,
        storage_path: r.storage_path || "",
        corpus_status: r.corpus_status,
        duplicate_of: r.duplicate_of,
        topics: topicsList,
        tone: r.tone,
        humour_mechanisms: mechanismsList,
        curator_note: r.curator_note,
        reviewed_at: r.reviewed_at,
        updated_at: r.updated_at
      };
    });

    return json({
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      memes
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error listing curation memes";
    return json({ error: msg }, { status: 500 });
  }
};
