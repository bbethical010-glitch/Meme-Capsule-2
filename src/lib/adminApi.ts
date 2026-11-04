import type { AdminMeme } from "./adminCollection";

type AdminMemeResponse = {
  meme: AdminMeme;
};

type AdminMemesResponse = {
  memes: AdminMeme[];
};

type AdminUploadResponse = {
  url: string;
  storage_path: string;
  source_link: string;
  media_type: AdminMeme["media_type"];
};

export type IngestionEvaluation = {
  judge_key: "judge4" | "judge5";
  provider_key: string | null;
  model: string | null;
  state: string;
  attempt_count: number;
  decision: string | null;
  topics: string[];
  tone: string | null;
  humour_mechanisms: string[];
  confidence: number | null;
  reasoning: string | null;
  error_code: string | null;
  error_message: string | null;
  finished_at: string | null;
};

export type IngestionItemStatus = {
  job_id: string;
  idempotency_key: string;
  batch_id: string;
  meme_id: string;
  original_filename: string;
  title: string;
  content_hash: string;
  byte_size: number;
  mime_type: string;
  upload_state: string;
  state: string;
  storage_path: string | null;
  url: string;
  duplicate_warning: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  completed_at: string | null;
  evaluations: IngestionEvaluation[];
};

export type IngestionBatchStatus = {
  batch: {
    id: string;
    idempotency_key: string;
    actor_id: string;
    actor_name: string | null;
    status: string;
    total_items: number;
    total_bytes: number;
    uploaded_items?: number;
    upload_failed_items?: number;
    ready_items: number;
    failed_items: number;
    ai_failed_items?: number;
    created_at: string;
    updated_at: string;
    completed_at: string | null;
  };
  storage_usage?: {
    total_bytes: number;
    total_files: number;
  };
  items: IngestionItemStatus[];
};

const authHeaders = (adminToken: string) => ({
  Authorization: `Bearer ${adminToken}`,
  "X-Admin-Token": adminToken
});

const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with ${response.status}`);
  }

  return payload as T;
};

export const listBackendMemes = async (adminToken: string) => {
  const response = await fetch("/api/admin/memes", {
    headers: authHeaders(adminToken),
    cache: "no-store"
  });
  const payload = await parseJsonResponse<AdminMemesResponse>(response);
  return payload.memes;
};

export const saveBackendMeme = async (
  adminToken: string,
  meme: AdminMeme,
  originalId?: string | null
) => {
  const response = await fetch("/api/admin/memes", {
    method: originalId ? "PATCH" : "POST",
    headers: {
      ...authHeaders(adminToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ meme, originalId })
  });
  const payload = await parseJsonResponse<AdminMemeResponse>(response);
  return payload.meme;
};

export const archiveBackendMeme = async (adminToken: string, id: string) => {
  const response = await fetch("/api/admin/memes", {
    method: "DELETE",
    headers: {
      ...authHeaders(adminToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id })
  });
  const payload = await parseJsonResponse<AdminMemeResponse>(response);
  return payload.meme;
};

export const uploadBackendMemeFile = async (adminToken: string, file: File) => {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/admin/upload", {
    method: "POST",
    headers: authHeaders(adminToken),
    body
  });
  return parseJsonResponse<AdminUploadResponse>(response);
};

export type SyncR2Response = {
  message: string;
  totalR2Files: number;
  alreadyInD1: number;
  newlySynced: number;
  removedCount: number;
  syncedFiles: string[];
  removedFiles: string[];
  duration_ms?: number;
};

export const syncR2ToD1 = async (adminToken: string) => {
  const response = await fetch("/api/admin/sync-r2", {
    method: "POST",
    headers: authHeaders(adminToken),
    cache: "no-store"
  });
  return parseJsonResponse<SyncR2Response>(response);
};

export const hardDeleteBackendMemes = async (adminToken: string, ids: string[]) => {
  const response = await fetch("/api/admin/memes/hard-delete", {
    method: "POST",
    headers: {
      ...authHeaders(adminToken),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ids })
  });
  const payload = await parseJsonResponse<{ success: boolean; deletedCount: number; message: string }>(response);
  return payload;
};

const ingestionHeaders = (adminToken: string, contentType?: string) => ({
  ...authHeaders(adminToken),
  ...(contentType ? { "Content-Type": contentType } : {})
});

export const createIngestionBatch = async (
  adminToken: string,
  payload: {
    idempotency_key: string;
    items: Array<{
      idempotency_key: string;
      meme_id: string;
      original_filename: string;
      title: string;
      content_hash: string;
      byte_size: number;
      mime_type: string;
      media_type: "image";
    }>;
  }
) => {
  const response = await fetch("/api/admin/ingestion/batches", {
    method: "POST",
    headers: ingestionHeaders(adminToken, "application/json"),
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  return parseJsonResponse<IngestionBatchStatus>(response);
};

export const getIngestionBatch = async (adminToken: string, batchId: string) => {
  const response = await fetch(`/api/admin/ingestion/batches?id=${encodeURIComponent(batchId)}`, {
    headers: ingestionHeaders(adminToken),
    cache: "no-store"
  });
  return parseJsonResponse<IngestionBatchStatus>(response);
};

export const uploadIngestionItem = (
  adminToken: string,
  batchId: string,
  jobId: string,
  file: File,
  onProgress?: (loaded: number, total: number) => void
): Promise<IngestionBatchStatus & { recoverable?: boolean; storage_path?: string }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/ingestion/upload");
    const headers = ingestionHeaders(adminToken);
    for (const [key, val] of Object.entries(headers)) {
      xhr.setRequestHeader(key, val);
    }
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded, e.total);
        }
      };
    }
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(payload);
        } else {
          reject(new Error(payload.error || `Upload failed with HTTP ${xhr.status}`));
        }
      } catch {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({} as any);
        } else {
          reject(new Error(`Upload failed with HTTP ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error during file upload."));
    xhr.ontimeout = () => reject(new Error("Timeout during file upload."));

    const body = new FormData();
    body.append("batch_id", batchId);
    body.append("job_id", jobId);
    body.append("file", file, file.name);
    xhr.send(body);
  });
};

