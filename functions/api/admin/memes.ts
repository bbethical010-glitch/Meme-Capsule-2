import type { Meme } from "../../../src/types";
import type { PagesFunction } from "../../_shared/pages";
import {
  json,
  normalizeRow,
  requireAdmin,
  type D1MemeRow,
  type Env
} from "../../_shared/d1r2";

type SavePayload = {
  meme?: Partial<Meme>;
  originalId?: string | null;
};

type DeletePayload = {
  id?: string;
};

const idPattern = /^[a-z0-9][a-z0-9-_]{2,80}$/i;

const allowedRarity = new Set(["Common", "Rare", "Legendary"]);
const allowedStatus = new Set(["active", "draft", "archived"]);
const allowedMediaType = new Set(["image", "video"]);
const allowedInputMethod = new Set(["url", "upload", "google-drive", "seed"]);

const sanitizeTags = (tags: unknown) =>
  Array.isArray(tags)
    ? tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 12)
    : [];

const toD1Row = (meme: Partial<Meme>) => {
  const id = String(meme.id || "").trim();
  if (!idPattern.test(id)) {
    throw new Error("Meme ID must be 3-80 characters and use letters, numbers, hyphens, or underscores.");
  }

  const storagePath = meme.storage_path?.trim() || "";
  const imageUrl = meme.url?.trim() || "";

  if (!storagePath && !imageUrl) {
    throw new Error("A meme needs either a direct URL or an R2 storage path.");
  }

  if (!storagePath && imageUrl.startsWith("data:")) {
    throw new Error("Data URLs cannot be saved to metadata. Upload the file first.");
  }

  const status = allowedStatus.has(String(meme.status)) ? meme.status : "draft";
  const mediaType = allowedMediaType.has(String(meme.media_type)) ? meme.media_type : "image";
  const inputMethod = allowedInputMethod.has(String(meme.input_method)) ? meme.input_method : "url";
  const rarity = allowedRarity.has(String(meme.rarity)) ? meme.rarity : "Common";

  return {
    id,
    title: String(meme.title || id).trim() || id,
    image_url: storagePath ? null : imageUrl,
    storage_path: storagePath || null,
    source_link: meme.source_link?.trim() || imageUrl || storagePath,
    category: meme.category?.trim() || "Unsorted",
    tags: JSON.stringify(sanitizeTags(meme.tags)),
    rarity,
    status,
    media_type: mediaType,
    input_method: inputMethod,
    is_active: status === "active" ? 1 : 0,
    rights_note: meme.rights_note?.trim() || "reviewed",
    share_text: meme.share_text?.trim() || meme.title?.trim() || "Spawned from Meme Capsule",
    random_key: Math.random()
  };
};

const parsePayload = async <T>(request: Request) => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
};

