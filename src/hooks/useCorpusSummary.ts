import { useState, useEffect, useCallback } from "react";
import type { CorpusSummaryResponse } from "../types/corpus";

export function useCorpusSummary(authToken?: string) {
  const [summary, setSummary] = useState<CorpusSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = {};
      const token = authToken || (typeof window !== "undefined"
        ? window.sessionStorage.getItem("meme-capsule:admin-api-token")
          || window.sessionStorage.getItem("curator_token")
          || window.sessionStorage.getItem("admin_token")
        : null);
      if (token) {
        const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
        headers["Authorization"] = `Bearer ${cleanToken}`;
        headers["X-Admin-Token"] = cleanToken;
      }

      const res = await fetch("/api/admin/corpus/summary", {
        headers,
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}: Failed to fetch corpus summary`);
      }

      const data: CorpusSummaryResponse = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load corpus summary");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refresh: fetchSummary };
}
