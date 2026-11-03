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

// GET /api/admin/memes — list all memes for admin review
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const { results } = await env.DB.prepare(
    `SELECT m.*, f.corpus_status as final_status
     FROM memes m
     LEFT JOIN meme_curation_final f ON m.id = f.meme_id
     ORDER BY m.uploaded_at DESC`
  ).all<D1MemeRow & { final_status?: string | null }>();

  return json({
    memes: results.map((row) => ({
      ...normalizeRow(env, row),
      final_status: row.final_status || null,
      curation_status: row.curation_status || row.final_status || null,
      is_finalized_keep: row.final_status === "keep"
    })),
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
