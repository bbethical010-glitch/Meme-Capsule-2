import { useState } from "react";
import type { SuperMemeItem } from "./curateSuperApi";
import CuratorResolveModal from "./CuratorResolveModal";

interface CuratorComparisonTableProps {
  memes: SuperMemeItem[];
  loading: boolean;
  onRefresh: () => void;
}

function formatPurgeRemaining(purgeAt: string): string {
  const diff = new Date(purgeAt).getTime() - Date.now();
  if (diff <= 0) return "PURGE DUE";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `PURGES IN ${days}d ${hours}h`;
}

export default function CuratorComparisonTable({
  memes,
  loading,
  onRefresh
}: CuratorComparisonTableProps) {
  const [selectedMeme, setSelectedMeme] = useState<SuperMemeItem | null>(null);

  const getStatusColor = (status: string | null) =>
    status === "keep" ? "#34C759" : status === "excluded" ? "#FF3B30" : "#FF9F0A";

  const getStatusBadge = (status: string, corpusStatus?: string) => {
    const effective = corpusStatus || status;
    switch (effective) {
      case "active":
        return <span style={{ background: "#34C759", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>✓ ACTIVE</span>;
      case "archive":
        return <span style={{ background: "#f4c300", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>ARCHIVE (VOTING)</span>;
      case "draft":
        return <span style={{ background: "#8e8e93", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>DRAFT (AI PENDING)</span>;
      case "excluded":
        return <span style={{ background: "#FF3B30", color: "#fff", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>EXCLUDED</span>;
      case "conflict":
        return <span style={{ background: "#FF9500", color: "#121212", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>⚠️ 1:1:1 CONFLICT</span>;
      default:
        return <span style={{ background: "#262626", color: "#888", padding: "2px 6px", fontFamily: "Anton", fontSize: "10px" }}>{String(effective).toUpperCase()}</span>;
    }
  };

  return (
    <div style={{ background: "#181818", border: "1px solid #333", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
        <thead>
          <tr style={{ background: "#222", borderBottom: "2px solid #9b30ff", color: "#f4c300", fontFamily: "Anton", letterSpacing: "0.5px" }}>
            <th style={{ padding: "12px 14px", width: "80px" }}>PREVIEW</th>
            <th style={{ padding: "12px 14px", width: "220px" }}>MEME INFO</th>
            <th style={{ padding: "12px 14px", width: "140px" }}>CORPUS STATE</th>
            <th style={{ padding: "12px 14px" }}>JUDGES DECISIONS</th>
            <th style={{ padding: "12px 14px", width: "180px" }}>CONSENSUS / REASON</th>
            <th style={{ padding: "12px 14px", width: "140px", textAlign: "right" }}>ACTION</th>
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

                {/* State Badge */}
                <td style={{ padding: "10px 14px" }}>
                  {getStatusBadge(m.consensus_status, m.corpus_status)}
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

                {/* Consensus / Reason */}
                <td style={{ padding: "10px 14px" }}>
                  {m.corpus_status === "excluded" && (
                    <div style={{ color: "#FF3B30", fontSize: "11px" }}>
                      <div>Reason: {m.exclusion_reason || "consensus"}</div>
                    </div>
                  )}
                  {m.corpus_status === "conflict" && (
                    <div style={{ color: "#FF9500", fontSize: "11px", fontWeight: "bold" }}>
                      1:1:1 SPLIT ACROSS JUDGES
                    </div>
                  )}
                  {m.corpus_status === "active" && (
                    <div style={{ color: "#34C759", fontSize: "11px" }}>
                      Keep Consensus (Live in App)
                    </div>
                  )}
                  {m.corpus_status === "archive" && (
                    <div style={{ color: "#f4c300", fontSize: "11px" }}>
                      {m.judges.length}/3 Human Votes
                    </div>
                  )}
                  {m.corpus_status === "draft" && (
                    <div style={{ color: "#8e8e93", fontSize: "11px" }}>
                      Intake Draft (Awaiting AI)
                    </div>
                  )}
                </td>

                {/* Action */}
                <td style={{ padding: "10px 14px", textAlign: "right" }}>
                  {m.corpus_status === "excluded" ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                      {m.purge_at && (
                        <span style={{ fontSize: "10px", color: "#ff3b30", fontFamily: "monospace", fontWeight: "bold" }}>
                          {formatPurgeRemaining(m.purge_at)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedMeme(m)}
                        style={{
                          background: "#262626",
                          color: "#fff",
                          border: "1px solid #FF3B30",
                          padding: "4px 8px",
                          fontFamily: "Anton",
                          fontSize: "11px",
                          cursor: "pointer"
                        }}
                      >
                        EDIT VOTE
                      </button>
                    </div>
                  ) : m.corpus_status === "conflict" ? (
                    <button
                      type="button"
                      onClick={() => setSelectedMeme(m)}
                      style={{
                        background: "#9b30ff",
                        color: "#fff",
                        border: "1px solid #f4c300",
                        padding: "6px 12px",
                        fontFamily: "Anton",
                        fontSize: "11px",
                        cursor: "pointer"
                      }}
                    >
                      ARBITRATE ➔
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedMeme(m)}
                      style={{
                        background: "#262626",
                        color: "#888",
                        border: "1px solid #444",
                        padding: "4px 8px",
                        fontFamily: "Anton",
                        fontSize: "10px",
                        cursor: "pointer"
                      }}
                    >
                      VIEW
                    </button>
                  )}
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
