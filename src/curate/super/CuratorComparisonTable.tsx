import { useState } from "react";
import type { SuperMemeItem } from "./curateSuperApi";
import CuratorResolveModal from "./CuratorResolveModal";

interface CuratorComparisonTableProps {
  memes: SuperMemeItem[];
  loading: boolean;
  onRefresh: () => void;
}

export default function CuratorComparisonTable({
  memes,
  loading,
  onRefresh
}: CuratorComparisonTableProps) {
  const [selectedMeme, setSelectedMeme] = useState<SuperMemeItem | null>(null);

  const getStatusColor = (status: string | null) =>
    status === "keep" ? "#34C759" : status === "excluded" ? "#FF3B30" : "#FF9F0A";

  const getStatusLabel = (status: string | null) => {
    if (status === "excluded") return "EXCLUDE";
    if (status === "review_later") return "REVIEW_LATER";
    return status ? status.toUpperCase() : "ANALYSED";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "resolved":
        return <span style={{ background: "#34C759", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>✓ RESOLVED</span>;
      case "unanimous_keep":
        return <span style={{ background: "#9b30ff", color: "#fff", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>UNANIMOUS KEEP</span>;
      case "unanimous_exclude":
        return <span style={{ background: "#FF3B30", color: "#fff", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>UNANIMOUS EXCLUDE</span>;
      case "majority_keep":
        return <span style={{ background: "#007AFF", color: "#fff", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>2:1 MAJORITY KEEP</span>;
      case "majority_exclude":
        return <span style={{ background: "#FF9500", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>2:1 MAJORITY EXCLUDE</span>;
      case "unanimous_duplicate":
      case "majority_duplicate":
        return <span style={{ background: "#FF9F0A", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>DUPLICATE CONSENSUS</span>;
      case "conflict":
        return <span style={{ background: "#FF453A", color: "#fff", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>⚠️ 1:1:1 CONFLICT</span>;
      case "single_review":
        return <span style={{ background: "#444", color: "#ddd", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>1 REVIEW</span>;
      case "pending_reviews":
        return <span style={{ background: "#262626", color: "#aaa", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>PENDING REVIEWS</span>;
      default:
        return <span style={{ background: "#262626", color: "#888", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>UNREVIEWED</span>;
    }
  };

  return (
    <div style={{ background: "#181818", border: "1px solid #333", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
        <thead>
          <tr style={{ background: "#222", borderBottom: "2px solid #9b30ff", color: "#f4c300", fontFamily: "Anton", letterSpacing: "0.5px" }}>
            <th style={{ padding: "12px 14px", width: "80px" }}>PREVIEW</th>
            <th style={{ padding: "12px 14px", width: "220px" }}>MEME INFO</th>
            <th style={{ padding: "12px 14px", width: "140px" }}>CONSENSUS</th>
            <th style={{ padding: "12px 14px" }}>JUDGES DECISIONS</th>
            <th style={{ padding: "12px 14px", width: "180px" }}>FINAL RESOLUTION</th>
            <th style={{ padding: "12px 14px", width: "120px", textAlign: "right" }}>ACTION</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#888" }}>
                LOADING MEME COMPARISONS...
              </td>
            </tr>
          ) : memes.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ padding: "40px", textAlign: "center", color: "#888" }}>
                NO MEMES FOUND IN THIS FILTER.
              </td>
            </tr>
          ) : (
            memes.map((m) => (
              <tr
                key={m.id}
                style={{ borderBottom: "1px solid #282828", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1f1d24")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Thumbnail */}
                <td style={{ padding: "10px 14px" }}>
                  <img
                    src={m.image_url}
                    alt={m.title}
                    style={{ width: "60px", height: "60px", objectFit: "cover", background: "#121212", border: "1px solid #444" }}
                  />
                </td>

                {/* Info */}
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#888" }}>{m.id}</div>
                  <div style={{ fontWeight: "bold", color: "#fff", marginTop: "2px" }}>{m.title}</div>
                </td>

                {/* Consensus Status */}
                <td style={{ padding: "10px 14px" }}>
                  {getStatusBadge(m.consensus_status)}
                </td>

                {/* Judges Submissions */}
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {m.judges.length === 0 && (
                      <span style={{ color: "#666" }}>Pending judge reviews</span>
                    )}
                    {m.judges.length > 0 && (
                      <>
                      {m.judges.map((j) => (
                        <div
                          key={j.user_id}
                          style={{
                            background: "#242424",
                            border: "1px solid #383838",
                            padding: "4px 8px",
                            fontSize: "11px"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <strong style={{ color: "#f4c300" }}>{j.user_name}:</strong>
                            <span
                              style={{
                                color: getStatusColor(j.corpus_status),
                                fontWeight: "bold",
                                textTransform: "uppercase"
                              }}
                            >
                              {j.corpus_status}
                            </span>
                          </div>
                          {j.topics.length > 0 && (
                            <div style={{ fontSize: "10px", color: "#aaa" }}>
                              {j.topics.join(", ")}
                            </div>
                          )}
                        </div>
                      ))}
                      </>
                    )}
                  </div>
                </td>

                {/* Final Decision */}
                <td style={{ padding: "10px 14px" }}>
                  {m.final_decision ? (
                    <div>
                      <span style={{ color: "#34C759", fontWeight: "bold", textTransform: "uppercase" }}>
                        {m.final_decision.corpus_status}
                      </span>
                      {m.final_decision.tone && (
                        <span style={{ color: "#f4c300", fontSize: "10px", marginLeft: "6px" }}>
                          ({m.final_decision.tone})
                        </span>
                      )}
                      {m.final_decision.topics.length > 0 && (
                        <div style={{ fontSize: "10px", color: "#888", marginTop: "2px" }}>
                          {m.final_decision.topics.join(", ")}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: "#666", fontStyle: "italic" }}>Not resolved</span>
                  )}
                </td>

                {/* Action */}
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => setSelectedMeme(m)}
                    style={{
                      background: m.final_decision ? "#262626" : "#9b30ff",
                      color: "#fff",
                      border: "1px solid #f4c300",
                      padding: "6px 12px",
                      fontFamily: "Anton",
                      fontSize: "11px",
                      cursor: "pointer"
                    }}
                  >
                    {m.final_decision ? "EDIT RESOLUTION" : "ARBITRATE ➔"}
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {selectedMeme && (
        <CuratorResolveModal
          meme={selectedMeme}
          onClose={() => setSelectedMeme(null)}
          onResolved={onRefresh}
        />
      )}
    </div>
  );
}
