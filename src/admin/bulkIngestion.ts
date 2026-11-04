import type { IngestionItemStatus } from "../lib/adminApi";

export const BULK_MAX_ITEMS = 1000;
export const BULK_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const BULK_MAX_BATCH_BYTES = 2000 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/bmp"
]);

export const SUPPORTED_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp|heic|heif|bmp)$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|avi|mkv)$/i;

export const mimeFromFilename = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "avif") return "image/avif";
  if (extension === "heic") return "image/heic";
  if (extension === "heif") return "image/heif";
  if (extension === "bmp") return "image/bmp";
  return "application/octet-stream";
};

export const sniffImageMime = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 6) {
    const header = new TextDecoder().decode(bytes.slice(0, 6));
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  if (bytes.length >= 12) {
    const riff = new TextDecoder().decode(bytes.slice(0, 4));
    const webp = new TextDecoder().decode(bytes.slice(8, 12));
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  if (bytes.length >= 12) {
    const boxType = new TextDecoder().decode(bytes.slice(4, 8));
    if (boxType === "ftyp") {
      const brandHeader = new TextDecoder().decode(bytes.slice(8, Math.min(bytes.length, 32))).toLowerCase();
      if (brandHeader.includes("avif") || brandHeader.includes("avis")) return "image/avif";
      if (
        brandHeader.includes("heic") ||
        brandHeader.includes("heix") ||
        brandHeader.includes("hevc") ||
        brandHeader.includes("hevx") ||
        brandHeader.includes("mif1") ||
        brandHeader.includes("msf1")
      ) {
        return "image/heic";
      }
    }
  }
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    return "image/bmp";
  }
  return null;
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

export const validateBulkFile = (file: File, resolvedMime?: string) => {
  const errors: string[] = [];
  const supportedByName = SUPPORTED_EXTENSIONS.test(file.name);
  const declaredType = (file.type || "").toLowerCase().trim();
  const effectiveType = (resolvedMime || declaredType).toLowerCase().trim();

  if (declaredType.startsWith("video/") || VIDEO_EXTENSIONS.test(file.name)) {
    errors.push("Video is not supported in bulk intake.");
  } else if (!SUPPORTED_MIME_TYPES.has(effectiveType) && !supportedByName) {
    errors.push("Use a PNG, JPEG, GIF, WebP, AVIF, or HEIC image.");
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
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const contentHash = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");

  const headerBytes = new Uint8Array(buffer.slice(0, 32));
  const sniffedType = sniffImageMime(headerBytes);
  const declaredType = (file.type || "").toLowerCase().trim();
  const extType = mimeFromFilename(file.name);

  // If browser reports generic octet-stream or empty, sniffed type or extension resolves it
  let mimeType = (declaredType && SUPPORTED_MIME_TYPES.has(declaredType))
    ? declaredType
    : (sniffedType || (extType !== "application/octet-stream" ? extType : "application/octet-stream"));

  if (mimeType === "application/octet-stream" && sniffedType) {
    mimeType = sniffedType;
  }

  const validationErrors = validateBulkFile(file, mimeType);
  return {
    clientItemId: `item-${contentHash}`,
    memeId: `intake-${contentHash.slice(0, 32)}`,
    file,
    fileName: file.name,
    title: defaultBulkTitle(file.name),
    mimeType,
    byteSize: file.size,
    contentHash,
    previewUrl: typeof URL.createObjectURL === "function" && file instanceof Blob ? URL.createObjectURL(file) : "",
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
