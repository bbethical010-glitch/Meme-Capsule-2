/**
 * API client for Curator Superadmin Command Center.
 */

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

export interface SuperSummaryResponse {
  total_memes: number;
  resolved_count: number;
  resolved_active_count?: number;
  resolved_excluded_count?: number;
  total_resolved_count?: number;
  total_force_removed?: number;
  total_exclude_votes?: number;
  percent_resolved: number;
  consensus_metrics: {
    unreviewed: number;
    single_review: number;
    unanimous_keep: number;
    unanimous_exclude: number;
    majority_keep?: number;
    majority_exclude?: number;
    conflicts: number;
    total_with_reviews: number;
  };
  judges: {
    user_id: string;
    user_name: string;
    total_reviewed: number;
    kept: number;
    excluded: number;
    duplicates: number;
    review_later: number;
    force_removed?: number;
    last_active: string;
  }[];
  ai_judge?: {
    total_reviewed: number;
    kept: number;
    excluded: number;
    duplicates: number;
    review_later: number;
  };
}

export interface SuperMemeItem {
  id: string;
  title: string;
  image_url: string;
  consensus_status:
    | "unanimous_keep"
    | "unanimous_exclude"
    | "unanimous_duplicate"
    | "unanimous_review_later"
    | "majority_keep"
    | "majority_exclude"
    | "majority_duplicate"
    | "majority_review_later"
    | "conflict"
    | "single_review"
    | "pending_reviews"
    | "unreviewed"
    | "resolved";
  judges_count: number;
  judges: {
    user_id: string;
    user_name: string;
    corpus_status: "keep" | "excluded" | "duplicate" | "review_later";
    duplicate_of?: string | null;
    topics: string[];
    tone?: string | null;
    humour_mechanisms: string[];
    curator_note?: string | null;
    reviewed_at: string;
  }[];
  ai_judge?: {
    corpus_status: "keep" | "excluded" | "duplicate" | "review_later" | null;
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
    corpus_status: "keep" | "excluded" | "duplicate" | "review_later";
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
  corpus_status: "keep" | "excluded" | "duplicate" | "review_later";
  duplicate_of?: string | null;
  topics?: string[];
  tone?: string | null;
  humour_mechanisms?: string[];
  curator_note?: string | null;
}): Promise<{ success: boolean }> {
  const res = await fetch("/api/curate/super/resolve", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function bulkResolveSuper(action: string): Promise<{ success: boolean; count: number; message: string }> {
  const res = await fetch("/api/curate/super/bulk-resolve", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ action })
  });
  return handleResponse(res);
}

export function getSuperExportUrl(type: "final" | "matrix", format: "csv" | "json"): string {
  return `/api/curate/super/export?type=${type}&format=${format}`;
}
