/**
 * API client for Curator Superadmin Command Center.
 */
import type { CorpusSummaryResponse } from "../../types/corpus";

export type SuperSummaryResponse = CorpusSummaryResponse;

const getAuthHeaders = () => {
  const token = typeof window !== "undefined"
    ? window.sessionStorage.getItem("curator_token")
      || window.sessionStorage.getItem("meme-capsule:admin-api-token")
      || window.sessionStorage.getItem("admin_token")
    : null;
  return {
    "Content-Type": "application/json",
    ...(token ? {
      Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      "X-Admin-Token": token.replace(/^Bearer\s+/i, "").trim()
    } : {})
  };
};

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed with ${res.status}`);
  }
  return data as T;
}

export interface SuperMemeItem {
  id: string;
  title: string;
  image_url: string;
  corpus_status?: string;
  excluded_at?: string | null;
  purge_at?: string | null;
  exclusion_reason?: string | null;
  consensus_status: string;
  judges_count: number;
  judges: {
    user_id: string;
    user_name: string;
    corpus_status: "keep" | "excluded" | "duplicate";
    duplicate_of?: string | null;
    topics: string[];
    tone?: string | null;
    humour_mechanisms: string[];
    curator_note?: string | null;
    reviewed_at: string;
  }[];
  ai_judge?: {
    corpus_status: "keep" | "excluded" | "duplicate" | null;
    topics: string[];
    tone: string | null;
    humour_mechanisms: string[];
    confidence: number | null;
    reasoning: string | null;
    model: string | null;
    updated_at: string | null;
    error: string | null;
  } | null;
  final_decision?: {
    corpus_status: "keep" | "excluded" | "duplicate";
    duplicate_of?: string | null;
    topics: string[];
    tone?: string | null;
    humour_mechanisms: string[];
    curator_note?: string | null;
    resolved_at?: string;
  } | null;
}

export async function fetchSuperSummary(): Promise<SuperSummaryResponse> {
  const res = await fetch("/api/curate/super/summary", {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}

export async function fetchSuperMemes(
  filter: string = "all",
  page: number = 1,
  perPage: number = 20,
  search: string = ""
): Promise<{
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  memes: SuperMemeItem[];
}> {
  const query = new URLSearchParams({
    filter,
    page: String(page),
    per_page: String(perPage),
    ...(search ? { search } : {})
  });

  const res = await fetch(`/api/curate/super/memes?${query.toString()}`, {
    headers: getAuthHeaders(),
    cache: "no-store"
  });
  return handleResponse(res);
}

export async function resolveSuperMeme(payload: {
  meme_id: string;
  corpus_status: "keep" | "excluded" | "duplicate";
  duplicate_of?: string | null;
  topics?: string[];
  tone?: string | null;
  humour_mechanisms?: string[];
  curator_note?: string | null;
}): Promise<{ success: boolean; message: string; meme: unknown }> {
  const res = await fetch("/api/curate/super/resolve", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export function getSuperExportUrl(filter: string = "all", format: "csv" | "json" = "csv"): string {
  const token = sessionStorage.getItem("curator_token") || "";
  const params = new URLSearchParams({
    filter,
    format,
    ...(token ? { token } : {})
  });
  return `/api/curate/super/export?${params.toString()}`;
}
