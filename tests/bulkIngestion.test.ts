import { describe, expect, it } from "vitest";
import {
  BULK_MAX_BATCH_BYTES,
  canConfirmBulk,
  formatBytes,
  sha256File,
  validateBulkFile,
  type BulkDraftItem
} from "../src/admin/bulkIngestion";

const file = (overrides: Partial<File> = {}) => ({
  name: "reaction.png",
  type: "image/png",
  size: 5,
  arrayBuffer: async () => new TextEncoder().encode("hello").buffer,
  ...overrides
}) as File;

describe("bulk ingestion client validation", () => {
  it("accepts supported images and rejects video", () => {
    expect(validateBulkFile(file())).toEqual([]);
    expect(validateBulkFile(file({ name: "clip.mp4", type: "video/mp4" }))).toContain("Video is not supported in bulk intake.");
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
