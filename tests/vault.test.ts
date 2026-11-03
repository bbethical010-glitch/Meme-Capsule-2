import { describe, expect, it } from "vitest";

// 1. Vault pagination & query parameter bounds
export const clampPagination = (page?: number, perPage?: number) => {
  const p = Math.max(1, Math.floor(Number(page ?? 1) || 1));
  const rawPp = perPage !== undefined ? Number(perPage) : 25;
  const pp = Math.min(100, Math.max(1, Math.floor(isNaN(rawPp) ? 25 : rawPp)));
  return { page: p, perPage: pp };
};

export const calculatePagination = (total: number, page: number, perPage: number) => {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page: Math.min(page, totalPages),
    per_page: perPage,
    total,
    total_pages: totalPages
  };
};

// 2. Safe sort column whitelist
export const sanitizeSortColumn = (col?: string) => {
  const allowed: Record<string, string> = {
    uploaded_at: "uploaded_at",
    created_at: "uploaded_at",
    title: "title",
    id: "id",
    likes_count: "likes_count",
    views_count: "views_count",
    share_count: "share_count",
    category: "category",
    status: "status"
  };
  return allowed[String(col).toLowerCase().trim()] || "uploaded_at";
};

// 3. Immutable ID protection guard
export const validateImmutableId = (originalId: string | null | undefined, newId: string) => {
  if (originalId && newId !== originalId) {
    throw new Error("Meme ID is immutable once created. Changing IDs risks foreign key corruption in curation, final consensus, and audit logs.");
  }
  return true;
};

// 4. Visible partial bulk-action reporting
export const formatBulkActionReport = (requestedCount: number, deletedCount: number, action = "permanently purged") => {
  const failedCount = requestedCount - deletedCount;
  if (failedCount > 0) {
    return `⚠️ Processed ${requestedCount} meme(s): ${deletedCount} succeeded, ${failedCount} failed.`;
  }
  return `✅ Processed ${requestedCount} meme(s): all ${deletedCount} ${action} from R2 & database.`;
};

describe("Meme Vault Phase 5 — Data Access and Pagination", () => {
  it("clamps page and perPage parameters safely", () => {
    expect(clampPagination(-5, 0)).toEqual({ page: 1, perPage: 1 });
    expect(clampPagination(10, 500)).toEqual({ page: 10, perPage: 100 });
    expect(clampPagination(undefined, undefined)).toEqual({ page: 1, perPage: 25 });
  });

  it("calculates pagination math correctly across edge cases", () => {
    expect(calculatePagination(0, 1, 25)).toEqual({ page: 1, per_page: 25, total: 0, total_pages: 1 });
    expect(calculatePagination(25, 1, 25)).toEqual({ page: 1, per_page: 25, total: 25, total_pages: 1 });
    expect(calculatePagination(26, 1, 25)).toEqual({ page: 1, per_page: 25, total: 26, total_pages: 2 });
    expect(calculatePagination(4564, 1, 25)).toEqual({ page: 1, per_page: 25, total: 4564, total_pages: 183 });
  });

  it("sanitizes sort columns to prevent SQL injection", () => {
    expect(sanitizeSortColumn("title")).toBe("title");
    expect(sanitizeSortColumn("created_at")).toBe("uploaded_at");
    expect(sanitizeSortColumn("likes_count")).toBe("likes_count");
    expect(sanitizeSortColumn("invalid_col; DROP TABLE memes;")).toBe("uploaded_at");
  });

  it("strictly enforces immutable normal IDs on updates", () => {
    expect(() => validateImmutableId("meme-123", "meme-456")).toThrow(/Meme ID is immutable once created/);
    expect(validateImmutableId("meme-123", "meme-123")).toBe(true);
    expect(validateImmutableId(null, "meme-new")).toBe(true);
  });

  it("formats transparent partial bulk-action results", () => {
    expect(formatBulkActionReport(10, 10)).toBe("✅ Processed 10 meme(s): all 10 permanently purged from R2 & database.");
    expect(formatBulkActionReport(10, 8)).toBe("⚠️ Processed 10 meme(s): 8 succeeded, 2 failed.");
    expect(formatBulkActionReport(1, 0)).toBe("⚠️ Processed 1 meme(s): 0 succeeded, 1 failed.");
  });
});
