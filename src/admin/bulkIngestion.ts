import type { IngestionItemStatus } from "../lib/adminApi";

export const BULK_MAX_ITEMS = 50;
export const BULK_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const BULK_MAX_BATCH_BYTES = 200 * 1024 * 1024;

const SUPPORTED_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const SUPPORTED_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;

const mimeFromFilename = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  return "application/octet-stream";
};

export type BulkDraftItem = {
  clientItemId: string;
  memeId: string;
  file: File | null;
  fileName: string;
  title: string;
  mimeType: string;
  byteSize: number;
  contentHash: string;
  previewUrl: string;
  validationErrors: string[];
  duplicateWarning: string | null;
  server?: IngestionItemStatus;
};

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
};

export const defaultBulkTitle = (filename: string) =>
  filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Untitled meme";

export const validateBulkFile = (file: File) => {
  const errors: string[] = [];
  const supportedByName = SUPPORTED_EXTENSIONS.test(file.name);
  const declaredType = file.type.toLowerCase();
  if (declaredType.startsWith("video/") || VIDEO_EXTENSIONS.test(file.name)) {
    errors.push("Video is not supported in bulk intake.");
  } else if ((!declaredType || !SUPPORTED_MIME_TYPES.has(declaredType)) && !supportedByName) {
    errors.push("Use a PNG, JPEG, GIF, WebP, or AVIF image.");
  }
  if (file.size <= 0) errors.push("The file is empty.");
  if (file.size > BULK_MAX_FILE_BYTES) errors.push("The file exceeds the 20 MiB limit.");
  return errors;
};

export const sha256File = async (file: File) => {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
};

export const createBulkDraftItem = async (file: File): Promise<BulkDraftItem> => {
  const contentHash = await sha256File(file);
  const validationErrors = validateBulkFile(file);
  const declaredType = file.type.toLowerCase();
  const mimeType = SUPPORTED_MIME_TYPES.has(declaredType) ? declaredType : mimeFromFilename(file.name);
  return {
    clientItemId: `item-${contentHash}`,
    memeId: `intake-${contentHash.slice(0, 32)}`,
    file,
    fileName: file.name,
    title: defaultBulkTitle(file.name),
    mimeType,
    byteSize: file.size,
    contentHash,
    previewUrl: URL.createObjectURL(file),
    validationErrors,
    duplicateWarning: null
  };
};

export const applyDuplicateWarnings = (items: BulkDraftItem[]) => {
  const seen = new Map<string, BulkDraftItem>();
  return items.map((item) => {
    const duplicate = seen.get(item.contentHash);
    if (!duplicate) {
      seen.set(item.contentHash, item);
      return { ...item, duplicateWarning: null };
    }
    return { ...item, duplicateWarning: `Duplicate of ${duplicate.fileName} in this batch.` };
  });
};

export const totalDraftBytes = (items: BulkDraftItem[]) => items.reduce((total, item) => total + item.byteSize, 0);

export const canConfirmBulk = (items: BulkDraftItem[]) =>
  items.length > 0 &&
  items.length <= BULK_MAX_ITEMS &&
  totalDraftBytes(items) <= BULK_MAX_BATCH_BYTES &&
  items.every((item) => item.validationErrors.length === 0 && item.file !== null);