export const processIngestionItem = async (adminToken: string, jobId: string) => {
  const response = await fetch("/api/admin/ingestion/process", {
    method: "POST",
    headers: ingestionHeaders(adminToken, "application/json"),
    body: JSON.stringify({ job_id: jobId }),
    cache: "no-store"
  });
  return parseJsonResponse<IngestionBatchStatus & { busy?: boolean }>(response);
};

export const retryIngestionItems = async (adminToken: string, jobIds: string[]) => {
  const response = await fetch("/api/admin/ingestion/retry", {
    method: "POST",
    headers: ingestionHeaders(adminToken, "application/json"),
    body: JSON.stringify({ job_ids: jobIds }),
    cache: "no-store"
  });
  return parseJsonResponse<{ success: boolean; reset_jobs: number; batches: IngestionBatchStatus[] }>(response);
};

export const deleteIngestionBatch = async (adminToken: string, batchId: string) => {
  const response = await fetch(`/api/admin/ingestion/batches?id=${encodeURIComponent(batchId)}`, {
    method: "DELETE",
    headers: ingestionHeaders(adminToken),
    cache: "no-store"
  });
  return parseJsonResponse<{ success: boolean; deleted_batch_id: string; purged_jobs_count: number }>(response);
};

export type VaultViewMode =
  | "extra-large-grid"
  | "medium-grid"
  | "compact-grid"
  | "list"
  | "detailed-list";

export type VaultQuery = {
  page?: number;
  per_page?: number;
  q?: string;
  status?: "all" | "active" | "draft" | "archived";
  curation_status?: "all" | "keep" | "excluded" | "review_later" | "unreviewed";
  nsfw?: "all" | "safe" | "nsfw";
  sort_by?: "uploaded_at" | "title" | "id" | "likes_count";
  sort_dir?: "asc" | "desc";
  stats?: boolean;
};

export type VaultStats = {
  total: number;
  active: number;
  drafts: number;
  archived: number;
  excluded: number;
  nsfw: number;
};

export type VaultResponse = {
  memes: AdminMeme[];
  pagination: {
    page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
  stats?: VaultStats;
  config?: {
    hasR2PublicUrl?: boolean;
    hasDatabase?: boolean;
  };
};

export const fetchVaultMemes = async (adminToken: string, query?: VaultQuery): Promise<VaultResponse> => {
  const params = new URLSearchParams();
  if (query) {
    if (query.page) params.set("page", String(query.page));
    if (query.per_page) params.set("per_page", String(query.per_page));
    if (query.q) params.set("q", query.q);
    if (query.status && query.status !== "all") params.set("status", query.status);
    if (query.curation_status && query.curation_status !== "all") params.set("curation_status", query.curation_status);
    if (query.nsfw && query.nsfw !== "all") params.set("nsfw", query.nsfw);
    if (query.sort_by) params.set("sort_by", query.sort_by);
    if (query.sort_dir) params.set("sort_dir", query.sort_dir);
    if (query.stats !== undefined) params.set("stats", query.stats ? "1" : "0");
  }

  const queryString = params.toString();
  const url = `/api/admin/memes${queryString ? `?${queryString}` : ""}`;
  const response = await fetch(url, {
    headers: authHeaders(adminToken),
    cache: "no-store"
  });
  return parseJsonResponse<VaultResponse>(response);
};
