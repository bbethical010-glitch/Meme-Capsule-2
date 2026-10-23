import { useState, useEffect, useCallback } from "react";
import {
  fetchSuperSummary,
  fetchSuperMemes,
  bulkResolveSuper,
  getSuperExportUrl,
  type SuperSummaryResponse,
  type SuperMemeItem
} from "./curateSuperApi";
import CuratorComparisonTable from "./CuratorComparisonTable";
import ForceRemovalAudit from "../../categorise/superadmin/ForceRemovalAudit";

interface CurateSuperDashboardProps {
  onSwitchToJudgeMode: () => void;
  onLogout: () => void;
}

export default function CurateSuperDashboard({
  onSwitchToJudgeMode,
  onLogout
}: CurateSuperDashboardProps) {
  const [summary, setSummary] = useState<SuperSummaryResponse | null>(null);
  const [memes, setMemes] = useState<SuperMemeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [showForceRemovalAudit, setShowForceRemovalAudit] = useState<boolean>(false);
  const token = sessionStorage.getItem("curator_token") || "";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, memesRes] = await Promise.all([
        fetchSuperSummary(),
        fetchSuperMemes(filter, page, 20, search)
      ]);
      setSummary(sumRes);
      setMemes(memesRes.memes);
      setTotalPages(memesRes.total_pages);
      setTotalCount(memesRes.total);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Error loading superadmin dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Intercept Ctrl+R / Cmd+R to silently refresh dashboard data without full page reload
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        loadData();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadData]);

  const handleBulkResolve = async (action: string) => {
    if (!confirm(`Are you sure you want to batch-resolve all ${action.replace("_", " ")} memes?`)) {
      return;
    }
    setBatchLoading(true);
    try {
      const res = await bulkResolveSuper(action);
      alert(res.message);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk resolve failed");
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="curate-root" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top Header */}
      <header className="curate-topbar" style={{ borderColor: "#f4c300" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span className="curate-anton" style={{ fontSize: "20px", color: "#f4c300" }}>
            🛡️ CURATOR SUPER ADMIN COMMAND CENTER
          </span>
          <span style={{ fontSize: "11px", background: "#262626", padding: "3px 8px", borderRadius: "2px", color: "#34C759", fontFamily: "monospace" }}>
            {summary ? `${summary.resolved_count} ACTIVE / ${summary.total_memes} (${summary.total_resolved_count ?? summary.resolved_count} RESOLVED)` : "LOADING..."}
          </span>
          {lastRefreshed && (
            <span style={{ fontSize: "10px", color: "#888", fontFamily: "monospace" }}>
              SYNCED: {lastRefreshed}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              background: "#222",
              border: "1px solid #f4c300",
              color: "#f4c300",
              padding: "6px 14px",
              fontFamily: "Anton",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
            title="Refresh dashboard data (or press Ctrl+R)"
          >
            <span>🔄</span>
            {loading ? "REFRESHING..." : "REFRESH DATA (Ctrl+R)"}
          </button>

          <button
            type="button"
            onClick={() => setShowForceRemovalAudit((prev) => !prev)}
            style={{
              background: showForceRemovalAudit ? "#dd0061" : "#1c1b1b",
              color: showForceRemovalAudit ? "#ffffff" : "#dd0061",
              border: "1px solid #dd0061",
              padding: "6px 14px",
              fontFamily: "Anton",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            {showForceRemovalAudit ? "BACK TO DASHBOARD" : "⚡ FORCE REMOVAL AUDIT"}
          </button>

          <button
            type="button"
            onClick={onSwitchToJudgeMode}
            style={{
              background: "#9b30ff",
              color: "#ffffff",
              border: "1px solid #f4c300",
              padding: "6px 14px",
              fontFamily: "Anton",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            ⚡ QUICK JUDGE MODE
          </button>

          <button
            type="button"
            onClick={onLogout}
            style={{
              background: "transparent",
              border: "none",
              color: "#FF3B30",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "Oswald",
              letterSpacing: "0.5px"
            }}
          >
            LOG OUT
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ maxWidth: "1600px", margin: "0 auto", padding: "24px", width: "100%", flex: 1 }}>
        {showForceRemovalAudit ? (
          <ForceRemovalAudit token={token} />
        ) : (
          <>
            {/* KPI Cards Strip */}
            {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "24px" }}>
            <div style={{ background: "#1c1b1b", border: "1px solid #444", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#888" }}>TOTAL CORPUS</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#fff" }}>{summary.total_memes}</div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #34C759", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#34C759" }}>ACTIVE RESOLVED</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#34C759" }}>{summary.resolved_count}</div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #FF3B30", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#FF3B30" }}>FINAL EXCLUDED</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#FF3B30" }}>{summary.resolved_excluded_count ?? 0}</div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #FF9F0A", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#FF9F0A" }}>HUMAN CONFLICTS</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#FF9F0A" }}>
                {summary.consensus_metrics.conflicts}
              </div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #9b30ff", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#9b30ff" }}>UNANIMOUS KEEP</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#9b30ff" }}>
                {summary.consensus_metrics.unanimous_keep}
              </div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #FF3B30", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#FF3B30" }}>UNANIMOUS EXCLUDE</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#FF3B30" }}>
                {summary.consensus_metrics.unanimous_exclude}
              </div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #FF3B30", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#FF3B30" }}>TOTAL EXCLUDE VOTES</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#FF3B30" }}>
                {summary.total_exclude_votes ?? 0}
              </div>
            </div>

            <div style={{ background: "#1c1b1b", border: "1px solid #FF453A", padding: "14px" }}>
              <div style={{ fontSize: "11px", color: "#FF453A" }}>FORCE REMOVED</div>
              <div className="curate-anton" style={{ fontSize: "24px", color: "#FF453A" }}>
                {summary.total_force_removed ?? 0}
              </div>
            </div>
          </div>
        )}

        {/* Judges Performance Strip */}
        {summary && summary.judges.length > 0 && (
          <div style={{ background: "#181818", border: "1px solid #333", padding: "16px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 className="curate-anton" style={{ margin: 0, fontSize: "16px", color: "#f4c300" }}>
                  CURATOR / JUDGES LIVE PROGRESS ({summary.judges.length} ACTIVE)
                </h3>
                <span style={{ fontSize: "11px", color: "#888", fontFamily: "monospace" }}>
                  (Judges 1–3: Human Consensus • Judges 4–5: AI Advisory)
                </span>
              </div>
              <button
                type="button"
                onClick={loadData}
                style={{ background: "transparent", border: "none", color: "#f4c300", cursor: "pointer", fontSize: "12px", fontFamily: "Oswald" }}
              >
                🔄 Update Counts
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
              {summary.judges.map((j) => {
                const isAiJudge = j.user_name.toLowerCase().includes("four") || j.user_name.toLowerCase().includes("five") || j.user_name.toLowerCase().includes("ai");
                return (
                  <div key={j.user_id} style={{ background: "#222", border: isAiJudge ? "1px dashed #555" : "1px solid #3d3d3d", padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div>
                        <strong style={{ color: "#fff", fontSize: "14px" }}>{j.user_name}</strong>
                        <span style={{
                          fontSize: "9px",
                          marginLeft: "6px",
                          padding: "1px 5px",
                          borderRadius: "2px",
                          background: isAiJudge ? "#333" : "#9b30ff",
                          color: isAiJudge ? "#f4c300" : "#fff",
                          fontFamily: "monospace"
                        }}>
                          {isAiJudge ? "AI ADVISORY" : "HUMAN"}
                        </span>
                      </div>
                      <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#f4c300" }}>{j.total_reviewed} reviewed</span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "#aaa", flexWrap: "wrap", marginTop: "8px" }}>
                      <span style={{ color: "#34C759" }}>{j.kept} Kept</span>
                      <span>•</span>
                      <span style={{ color: "#FF3B30", fontWeight: "bold" }}>{j.excluded} Excl</span>
                      <span>•</span>
                      <span style={{ color: "#FF9F0A" }}>{j.duplicates} Dup</span>
                      <span>•</span>
                      <span style={{ color: "#f4c300" }}>{j.review_later} Later</span>
                      <span>•</span>
                      <span style={{ color: "#FF453A", fontWeight: "bold" }}>{j.force_removed ?? 0} Purged</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action & Filter Toolbar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
          {/* Filters & Search */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
              style={{
                background: "#222",
                border: "1px solid #9b30ff",
                color: "#f4c300",
                padding: "8px 12px",
                fontFamily: "Oswald",
                fontSize: "13px",
                outline: "none"
              }}
            >
              <option value="all">All Memes ({totalCount})</option>
              <option value="unresolved">Pending Superadmin Resolution</option>
              <option value="resolved">✓ Authoritatively Resolved</option>
            </select>

            <input
              type="text"
              placeholder="Search Meme ID or Title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{
                background: "#222",
                border: "1px solid #444",
                color: "#fff",
                padding: "8px 12px",
                fontSize: "13px",
                fontFamily: "Oswald",
                outline: "none",
                width: "240px"
              }}
            />

            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              style={{
                background: "#333",
                border: "1px solid #666",
                color: "#fff",
                padding: "8px 14px",
                fontSize: "12px",
                fontFamily: "Anton",
                cursor: "pointer"
              }}
            >
              {loading ? "LOADING..." : "🔄 RELOAD"}
            </button>
          </div>

          {/* Batch Actions & Exports */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => handleBulkResolve("majority_keep")}
              disabled={batchLoading}
              style={{
                background: "#1c2b1e",
                border: "2px solid #34C759",
                color: "#34C759",
                padding: "6px 14px",
                fontFamily: "Anton",
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(52, 199, 89, 0.2)"
              }}
              title="Bulk resolve all memes with 2:1 human majority keep"
            >
              ⚡ INSTANT RESOLVE MAJORITY KEEPS {summary?.consensus_metrics?.majority_keep ? `(${summary.consensus_metrics.majority_keep})` : ""}
            </button>

            <button
              type="button"
              onClick={() => handleBulkResolve("majority_exclude")}
              disabled={batchLoading}
              style={{
                background: "#2b1c1c",
                border: "2px solid #FF3B30",
                color: "#FF3B30",
                padding: "6px 14px",
                fontFamily: "Anton",
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "0 0 10px rgba(255, 59, 48, 0.2)"
              }}
              title="Bulk resolve all memes with 2:1 human majority exclude"
            >
              ⚡ INSTANT RESOLVE MAJORITY EXCLUDES {summary?.consensus_metrics?.majority_exclude ? `(${summary.consensus_metrics.majority_exclude})` : ""}
            </button>

            <button
              type="button"
              onClick={() => handleBulkResolve("unanimous_keep")}
              disabled={batchLoading}
              style={{
                background: "#222",
                border: "1px solid #34C759",
                color: "#34C759",
                padding: "6px 12px",
                fontFamily: "Anton",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              ⚡ AUTO-RESOLVE ALL UNANIMOUS KEEP
            </button>

            <button
              type="button"
              onClick={() => handleBulkResolve("unanimous_exclude")}
              disabled={batchLoading}
              style={{
                background: "#222",
                border: "1px solid #FF3B30",
                color: "#FF3B30",
                padding: "6px 12px",
                fontFamily: "Anton",
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              ⚡ AUTO-RESOLVE ALL UNANIMOUS EXCLUDE
            </button>

            <a
              href={getSuperExportUrl("final", "csv")}
              download="meme_capsule_curated_final.csv"
              style={{
                background: "#9b30ff",
                color: "#fff",
                border: "1px solid #f4c300",
                padding: "6px 12px",
                fontFamily: "Anton",
                fontSize: "12px",
                textDecoration: "none"
              }}
            >
              ↓ EXPORT FINAL DATASET (CSV)
            </a>
          </div>
        </div>

        {/* Meme Comparison Data Table */}
        <CuratorComparisonTable
          memes={memes}
          loading={loading}
          onRefresh={loadData}
        />

        {/* Pagination Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", color: "#888", fontSize: "12px" }}>
          <div>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total memes)
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ background: "#222", border: "1px solid #444", color: "#fff", padding: "6px 12px", cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              ← PREVIOUS
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ background: "#222", border: "1px solid #444", color: "#fff", padding: "6px 12px", cursor: page >= totalPages ? "not-allowed" : "pointer" }}
            >
              NEXT →
            </button>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
