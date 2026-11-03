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
  const isNsfw = meme.is_nsfw ? 1 : 0;
  const nsfwFlaggedBy = meme.is_nsfw ? (meme.nsfw_flagged_by || "admin") : null;

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
    random_key: Math.random(),
    is_nsfw: isNsfw,
    nsfw_flagged_by: nsfwFlaggedBy
  };
};

const parsePayload = async <T>(request: Request) => {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
};

// GET /api/admin/memes — server-side query, stats, filtering, and stable pagination
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const url = new URL(request.url);
  const isAll = url.searchParams.get("all") === "true";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "25", 10) || 25));
  const q = (url.searchParams.get("q") || url.searchParams.get("search") || "").trim();
  const statusFilter = (url.searchParams.get("status") || "all").toLowerCase().trim();
  const sortByParam = (url.searchParams.get("sort_by") || "uploaded_at").toLowerCase().trim();
  const sortDir = (url.searchParams.get("sort_dir") || "desc").toLowerCase().trim() === "asc" ? "ASC" : "DESC";

  // Allowed sort columns for SQL injection protection
  const sortColumnMap: Record<string, string> = {
    uploaded_at: "uploaded_at",
    created_at: "uploaded_at",
    title: "title",
    id: "id",
    likes_count: "likes_count",
    views_count: "views_count",
    share_count: "share_count",
    category: "category",
    status: "status"
  };
  const sortCol = sortColumnMap[sortByParam] || "uploaded_at";

  // 1. Calculate top-level corpus statistics across the entire database in one query
  const statsRes = await env.DB.prepare(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN m.status = 'active' AND m.is_active = 1 THEN 1 ELSE 0 END) as active,
       SUM(CASE WHEN m.status = 'draft' THEN 1 ELSE 0 END) as drafts,
       SUM(CASE WHEN (m.curation_status = 'excluded' OR f.corpus_status = 'excluded') THEN 1 ELSE 0 END) as excluded,
       SUM(CASE WHEN m.status = 'archived' AND (m.curation_status != 'excluded' OR m.curation_status IS NULL) AND (f.corpus_status != 'excluded' OR f.corpus_status IS NULL) THEN 1 ELSE 0 END) as archived,
       SUM(CASE WHEN m.is_nsfw = 1 THEN 1 ELSE 0 END) as nsfw
     FROM memes m
     LEFT JOIN meme_curation_final f ON m.id = f.meme_id`
  ).first<{
    total: number;
    active: number;
    drafts: number;
    excluded: number;
    archived: number;
    nsfw: number;
  }>();

  // 2. Build dynamic filtering criteria
  const whereClauses: string[] = [];
  const binds: any[] = [];

  if (statusFilter === "active") {
    whereClauses.push("m.status = 'active' AND m.is_active = 1");
  } else if (statusFilter === "draft") {
    whereClauses.push("m.status = 'draft'");
  } else if (statusFilter === "excluded") {
    whereClauses.push("(m.curation_status = 'excluded' OR f.corpus_status = 'excluded')");
  } else if (statusFilter === "archived") {
    whereClauses.push("m.status = 'archived' AND (m.curation_status != 'excluded' OR m.curation_status IS NULL) AND (f.corpus_status != 'excluded' OR f.corpus_status IS NULL)");
  } else if (statusFilter === "nsfw") {
    whereClauses.push("m.is_nsfw = 1");
  }

  if (q) {
    const term = `%${q.toLowerCase()}%`;
    whereClauses.push(
      "(LOWER(m.title) LIKE ? OR LOWER(m.id) LIKE ? OR LOWER(m.category) LIKE ? OR LOWER(m.tags) LIKE ?)"
    );
    binds.push(term, term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // 3. Count total matching rows for pagination
  let totalCount = Number(statsRes?.total || 0);
  if (whereClauses.length > 0) {
    const countRes = await env.DB.prepare(
      `SELECT COUNT(*) as filtered_total
       FROM memes m
       LEFT JOIN meme_curation_final f ON m.id = f.meme_id
       ${whereSql}`
    ).bind(...binds).first<{ filtered_total: number }>();
    totalCount = Number(countRes?.filtered_total || 0);
  }

  // 4. Query paginated results with stable ordering
  let querySql = `
    SELECT m.*, f.corpus_status as final_status
    FROM memes m
    LEFT JOIN meme_curation_final f ON m.id = f.meme_id
    ${whereSql}
    ORDER BY m.${sortCol} ${sortDir}, m.id DESC
  `;

  const queryBinds = [...binds];
  if (!isAll) {
    querySql += " LIMIT ? OFFSET ?";
    const offset = (page - 1) * perPage;
    queryBinds.push(perPage, offset);
  }

  const stmt = env.DB.prepare(querySql);
  const { results } = queryBinds.length > 0
    ? await stmt.bind(...queryBinds).all<D1MemeRow & { final_status?: string | null }>()
    : await stmt.all<D1MemeRow & { final_status?: string | null }>();

  return json({
    memes: (results || []).map((row) => ({
      ...normalizeRow(env, row),
      final_status: row.final_status || null,
      curation_status: row.curation_status || row.final_status || null,
      is_finalized_keep: row.final_status === "keep",
      is_nsfw: Boolean(row.is_nsfw)
    })),
    pagination: {
      page: isAll ? 1 : page,
      per_page: isAll ? (results?.length || 0) : perPage,
      total: totalCount,
      total_pages: isAll ? 1 : Math.max(1, Math.ceil(totalCount / perPage))
    },
    stats: {
      total: Number(statsRes?.total || 0),
      active: Number(statsRes?.active || 0),
      drafts: Number(statsRes?.drafts || 0),
      excluded: Number(statsRes?.excluded || 0),
      archived: Number(statsRes?.archived || 0),
      nsfw: Number(statsRes?.nsfw || 0)
    },
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
      `INSERT INTO memes (id, title, image_url, storage_path, source_link, category, tags, rarity, status, media_type, input_method, is_active, rights_note, share_text, random_key, is_nsfw, nsfw_flagged_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.id, row.title, row.image_url, row.storage_path, row.source_link,
      row.category, row.tags, row.rarity, row.status, row.media_type,
      row.input_method, row.is_active, row.rights_note, row.share_text, row.random_key,
      row.is_nsfw, row.nsfw_flagged_by
    ).run();

    const { results } = await env.DB.prepare(
      "SELECT * FROM memes WHERE id = ?"
    ).bind(row.id).all<D1MemeRow>();

    return json({ meme: normalizeRow(env, results[0]) });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to save meme." }, { status: 400 });
  }
};

// PATCH /api/admin/memes — update one meme metadata row with immutable normal ID protection
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

    // Enforce immutable normal IDs to prevent foreign key corruption
    if (row.id !== originalId) {
      return json(
        { error: "Meme ID is immutable once created. Changing IDs risks foreign key corruption in curation, final consensus, and audit logs." },
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
        title = ?, image_url = ?, storage_path = ?, source_link = ?,
        category = ?, tags = ?, rarity = ?, status = ?, media_type = ?,
        input_method = ?, is_active = ?, rights_note = ?, share_text = ?, random_key = ?,
        is_nsfw = ?, nsfw_flagged_by = ?
       WHERE id = ?`
    ).bind(
      row.title, row.image_url, row.storage_path, row.source_link,
      row.category, row.tags, row.rarity, row.status, row.media_type,
      row.input_method, row.is_active, row.rights_note, row.share_text, row.random_key,
      row.is_nsfw, row.nsfw_flagged_by,
      originalId
    ).run();

    const { results } = await env.DB.prepare(
      "SELECT * FROM memes WHERE id = ?"
    ).bind(originalId).all<D1MemeRow>();

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