// GET /api/admin/memes — list memes with optional server-side filtering, pagination, and stats
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const isVaultQuery =
    url.searchParams.has("page") ||
    url.searchParams.has("per_page") ||
    url.searchParams.has("limit") ||
    url.searchParams.has("q") ||
    url.searchParams.has("status") ||
    url.searchParams.has("curation_status") ||
    url.searchParams.has("nsfw") ||
    url.searchParams.has("sort_by") ||
    url.searchParams.has("stats");

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const rawLimit = parseInt(url.searchParams.get("per_page") || url.searchParams.get("limit") || (isVaultQuery ? "50" : "0"), 10);
  const perPage = rawLimit > 0 ? Math.max(1, Math.min(100, rawLimit)) : 0;
  const offset = (page - 1) * perPage;

  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const statusFilter = (url.searchParams.get("status") || "all").trim().toLowerCase();
  const curationFilter = (url.searchParams.get("curation_status") || "all").trim().toLowerCase();
  const nsfwFilter = (url.searchParams.get("nsfw") || "all").trim().toLowerCase();

  // Sort whitelist
  const allowedSortColumns: Record<string, string> = {
    uploaded_at: "m.uploaded_at",
    title: "m.title",
    id: "m.id",
    likes_count: "m.likes_count"
  };
  const sortByParam = (url.searchParams.get("sort_by") || "uploaded_at").trim().toLowerCase();
  const sortCol = allowedSortColumns[sortByParam] || "m.uploaded_at";
  const sortDir = (url.searchParams.get("sort_dir") || "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC";

  // Build WHERE conditions and parameters
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (q) {
    conditions.push("(LOWER(m.title) LIKE ? OR LOWER(m.id) LIKE ? OR LOWER(m.category) LIKE ? OR LOWER(m.tags) LIKE ?)");
    const searchPattern = `%${q}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (statusFilter && statusFilter !== "all") {
    if (statusFilter === "active" || statusFilter === "draft" || statusFilter === "archived") {
      conditions.push("m.status = ?");
      params.push(statusFilter);
    }
  }

  if (curationFilter && curationFilter !== "all") {
    if (curationFilter === "keep") {
      conditions.push("(m.curation_status = 'keep' OR f.corpus_status = 'keep')");
    } else if (curationFilter === "excluded") {
      conditions.push("(m.curation_status = 'excluded' OR f.corpus_status = 'excluded')");
    } else if (curationFilter === "review_later") {
      conditions.push("(m.curation_status = 'review_later' OR f.corpus_status = 'review_later')");
    } else if (curationFilter === "unreviewed") {
      conditions.push("(m.curation_status IS NULL AND f.corpus_status IS NULL)");
    }
  }

  if (nsfwFilter && nsfwFilter !== "all") {
    if (nsfwFilter === "nsfw" || nsfwFilter === "1") {
      conditions.push("m.is_nsfw = 1");
    } else if (nsfwFilter === "safe" || nsfwFilter === "0") {
      conditions.push("(m.is_nsfw = 0 OR m.is_nsfw IS NULL)");
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // 1. Calculate corpus statistics if requested
  let stats: { total: number; active: number; drafts: number; archived: number; excluded: number; nsfw: number } | undefined;
  if (isVaultQuery || url.searchParams.get("stats") === "1" || url.searchParams.get("stats") === "true") {
    try {
      const statsRow = await env.DB.prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN m.status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN m.status = 'draft' THEN 1 ELSE 0 END) as drafts,
          SUM(CASE WHEN m.status = 'archived' AND (m.curation_status IS NULL OR m.curation_status != 'excluded') AND (f.corpus_status IS NULL OR f.corpus_status != 'excluded') THEN 1 ELSE 0 END) as archived,
          SUM(CASE WHEN m.curation_status = 'excluded' OR f.corpus_status = 'excluded' THEN 1 ELSE 0 END) as excluded,
          SUM(CASE WHEN m.is_nsfw = 1 THEN 1 ELSE 0 END) as nsfw
         FROM memes m
         LEFT JOIN meme_curation_final f ON m.id = f.meme_id`
      ).first<{ total: number; active: number; drafts: number; archived: number; excluded: number; nsfw: number }>();

      if (statsRow) {
        stats = {
          total: Number(statsRow.total) || 0,
          active: Number(statsRow.active) || 0,
          drafts: Number(statsRow.drafts) || 0,
          archived: Number(statsRow.archived) || 0,
          excluded: Number(statsRow.excluded) || 0,
          nsfw: Number(statsRow.nsfw) || 0
        };
      }
    } catch {
      // Non-blocking fallback
    }
  }

  // 2. Count filtered rows
  let totalCount = 0;
  if (isVaultQuery) {
    const countSql = `SELECT COUNT(*) as filtered_count FROM memes m LEFT JOIN meme_curation_final f ON m.id = f.meme_id ${whereClause}`;
    const countStmt = params.length > 0 ? env.DB.prepare(countSql).bind(...params) : env.DB.prepare(countSql);
    const countRes = await countStmt.first<{ filtered_count: number }>();
    totalCount = Number(countRes?.filtered_count) || 0;
  }

  // 3. Fetch query page (or all if unbounded legacy)
  let querySql = `
    SELECT m.*, f.corpus_status as final_status
    FROM memes m
    LEFT JOIN meme_curation_final f ON m.id = f.meme_id
    ${whereClause}
    ORDER BY ${sortCol} ${sortDir}
  `;
  const queryParams = [...params];

  if (perPage > 0) {
    querySql += " LIMIT ? OFFSET ?";
    queryParams.push(perPage, offset);
  }

  const stmt = queryParams.length > 0 ? env.DB.prepare(querySql).bind(...queryParams) : env.DB.prepare(querySql);
  const { results } = await stmt.all<D1MemeRow & { final_status?: string | null }>();

  const memes = (results || []).map((row) => ({
    ...normalizeRow(env, row),
    final_status: row.final_status || null,
    curation_status: row.curation_status || row.final_status || null,
    is_finalized_keep: row.final_status === "keep"
  }));

  const totalPages = perPage > 0 ? Math.max(1, Math.ceil(totalCount / perPage)) : 1;

  return json({
    memes,
    pagination: {
      page,
      per_page: perPage,
      total_count: isVaultQuery ? totalCount : memes.length,
      total_pages: totalPages
    },
    ...(stats ? { stats } : {}),
    config: {
      hasR2PublicUrl: Boolean(env.R2_PUBLIC_URL),
      hasDatabase: Boolean(env.DB)
    }
  });
};

