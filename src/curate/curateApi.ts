/**
 * API client for Curation & Multi-Dimensional Categorization.
 */

import type {
  CurateMemeItem,
  CurationStatsResponse,
  CorpusStatus
} from "./curateTypes";

const getAuthHeaders = () => {
  const token = sessionStorage.getItem("curator_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with ${res.status}`);
  }
  return data as T;
}

export async function fetchNextMeme(
  filter: string = "unreviewed",
  currentId?: string,
  direction: "next" | "prev" = "next",
  includeStats: boolean = false,
  limit?: number
): Promise<{
  meme: CurateMemeItem | null;
  memes?: CurateMemeItem[];
  stats: { total: number; reviewed: number; remaining: number; current_index: number } | null;
}> {
  const query = new URLSearchParams();
  if (filter) query.set("filter", filter);
  if (currentId) query.set("current_id", currentId);
  if (direction) query.set("direction", direction);
  if (includeStats) query.set("include_stats", "true");
  if (limit && limit > 1) query.set("limit", String(limit));

  const res = await fetch(`/api/curate/next?${query.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}

export async function saveCuration(payload: {
  meme_id: string;
  corpus_status: CorpusStatus;
  duplicate_of?: string | null;
  topics?: string[];
  tone?: string | null;
  humour_mechanisms?: string[];
  curator_note?: string | null;
  user_id?: string;
  user_name?: string;
}): Promise<{ success: boolean; meme_id: string }> {
  const res = await fetch("/api/curate/save", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function setMemeNsfw(
  memeId: string,
  isNsfw: boolean
): Promise<{ success: boolean; meme_id: string; is_nsfw: boolean | number; nsfw_flagged_by?: string | null }> {
  const res = await fetch("/api/curate/save", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ meme_id: memeId, moderation_only: true, is_nsfw: isNsfw })
  });
  return handleResponse(res);
}

export const updateMemeNsfw = setMemeNsfw;

export async function approveCuration(payload: {
  meme_id: string;
  corpus_status: CorpusStatus;
  duplicate_of?: string | null;
  topics?: string[];
  tone?: string | null;
  humour_mechanisms?: string[];
  curator_note?: string | null;
  user_id?: string;
  user_name?: string;
  adopted_from?: "judge4" | "judge5" | "consensus" | "manual";
}): Promise<{ success: boolean; meme_id: string; is_final: boolean }> {
  const res = await fetch("/api/curate/approve", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function forceRemoveMeme(memeId: string): Promise<{ success: boolean; meme_id: string; message: string }> {
  const res = await fetch("/api/curate/force-remove", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ meme_id: memeId })
  });
  return handleResponse(res);
}

export async function fetchCurationStats(): Promise<CurationStatsResponse> {
  const res = await fetch("/api/curate/stats", {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}

export function getExportUrl(format: "json" | "csv"): string {
  return `/api/curate/export?format=${format}`;
}

export async function fetchCurationList(
  page: number = 1,
  perPage: number = 24,
  filter: string = "all"
): Promise<{
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  memes: CurateMemeItem[];
}> {
  const query = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    filter
  });

  const res = await fetch(`/api/curate/list?${query.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}
