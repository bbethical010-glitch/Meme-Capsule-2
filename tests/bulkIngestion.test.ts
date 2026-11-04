import { describe, expect, it } from "vitest";
import {
  BULK_MAX_BATCH_BYTES,
  canConfirmBulk,
  createBulkDraftItem,
  formatBytes,
  sha256File,
  sniffImageMime,
  validateBulkFile,
  type BulkDraftItem
} from "../src/admin/bulkIngestion";

const file = (overrides: Partial<File> = {}) => ({
  name: "reaction.png",
  type: "image/png",
  size: 5,
  arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
  slice: (start = 0, end = 32) => ({
    arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer
  }),
  ...overrides
}) as unknown as File;

describe("bulk ingestion client validation", () => {
  it("accepts supported images including HEIC/HEIF and rejects video", () => {
    expect(validateBulkFile(file())).toEqual([]);
    expect(validateBulkFile(file({ name: "photo.heic", type: "image/heic" }))).toEqual([]);
    expect(validateBulkFile(file({ name: "photo.heif", type: "image/heif" }))).toEqual([]);
    expect(validateBulkFile(file({ name: "clip.mp4", type: "video/mp4" }))).toContain("Video is not supported in bulk intake.");
  });

  it("sniffs magic bytes correctly across common and modern image formats", () => {
    // PNG
    expect(sniffImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    // JPEG
    expect(sniffImageMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe("image/jpeg");
    // GIF
    expect(sniffImageMime(new TextEncoder().encode("GIF89a..."))).toBe("image/gif");
    // WebP
    const webpBytes = new Uint8Array(16);
    new TextEncoder().encodeInto("RIFF", webpBytes.subarray(0, 4));
    new TextEncoder().encodeInto("WEBP", webpBytes.subarray(8, 12));
    expect(sniffImageMime(webpBytes)).toBe("image/webp");
    // AVIF
    const avifBytes = new Uint8Array(16);
    new TextEncoder().encodeInto("ftypavif", avifBytes.subarray(4, 12));
    expect(sniffImageMime(avifBytes)).toBe("image/avif");
    // HEIC
    const heicBytes = new Uint8Array(16);
    new TextEncoder().encodeInto("ftypheic", heicBytes.subarray(4, 12));
    expect(sniffImageMime(heicBytes)).toBe("image/heic");
    // HEIF (mif1 brand)
    const heifBytes = new Uint8Array(16);
    new TextEncoder().encodeInto("ftypmif1", heifBytes.subarray(4, 12));
    expect(sniffImageMime(heifBytes)).toBe("image/heic");
  });

  it("recovers MIME type from magic bytes when browser reports application/octet-stream", async () => {
    const heicRaw = new Uint8Array(32);
    new TextEncoder().encodeInto("ftypheic", heicRaw.subarray(4, 12));
    const mobileExportFile = new File([heicRaw], "t51.82787-15_790865841_1801254463194", {
      type: "application/octet-stream"
    });

    // Must be detected as image/heic with NO validation errors
    const draft = await createBulkDraftItem(mobileExportFile);
    expect(draft.mimeType).toBe("image/heic");
    expect(draft.validationErrors).toEqual([]);
  });

  it("generates distinct, batch-scoped clientItemId and memeId while preserving contentHash", async () => {
    const raw = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const file1 = new File([raw], "meme1.png", { type: "image/png" });
    const file2 = new File([raw], "meme2.png", { type: "image/png" });

    const draft1 = await createBulkDraftItem(file1);
    const draft2 = await createBulkDraftItem(file2);

    // Both files have identical bytes, so contentHash must match
    expect(draft1.contentHash).toBe(draft2.contentHash);
    // But clientItemId and memeId must be uniquely scoped to prevent D1 collisions
    expect(draft1.clientItemId).not.toBe(draft2.clientItemId);
    expect(draft1.memeId).not.toBe(draft2.memeId);
    expect(draft1.clientItemId).toMatch(/^item-[a-f0-9]{20}-[a-z0-9]{8}$/i);
    expect(draft1.memeId).toMatch(/^intake-[a-z0-9]{32}$/i);
  });

  it("rejects oversized files before batch confirmation", () => {
    const errors = validateBulkFile(file({ size: 20 * 1024 * 1024 + 1 }));
    expect(errors).toContain("The file exceeds the 20 MiB limit.");
  });

  it("produces a stable content hash for retry identity", async () => {
    expect(await sha256File(file())).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("keeps confirmation disabled when a draft exceeds the batch limit", () => {
    const item = {
      clientItemId: "item-1",
      memeId: "intake-1",
      file: file({ size: BULK_MAX_BATCH_BYTES + 1 }),
      fileName: "large.png",
      title: "Large",
      mimeType: "image/png",
      byteSize: BULK_MAX_BATCH_BYTES + 1,
      contentHash: "a".repeat(64),
      previewUrl: "",
      validationErrors: [],
      duplicateWarning: null
    } satisfies BulkDraftItem;
    expect(canConfirmBulk([item])).toBe(false);
    expect(formatBytes(1024)).toBe("1.0 KiB");
  });
});
