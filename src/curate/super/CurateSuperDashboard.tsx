import { useState, useEffect, useCallback } from "react";
import {
  fetchSuperSummary,
  fetchSuperMemes,
  getSuperExportUrl,
  type SuperSummaryResponse,
  type SuperMemeItem
} from "./curateSuperApi";
import CuratorComparisonTable from "./CuratorComparisonTable";
import CorpusCategoryCards from "../../components/CorpusCategoryCards";
import type { CorpusState } from "../../types/corpus";

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
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");
  const [showIntegrityModal, setShowIntegrityModal] = useState<boolean>(false);
  const [integrityReport, setIntegrityReport] = useState<any>(null);
  const [integrityLoading, setIntegrityLoading] = useState<boolean>(false);
  const [integrityPurging, setIntegrityPurging] = useState<boolean>(false);
  const [draftActionLoading, setDraftActionLoading] = useState<boolean>(false);
  const [draftActionNotice, setDraftActionNotice] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const summaryPromise = fetchSuperSummary()
        .then((sumRes) => {
          setSummary(sumRes);
        })
        .catch((err) => {
          console.error("Error fetching super summary:", err);
        });

      const memesPromise = fetchSuperMemes(filter, page, 20, search)
        .then((memesRes) => {
          setMemes(memesRes?.memes || []);
          setTotalPages(memesRes?.total_pages || 1);
          setTotalCount(memesRes?.total || 0);
        })
        .catch((err) => {
          console.error("Error fetching super memes:", err);
        });

      await Promise.allSettled([summaryPromise, memesPromise]);
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

  const handleOpenIntegrity = async () => {
    setShowIntegrityModal(true);
    setIntegrityLoading(true);
    try {
      const token = sessionStorage.getItem("curator_token") || "";
      const res = await fetch("/api/curate/super/integrity", {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrityReport(data);
      }
    } catch (err) {
      console.error("Failed loading integrity report:", err);
    } finally {
      setIntegrityLoading(false);
    }
  };

  const handlePurgeGhosts = async () => {
    if (!confirm("Are you sure you want to purge all detected ghost rows? This action is permanent and audited.")) {
      return;
    }
    setIntegrityPurging(true);
    try {
      const token = sessionStorage.getItem("curator_token") || "";
      const res = await fetch("/api/curate/super/integrity", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Successfully purged ${data.purgedCount || 0} ghost rows.`);
        handleOpenIntegrity();
        loadData();
      }
    } catch (err) {
      alert("Error purging ghosts: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIntegrityPurging(false);
    }
  };

  const handleRunAiJudgeDrafts = async () => {
    const token = sessionStorage.getItem("curator_token") || "";
    setDraftActionLoading(true);
    setDraftActionNotice("Running AI Judge on verified drafts (batch of 25)...");
    try {
      const res = await fetch("/api/admin/intake/run-ai?limit=25", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed running AI judge.");
      }
      setDraftActionNotice(`AI Judge completed: ${data.promoted} promoted to Archive, ${data.failed} skipped/unverified.`);
      await loadData();
    } catch (err: any) {
      setDraftActionNotice(err?.message || "Error running AI Judge.");
    } finally {
      setDraftActionLoading(false);
    }
  };

  const handleVerifyIntakeDrafts = async () => {
    const token = sessionStorage.getItem("curator_token") || "";
    setDraftActionLoading(true);
    setDraftActionNotice("Verifying intake for drafts in R2 (batch of 25)...");
    try {
      const res = await fetch("/api/admin/intake/verify?limit=25", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed verifying intake.");
      }
      setDraftActionNotice(`Intake verification completed: ${data.verified} verified, ${data.rejected} rejected (${data.remaining} remaining unverified).`);
      await loadData();
    } catch (err: any) {
      setDraftActionNotice(err?.message || "Error verifying intake.");
    } finally {
      setDraftActionLoading(false);
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
            {summary ? `${summary.active} ACTIVE / ${summary.total} TOTAL` : "LOADING..."}
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

          {/* Integrity Chip */}
          <button
            type="button"
            onClick={handleOpenIntegrity}
            style={{
              background: summary?.integrity?.ok ? "rgba(52, 199, 89, 0.15)" : "rgba(255, 59, 48, 0.15)",
              color: summary?.integrity?.ok ? "#34c759" : "#ff3b30",
              border: `1px solid ${summary?.integrity?.ok ? "#34c759" : "#ff3b30"}`,
              padding: "6px 12px",
              fontFamily: "Anton",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            {summary?.integrity?.ok ? "✓ INTACT" : "⚠ INTEGRITY DRIFT"}
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.hash = "#/curate/analytics";
              window.dispatchEvent(new PopStateEvent("popstate"));
            }}
            style={{
              background: "#f4c300",
              color: "#111111",
              border: "1px solid #f4c300",
              padding: "6px 14px",
              fontFamily: "Anton",
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            📊 AI ANALYTICS
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
        {/* 1. TOTAL CORPUS + Exactly 5 Category Cards */}
        <CorpusCategoryCards
          summary={summary}
          activeStateFilter={filter}
          onSelectState={(state: CorpusState) => {
            setFilter(state);
            setPage(1);
          }}
        />

        {/* 2. Per-Judge Progress Block */}
        {summary && summary.judges && summary.judges.length > 0 && (
          <div style={{ background: "#181818", border: "1px solid #333", padding: "16px", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h3 className="curate-anton" style={{ margin: 0, fontSize: "16px", color: "#f4c300" }}>
                  PER-JUDGE PROGRESS (3 DESIGNATED HUMAN JUDGES + AI ADVISORY)
                </h3>
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
              {summary.judges.map((j) => (
                <div key={j.name} style={{ background: "#222", border: "1px solid #3d3d3d", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div>
                      <strong style={{ color: "#fff", fontSize: "14px" }}>{j.name.toUpperCase()}</strong>
                      <span style={{
                        fontSize: "9px",
                        marginLeft: "6px",
                        padding: "1px 5px",
                        borderRadius: "2px",
                        background: "#9b30ff",
                        color: "#fff",
                        fontFamily: "monospace"
                      }}>
                        HUMAN
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#f4c300" }}>
                      {j.reviewed} reviewed
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", fontSize: "11px", color: "#aaa", flexWrap: "wrap", marginTop: "8px" }}>
                    <span style={{ color: "#34C759" }}>{j.keep} Keep</span>
                    <span>•</span>
                    <span style={{ color: "#FF3B30", fontWeight: "bold" }}>{j.exclude} Excl</span>
                    <span>•</span>
                    <span style={{ color: "#FF9F0A" }}>{j.duplicate} Dup</span>
                    <span>•</span>
                    <span style={{ color: "#8e8e93" }}>{j.queue_left} Left</span>
                  </div>
                </div>
              ))}

              {/* AI Judge 4 advisory block */}
              <div style={{ background: "#222", border: "1px dashed #555", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div>
                    <strong style={{ color: "#fff", fontSize: "14px" }}>AI JUDGE (GEMINI)</strong>
                    <span style={{
                      fontSize: "9px",
                      marginLeft: "6px",
                      padding: "1px 5px",
                      borderRadius: "2px",
                      background: "#333",
                      color: "#f4c300",
                      fontFamily: "monospace"
                    }}>
                      ADVISORY
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#f4c300" }}>
                    {summary.ai_judge?.judged || 0} evaluated
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "8px" }}>
                  Pre-evaluated drafts promoted to archive
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Action & Filter Toolbar */}
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
              <option value="all">All States ({totalCount})</option>
              <option value="conflict">⚠️ Conflict (Needs Arbitration)</option>
              <option value="archive">📦 Archive (Voting Queue)</option>
              <option value="draft">📝 Draft (Awaiting AI Judge)</option>
              <option value="active">✓ Active (Live in App)</option>
              <option value="excluded">❌ Excluded (7-day Purge Queue)</option>
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

            {filter === "draft" && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleRunAiJudgeDrafts}
                  disabled={draftActionLoading}
                  style={{
                    background: "#9b30ff",
                    color: "#fff",
                    border: "1px solid #c084fc",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontFamily: "Anton",
                    cursor: draftActionLoading ? "not-allowed" : "pointer"
                  }}
                  title="Run AI Judge manually on verified drafts (25 at a time)"
                >
                  ⚡ RUN AI JUDGE
                </button>
                <button
                  type="button"
                  onClick={handleVerifyIntakeDrafts}
                  disabled={draftActionLoading}
                  style={{
                    background: "#0284c7",
                    color: "#fff",
                    border: "1px solid #38bdf8",
                    padding: "8px 14px",
                    fontSize: "12px",
                    fontFamily: "Anton",
                    cursor: draftActionLoading ? "not-allowed" : "pointer"
                  }}
                  title="Verify physical R2 files for drafts (MIME, SHA-256, Duplicates)"
                >
                  🔍 VERIFY INTAKE
                </button>
              </div>
            )}
          </div>

          {draftActionNotice && (
            <div style={{ width: "100%", padding: "8px 12px", background: "#222", border: "1px solid #9b30ff", color: "#f4c300", fontSize: "12px", fontFamily: "monospace" }}>
              ℹ️ {draftActionNotice}
            </div>
          )}

          {/* CSV Export of Active Memes */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <a
              href={getSuperExportUrl("active", "csv")}
              download="meme_capsule_active_corpus.csv"
              style={{
                background: "#34c759",
                color: "#121212",
                border: "1px solid #34c759",
                padding: "8px 14px",
                fontFamily: "Anton",
                fontSize: "12px",
                textDecoration: "none",
                fontWeight: "bold"
              }}
            >
              ↓ EXPORT ACTIVE CORPUS (CSV)
            </a>
          </div>
        </div>

        {/* 4. Meme Comparison Data Table */}
        <CuratorComparisonTable
          memes={memes}
          loading={loading}
          onRefresh={loadData}
        />

        {/* 5. Pagination Bar */}
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
      </div>

      {/* Integrity & Ghost Purge Modal */}
      {showIntegrityModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#18181b",
              border: "2px solid #333",
              borderRadius: "8px",
              maxWidth: "700px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "24px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 className="curate-anton" style={{ margin: 0, fontSize: "18px", color: "#f4c300" }}>
                🛡️ DATABASE INTEGRITY & GHOST SCANNER
              </h2>
              <button
                type="button"
                onClick={() => setShowIntegrityModal(false)}
                style={{ background: "transparent", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {integrityLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>
                Scanning database for ghost rows and orphaned references...
              </div>
            ) : integrityReport ? (
              <div>
                <div
                  style={{
                    background: integrityReport.totalGhosts === 0 ? "rgba(52, 199, 89, 0.15)" : "rgba(255, 59, 48, 0.15)",
                    border: `1px solid ${integrityReport.totalGhosts === 0 ? "#34c759" : "#ff3b30"}`,
                    padding: "12px",
                    borderRadius: "4px",
                    marginBottom: "16px",
                    color: integrityReport.totalGhosts === 0 ? "#34c759" : "#ff3b30",
                    fontWeight: "bold"
                  }}
                >
                  {integrityReport.totalGhosts === 0
                    ? "✓ Database is 100% clean. Zero ghost rows detected."
                    : `⚠️ Detected ${integrityReport.totalGhosts} ghost rows across 9 audit classes.`}
                </div>

                <div style={{ fontSize: "12px", color: "#ccc", display: "grid", gap: "8px", marginBottom: "20px" }}>
                  {Object.entries(integrityReport.classes || {}).map(([key, count]: [string, any]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: "#222" }}>
                      <span>Class ({key}):</span>
                      <strong>{count} ghosts</strong>
                    </div>
                  ))}
                </div>

                {integrityReport.totalGhosts > 0 && (
                  <button
                    type="button"
                    onClick={handlePurgeGhosts}
                    disabled={integrityPurging}
                    style={{
                      width: "100%",
                      background: "#ff3b30",
                      color: "#fff",
                      border: "none",
                      padding: "12px",
                      fontFamily: "Anton",
                      fontSize: "14px",
                      cursor: "pointer"
                    }}
                  >
                    {integrityPurging ? "PURGING GHOSTS..." : "⚡ PURGE ALL GHOST ROWS"}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ color: "#888" }}>No report generated yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
