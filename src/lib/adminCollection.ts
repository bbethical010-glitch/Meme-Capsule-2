import { fallbackMemes } from "../data/fallbackMemes";
import type { Meme, MemeInputMethod, MemeMediaType, MemeStatus, Rarity } from "../types";
import { readJson, writeJson } from "./localState";

export type AdminMeme = Meme & {
  title: string;
  source_link: string;
  status: MemeStatus;
  media_type: MemeMediaType;
  input_method: MemeInputMethod;
  curation_status?: "keep" | "excluded" | "duplicate" | "review_later" | null;
  final_status?: string | null;
  is_finalized_keep?: boolean;
};

export const ADMIN_COLLECTION_KEY = "meme-capsule:admin-collection";

export const emptyAdminMeme = (): AdminMeme => ({
  id: `meme-${Date.now().toString(36)}`,
  title: "",
  url: "",
  storage_path: "",
  category: "Unsorted",
  tags: [],
  rarity: "Common",
  uploaded_at: new Date().toISOString(),
  share_text: "",
  rights_note: "reviewed",
  source_link: "",
  status: "draft",
  media_type: "image",
  input_method: "url"
});

export const normalizeAdminMeme = (meme: Partial<AdminMeme>): AdminMeme => ({
  ...emptyAdminMeme(),
  ...meme,
  id: meme.id?.trim() || `meme-${Date.now().toString(36)}`,
  title: meme.title?.trim() || meme.id || "Untitled meme",
  url: meme.url?.trim() || "",
  storage_path: meme.storage_path?.trim() || "",
  source_link: meme.source_link?.trim() || meme.url?.trim() || "",
  category: meme.category?.trim() || "Unsorted",
  tags: Array.isArray(meme.tags) ? meme.tags.map((tag) => tag.trim()).filter(Boolean) : [],
  rarity: (meme.rarity || "Common") as Rarity,
  status: (meme.status || "draft") as MemeStatus,
  media_type: (meme.media_type || "image") as MemeMediaType,
  input_method: (meme.input_method || "url") as MemeInputMethod,
  uploaded_at: meme.uploaded_at || new Date().toISOString(),
  share_text: meme.share_text?.trim() || meme.title?.trim() || "Spawned from Meme Capsule",
  rights_note: meme.rights_note?.trim() || "reviewed",
  curation_status: meme.curation_status ?? null,
  final_status: meme.final_status ?? null,
  is_finalized_keep: meme.is_finalized_keep ?? (meme.curation_status === "keep"),
  is_nsfw: meme.is_nsfw ?? 0,
  nsfw_flagged_by: meme.nsfw_flagged_by ?? null
});

export const readAdminCollection = () =>
  readJson<AdminMeme[]>(ADMIN_COLLECTION_KEY, []).map(normalizeAdminMeme);

export const writeAdminCollection = (collection: AdminMeme[]) => {
  writeJson(ADMIN_COLLECTION_KEY, collection.map(normalizeAdminMeme));
};

export const getActiveAdminMemes = () =>
  readAdminCollection().filter((meme) => meme.status === "active" && meme.url);

export const getEffectiveMemeCount = () => {
  const activeAdminMemes = getActiveAdminMemes();
  return activeAdminMemes.length > 0 ? activeAdminMemes.length : fallbackMemes.length;
};

export const pickAdminMeme = (excludeId?: string) => {
  const activeMemes = getActiveAdminMemes();
  if (activeMemes.length === 0) {
    return null;
  }

  const pool = activeMemes.filter((meme) => meme.id !== excludeId);
  const candidates = pool.length > 0 ? pool : activeMemes;
  return candidates[Math.floor(Math.random() * candidates.length)];
};

export const pickDailyAdminMeme = (date = new Date()) => {
  const activeMemes = getActiveAdminMemes();
  if (activeMemes.length === 0) {
    return null;
  }

  const dayStamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return activeMemes[Math.floor(dayStamp / 86_400_000) % activeMemes.length];
};

export const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export const serializeTags = (tags: string[]) => tags.join(", ");

export const detectMediaType = (url: string): MemeMediaType =>
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url) || url.startsWith("data:video/") ? "video" : "image";
