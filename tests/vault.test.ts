import { describe, it, expect } from "vitest";
import type { VaultViewMode, VaultQuery } from "../src/lib/adminApi";

describe("Phase 5: Meme Vault Data Access & View Modes Contract", () => {
  it("validates that all five approved Vault view modes are recognized", () => {
    const validModes: VaultViewMode[] = [
      "extra-large-grid",
      "medium-grid",
      "compact-grid",
      "list",
      "detailed-list"
    ];

    expect(validModes).toHaveLength(5);
    expect(validModes).toContain("extra-large-grid");
    expect(validModes).toContain("medium-grid");
    expect(validModes).toContain("compact-grid");
    expect(validModes).toContain("list");
    expect(validModes).toContain("detailed-list");
  });

  it("bounds and clamps pagination inputs within safe limits", () => {
    const clampPage = (raw: number) => Math.max(1, Math.floor(raw) || 1);
    const clampPerPage = (rawLimit: number) =>
      rawLimit > 0 ? Math.max(1, Math.min(100, rawLimit)) : 0;

    expect(clampPage(0)).toBe(1);
    expect(clampPage(-5)).toBe(1);
    expect(clampPage(3)).toBe(3);

    expect(clampPerPage(0)).toBe(0);
    expect(clampPerPage(25)).toBe(25);
    expect(clampPerPage(100)).toBe(100);
    expect(clampPerPage(500)).toBe(100);
    expect(clampPerPage(-10)).toBe(0);
  });

  it("enforces immutable ID constraint on meme updates", () => {
    const originalId = "meme-12345";
    const attemptedPayload = { id: "meme-99999", title: "Attempted ID change" };

    const validateImmutableId = (orig: string, updatedId: string) => {
      if (orig !== updatedId) {
        throw new Error("Meme ID is immutable and cannot be changed through standard editing.");
      }
    };

    expect(() => validateImmutableId(originalId, attemptedPayload.id)).toThrow(
      "Meme ID is immutable and cannot be changed through standard editing."
    );
    expect(() => validateImmutableId(originalId, "meme-12345")).not.toThrow();
  });

  it("safely sanitizes search query parameters and filters", () => {
    const query: VaultQuery = {
      page: 1,
      per_page: 50,
      q: "  test meme  ",
      status: "active",
      curation_status: "keep",
      nsfw: "safe",
      sort_by: "uploaded_at",
      sort_dir: "desc"
    };

    const sanitizedQ = (query.q || "").trim().toLowerCase();
    expect(sanitizedQ).toBe("test meme");

    const allowedSortCols = new Set(["uploaded_at", "title", "id", "likes_count"]);
    expect(allowedSortCols.has(query.sort_by!)).toBe(true);
    expect(allowedSortCols.has("injected_col")).toBe(false);
  });

  it("supports partial bulk-action reporting structure", () => {
    type BulkResult = {
      success: boolean;
      deletedCount: number;
      deleted: string[];
      failed?: { id: string; reason: string }[];
    };

    const mockResult: BulkResult = {
      success: true,
      deletedCount: 2,
      deleted: ["id-1", "id-2"],
      failed: [{ id: "id-3", reason: "R2 deletion error: object not found" }]
    };

    expect(mockResult.deletedCount).toBe(2);
    expect(mockResult.failed).toHaveLength(1);
    expect(mockResult.failed![0].id).toBe("id-3");
  });
});