// POST /api/admin/memes — create one meme metadata row
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const payload = await parsePayload<SavePayload>(request);
    const row = toD1Row(payload.meme || {});

    // Superadmin Gate: Cannot be ACTIVE unless finalized as 'keep' in meme_curation_final
    if (row.status === "active") {
      const finalRes = await env.DB.prepare(
        "SELECT corpus_status FROM meme_curation_final WHERE meme_id = ?"
      ).bind(row.id).first<{ corpus_status: string }>();

      if (!finalRes || finalRes.corpus_status !== "keep") {
        return json(
          { error: "Cannot set status to ACTIVE: This meme has not been authoritatively resolved and finalized as KEEP by Superadmin in the Curator Command Center." },
          { status: 400 }
        );
      }
    }

    await env.DB.prepare(
      `INSERT INTO memes (id, title, image_url, storage_path, source_link, category, tags, rarity, status, media_type, input_method, is_active, rights_note, share_text, random_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.id, row.title, row.image_url, row.storage_path, row.source_link,
      row.category, row.tags, row.rarity, row.status, row.media_type,
      row.input_method, row.is_active, row.rights_note, row.share_text, row.random_key
    ).run();

    const { results } = await env.DB.prepare(
      "SELECT * FROM memes WHERE id = ?"
    ).bind(row.id).all<D1MemeRow>();

    return json({ meme: normalizeRow(env, results[0]) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to save meme." }, { status: 400 });
  }
};

// PATCH /api/admin/memes — update one meme metadata row
export const onRequestPatch: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const payload = await parsePayload<SavePayload>(request);
    const originalId = payload.originalId?.trim();
    if (!originalId) {
      throw new Error("originalId is required to update a meme.");
    }

    const row = toD1Row(payload.meme || {});

    // Immutable ID check: ID cannot be changed during ordinary editing
    if (row.id !== originalId) {
      return json(
        { error: "Meme ID is immutable and cannot be changed through standard editing." },
        { status: 400 }
      );
    }

    // Superadmin Gate: Cannot be ACTIVE unless finalized as 'keep' in meme_curation_final
    if (row.status === "active") {
      const finalRes = await env.DB.prepare(
        "SELECT corpus_status FROM meme_curation_final WHERE meme_id = ?"
      ).bind(originalId).first<{ corpus_status: string }>();

      if (!finalRes || finalRes.corpus_status !== "keep") {
        return json(
          { error: "Cannot set status to ACTIVE: This meme has not been authoritatively resolved and finalized as KEEP by Superadmin in the Curator Command Center." },
          { status: 400 }
        );
      }
    } else if (row.status === "archived") {
      // If manually archived from /admin, remove it from 'keep' in meme_curation_final and memes table
      await env.DB.prepare(
        "UPDATE meme_curation_final SET corpus_status = 'review_later', updated_at = ? WHERE meme_id = ? AND corpus_status = 'keep'"
      ).bind(new Date().toISOString(), originalId).run();

      await env.DB.prepare(
        "UPDATE memes SET curation_status = 'review_later' WHERE id = ? AND curation_status = 'keep'"
      ).bind(originalId).run();
    }

    await env.DB.prepare(
      `UPDATE memes SET
        id = ?, title = ?, image_url = ?, storage_path = ?, source_link = ?,
        category = ?, tags = ?, rarity = ?, status = ?, media_type = ?,
        input_method = ?, is_active = ?, rights_note = ?, share_text = ?, random_key = ?
       WHERE id = ?`
    ).bind(
      row.id, row.title, row.image_url, row.storage_path, row.source_link,
      row.category, row.tags, row.rarity, row.status, row.media_type,
      row.input_method, row.is_active, row.rights_note, row.share_text, row.random_key,
      originalId
    ).run();

    const { results } = await env.DB.prepare(
      "SELECT * FROM memes WHERE id = ?"
    ).bind(row.id).all<D1MemeRow>();

    if (!results[0]) {
      return json({ error: "No meme was updated." }, { status: 404 });
    }

    return json({ meme: normalizeRow(env, results[0]) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to update meme." }, { status: 400 });
  }
};

// DELETE /api/admin/memes — archive (soft-delete) one meme
export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  try {
    const payload = await parsePayload<DeletePayload>(request);
    const id = payload.id?.trim();
    if (!id) {
      throw new Error("id is required to archive a meme.");
    }

    await env.DB.prepare(
      "UPDATE memes SET status = 'archived', is_active = 0, curation_status = CASE WHEN curation_status = 'keep' THEN 'review_later' ELSE curation_status END WHERE id = ?"
    ).bind(id).run();

    // Synchronize meme_curation_final away from 'keep' so Superadmin reflects the archive
    await env.DB.prepare(
      "UPDATE meme_curation_final SET corpus_status = 'review_later', updated_at = ? WHERE meme_id = ? AND corpus_status = 'keep'"
    ).bind(new Date().toISOString(), id).run();

    const { results } = await env.DB.prepare(
      "SELECT * FROM memes WHERE id = ?"
    ).bind(id).all<D1MemeRow>();

    return json({ meme: normalizeRow(env, results[0]) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to archive meme." }, { status: 400 });
  }
};
