/**
 * GET/POST /api/admin/notifications/content-files
 * Stores validated JSON/CSV notification content permanently in R2.
 */
import type { PagesFunction } from "../../../_shared/pages";
import { json, requireAdmin, type Env, handleD1Error } from "../../../_shared/d1r2";

type ContentEntry = { title: string; body: string };
const maxBytes = 2 * 1024 * 1024;

const normalizeEntries = (value: unknown): ContentEntry[] => {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((row) => {
    if (typeof row === "string") return { title: "", body: row.trim() };
    if (!row || typeof row !== "object") return { title: "", body: "" };
    const item = row as Record<string, unknown>;
    const header = typeof item.header === "string" ? item.header.trim() : "";
    const subtitle = typeof item.subtitle === "string" ? item.subtitle.trim() : "";
    const body = typeof item.body === "string"
      ? item.body.trim()
      : typeof item.message === "string"
        ? item.message.trim()
        : [header, subtitle].filter(Boolean).join("\n");
    return {
      title: typeof item.title === "string" ? item.title.trim() : "",
      body,
    };
  }).filter((row) => row.body && row.title.length <= 120 && row.body.length <= 300);
};

const normalizeJsonEntries = (value: unknown): ContentEntry[] => {
  if (Array.isArray(value)) return normalizeEntries(value);
  if (!value || typeof value !== "object") return [];
  const document = value as Record<string, unknown>;
  if (Array.isArray(document.entries)) return normalizeEntries(document.entries);
  if (!Array.isArray(document.sections)) return [];

  return document.sections.flatMap((section) => {
    if (!section || typeof section !== "object") return [];
    const item = section as Record<string, unknown>;
    const title = typeof item.name === "string"
      ? item.name.trim()
      : typeof item.title === "string"
        ? item.title.trim()
        : "";
    if (!Array.isArray(item.entries)) return [];
    return normalizeEntries(item.entries.map((entry) => (
      entry && typeof entry === "object"
        ? { ...(entry as Record<string, unknown>), title }
        : { title, body: entry }
    )));
  });
};

const parseCsv = (text: string): ContentEntry[] => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = lines[0].toLowerCase().split(",").map((part) => part.trim());
  const hasHeader = first.includes("title") || first.includes("body") || first.includes("message");
  const start = hasHeader ? 1 : 0;
  return normalizeEntries(lines.slice(start).map((line) => {
    const comma = line.indexOf(",");
    return comma < 0 ? { body: line } : { title: line.slice(0, comma).trim(), body: line.slice(comma + 1).trim() };
  }));
};

const parseCatalogText = (text: string): ContentEntry[] => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const entries: ContentEntry[] = [];
  let sectionTitle = "";
  let pendingNumber = false;
  let pendingLines: string[] = [];

  const flush = () => {
    if (sectionTitle && pendingLines.length >= 2) {
      entries.push({
        title: sectionTitle.slice(0, 120),
        body: pendingLines.slice(0, 2).join("\n").slice(0, 300),
      });
    }
    pendingLines = [];
    pendingNumber = false;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line === "#" || /^main header$/i.test(line) || /^subtitle\s*\/\s*body copy$/i.test(line)) continue;
    const sectionMatch = line.match(/^[^—-]+?\s+[—-]\s+(.+)$/);
    if (sectionMatch && !/^\d/.test(line)) {
      flush();
      sectionTitle = sectionMatch[1].trim();
      continue;
    }
    if (/^\d{1,2}$/.test(line)) {
      flush();
      pendingNumber = true;
      continue;
    }
    if (pendingNumber && pendingLines.length < 2) pendingLines.push(line);
  }
  flush();
  return entries.filter((entry) => entry.body);
};

const parseFile = (name: string, text: string): ContentEntry[] => {
  if (name.toLowerCase().endsWith(".txt")) return parseCatalogText(text);
  if (name.toLowerCase().endsWith(".json")) {
    try {
      const parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
      return normalizeJsonEntries(parsed);
    } catch {
      return [];
    }
  }
  return parseCsv(text);
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  try {
    const result = await env.DB.prepare(`
      SELECT id, file_name, entry_count, created_at
      FROM notification_content_files ORDER BY created_at DESC
    `).all();
    return json({ files: result.results || [] });
  } catch (error) {
    return handleD1Error(error, "Failed to load notification content files");
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authError = requireAdmin(request, env);
  if (authError) return authError;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || !file.name) return json({ error: "Upload requires a file field." }, { status: 400 });
  if (!/\.(json|csv|txt)$/i.test(file.name)) return json({ error: "Upload a .json, .csv, or .txt file." }, { status: 400 });
  if (file.size > maxBytes) return json({ error: "File must be 2 MB or smaller." }, { status: 400 });

  const text = await file.text();
  const entries = parseFile(file.name, text);
  if (!entries.length) return json({ error: "No valid message entries found." }, { status: 400 });
  if (new Set(entries.map((entry) => entry.title).filter(Boolean)).size > 7) {
    return json({ error: "Use no more than 7 unique notification titles." }, { status: 400 });
  }
  const id = crypto.randomUUID();
  const storagePath = `notification-content/${id}.json`;
  try {
    await env.MEMES_BUCKET.put(storagePath, JSON.stringify(entries), {
      httpMetadata: { contentType: "application/json" },
    });
    await env.DB.prepare(`
      INSERT INTO notification_content_files (id, file_name, storage_path, entry_count)
      VALUES (?, ?, ?, ?)
    `).bind(id, file.name, storagePath, entries.length).run();
    return json({ success: true, id, file_name: file.name, entry_count: entries.length }, { status: 201 });
  } catch (error) {
    return handleD1Error(error, "Failed to store notification content file");
  }
};
