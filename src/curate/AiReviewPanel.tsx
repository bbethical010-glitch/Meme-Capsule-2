import type { CuratedMemeData } from "./curateTypes";

interface AiReviewPanelProps {
  j4?: CuratedMemeData | null;
  j5?: CuratedMemeData | null;
  onEnterOverride: () => void;
  onAdopt: (j: CuratedMemeData, source: "judge4" | "judge5" | "consensus") => void;
  onForceRemove: () => void;
  isMobile?: boolean;
}

export default function AiReviewPanel({
  j4,
  j5,
  onEnterOverride,
  onAdopt,
  onForceRemove,
  isMobile = false
}: AiReviewPanelProps) {
  const hasJ4 = Boolean(j4?.corpus_status);
  const hasJ5 = Boolean(j5?.corpus_status);

  // Both AIs evaluated
  const bothEvaluated = hasJ4 && hasJ5;
  const isStatusConsensus = bothEvaluated && j4!.corpus_status === j5!.corpus_status;

  const topicsMatch = bothEvaluated && JSON.stringify([...j4!.topics].sort()) === JSON.stringify([...j5!.topics].sort());
  const mechsMatch = bothEvaluated && JSON.stringify([...j4!.humour_mechanisms].sort()) === JSON.stringify([...j5!.humour_mechanisms].sort());
  const toneMatch = bothEvaluated && j4!.tone === j5!.tone;
  const allDetailsMatch = isStatusConsensus && (j4!.corpus_status === "excluded" || (topicsMatch && mechsMatch && toneMatch));

  const renderJudgeCard = (
    judgeName: string,
    j: CuratedMemeData,
    shortcut: string,
    source: "judge4" | "judge5"
  ) => {
    const isKeep = j.corpus_status === "keep";
    const isExcluded = j.corpus_status === "excluded";
    const statusColor = isKeep ? "#34C759" : isExcluded ? "#FF3B30" : "#FF9F0A";

    return (
      <div
        style={{
          background: "#1c1b1b",
          border: `2px solid ${statusColor}`,
          padding: "16px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: `3px 3px 0px ${statusColor}`,
          borderRadius: "2px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "8px" }}>
          <span style={{ fontSize: "16px", fontWeight: "bold", color: isExcluded ? "#FF3B30" : "#c58cff", fontFamily: "Anton", letterSpacing: "0.5px" }}>
            {judgeName}
          </span>
          <span
            style={{
              background: statusColor,
              color: isKeep ? "#121212" : "#ffffff",
              padding: "2px 8px",
              fontFamily: "Anton",
              fontSize: "14px",
              borderRadius: "2px"
            }}
          >
            {j.corpus_status.toUpperCase()}
          </span>
        </div>

        <div style={{ fontSize: "13px", color: "#ddd", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div><span style={{ color: "#888", fontFamily: "monospace" }}>TOPICS:</span> {j.topics.length > 0 ? j.topics.join(", ") : <em style={{ color: "#666" }}>None</em>}</div>
          <div><span style={{ color: "#888", fontFamily: "monospace" }}>TONE:</span> {j.tone || <em style={{ color: "#666" }}>None</em>}</div>
          <div><span style={{ color: "#888", fontFamily: "monospace" }}>MECHS:</span> {j.humour_mechanisms.length > 0 ? j.humour_mechanisms.join(", ") : <em style={{ color: "#666" }}>None</em>}</div>
          {j.curator_note && (
            <div style={{ marginTop: "4px", fontSize: "11px", color: "#aaa", fontStyle: "italic" }}>
              Note: {j.curator_note}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onAdopt(j, source)}
          style={{
            marginTop: "auto",
            padding: "10px",
            background: isExcluded ? "#FF3B30" : "#2a2a2a",
            border: isExcluded ? "2px solid #ffffff" : "1px solid #c58cff",
            color: "#ffffff",
            fontFamily: "Anton",
            fontSize: "15px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.15s ease",
            boxShadow: isExcluded ? "2px 2px 0px #ffffff" : undefined
          }}
          title={`Adopt ${judgeName} decision [Key: ${shortcut}]`}
        >
          <span className="curate-key-pill" style={{ background: isExcluded ? "rgba(0,0,0,0.3)" : undefined }}>[{shortcut}]</span>
          ADOPT {judgeName.toUpperCase()}
        </button>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div className="curate-mobile-ai-strip">
        {bothEvaluated && isStatusConsensus && (
          <div
            className="curate-mobile-ai-card"
            style={{
              borderColor: j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30",
              boxShadow: `3px 3px 0px ${j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30"}`
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: "Anton", fontSize: "16px", color: j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30", letterSpacing: "0.5px" }}>
                ✓ AI CONSENSUS: {j4!.corpus_status.toUpperCase()}
              </span>
              <span style={{ fontSize: "10px", background: "#262626", color: "#f4c300", padding: "2px 6px", fontFamily: "monospace" }}>
                J4 & J5 AGREE
              </span>
            </div>
            {j4!.corpus_status === "keep" && (
              <div style={{ fontSize: "11px", color: "#aaa", marginTop: "4px" }}>
                {j4!.topics.join(", ") || "No topics"} · {j4!.tone || "No tone"}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => onAdopt(j4!, "consensus")}
                style={{
                  flex: 1,
                  background: j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30",
                  color: j4!.corpus_status === "keep" ? "#121212" : "#ffffff",
                  border: "none",
                  padding: "8px",
                  fontFamily: "Anton",
                  fontSize: "13px",
                  cursor: "pointer",
                  letterSpacing: "0.5px"
                }}
              >
                ➔ ADOPT (SWIPE →)
              </button>
            </div>
          </div>
        )}

        {bothEvaluated && !isStatusConsensus && (
          <div
            className="curate-mobile-ai-card"
            style={{
              borderColor: "#FF9F0A",
              boxShadow: "3px 3px 0px #FF9F0A"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontFamily: "Anton", fontSize: "15px", color: "#FF9F0A", letterSpacing: "0.5px" }}>
                ⚠️ AI CONFLICT
              </span>
              <span style={{ fontSize: "10px", color: "#aaa" }}>
                Swipe left/right to arbitrate
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button
                type="button"
                onClick={() => onAdopt(j4!, "judge4")}
                style={{
                  background: j4!.corpus_status === "excluded" ? "#FF3B30" : "#1c1b1b",
                  border: `2px solid ${j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30"}`,
                  color: "#fff",
                  padding: "8px",
                  fontFamily: "Anton",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow: j4!.corpus_status === "excluded" ? "2px 2px 0px #ffffff" : undefined
                }}
              >
                <div style={{ color: j4!.corpus_status === "excluded" ? "#ffffff" : "#c58cff" }}>J4 → {j4!.corpus_status.toUpperCase()}</div>
                <div style={{ fontSize: "10px", color: j4!.corpus_status === "excluded" ? "#ffe" : "#34C759", marginTop: "2px" }}>SWIPE RIGHT →</div>
              </button>
              <button
                type="button"
                onClick={() => onAdopt(j5!, "judge5")}
                style={{
                  background: j5!.corpus_status === "excluded" ? "#FF3B30" : "#1c1b1b",
                  border: `2px solid ${j5!.corpus_status === "keep" ? "#34C759" : "#FF3B30"}`,
                  color: "#fff",
                  padding: "8px",
                  fontFamily: "Anton",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "center",
                  boxShadow: j5!.corpus_status === "excluded" ? "2px 2px 0px #ffffff" : undefined
                }}
              >
                <div style={{ color: j5!.corpus_status === "excluded" ? "#ffffff" : "#c58cff" }}>J5 → {j5!.corpus_status.toUpperCase()}</div>
                <div style={{ fontSize: "10px", color: j5!.corpus_status === "excluded" ? "#ffe" : "#5AC8FA", marginTop: "2px" }}>← SWIPE LEFT</div>
              </button>
            </div>
          </div>
        )}

        {((hasJ4 && !hasJ5) || (!hasJ4 && hasJ5)) && (() => {
          const singleJudge = j4 || j5!;
          const isJ4 = hasJ4;
          const isKeep = singleJudge.corpus_status === "keep";
          const isExcluded = singleJudge.corpus_status === "excluded";
          const borderColor = isKeep ? "#34C759" : isExcluded ? "#FF3B30" : "#f4c300";
          return (
            <div
              className="curate-mobile-ai-card"
              style={{
                borderColor: borderColor,
                boxShadow: `3px 3px 0px ${borderColor}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "Anton", fontSize: "15px", color: borderColor, letterSpacing: "0.5px" }}>
                  {isExcluded ? "⛔ " : "🔶 "}{isJ4 ? "AI JUDGE 4" : "AI JUDGE 5"}: {singleJudge.corpus_status.toUpperCase()}
                </span>
                <span style={{ fontSize: "10px", color: isExcluded ? "#FF3B30" : "#aaa", fontFamily: "monospace" }}>
                  Swipe {isJ4 ? "→" : "←"} to adopt
                </span>
              </div>
              <button
                type="button"
                onClick={() => onAdopt(singleJudge, isJ4 ? "judge4" : "judge5")}
                style={{
                  width: "100%",
                  marginTop: "8px",
                  background: isKeep ? "#34C759" : isExcluded ? "#FF3B30" : "#f4c300",
                  color: isExcluded ? "#ffffff" : "#121212",
                  border: isExcluded ? "2px solid #ffffff" : "none",
                  padding: "8px",
                  fontFamily: "Anton",
                  fontSize: "13px",
                  cursor: "pointer",
                  boxShadow: isExcluded ? "2px 2px 0px #ffffff" : undefined
                }}
              >
                ADOPT {isJ4 ? "J4 (SWIPE →)" : "J5 (SWIPE ←)"}
              </button>
            </div>
          );
        })()}

        {!hasJ4 && !hasJ5 && (
          <div
            className="curate-mobile-ai-card"
            style={{
              borderColor: "#555",
              textAlign: "center",
              padding: "10px 14px"
            }}
          >
            <div style={{ color: "#f4c300", fontFamily: "Anton", fontSize: "14px" }}>
              NO AI PRE-JUDGEMENT
            </div>
            <div style={{ fontSize: "11px", color: "#888", margin: "4px 0" }}>
              Swipe up (↑) or tap to curate manually
            </div>
            <button
              type="button"
              onClick={onEnterOverride}
              style={{
                background: "#9b30ff",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                fontFamily: "Anton",
                fontSize: "12px",
                cursor: "pointer",
                marginTop: "4px"
              }}
            >
              ✏️ OPEN MANUAL OVERRIDE
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "20px" }}>
      {/* 1. STATE A: FULL AI CONSENSUS */}
      {bothEvaluated && isStatusConsensus && (
        <div
          style={{
            background: "#1c1b1b",
            border: `2px solid ${j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30"}`,
            padding: "18px",
            boxShadow: `4px 4px 0px ${j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30"}`
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span
              style={{
                fontSize: "20px",
                color: j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30",
                fontFamily: "Anton",
                letterSpacing: "1px"
              }}
            >
              AI CONSENSUS: {j4!.corpus_status.toUpperCase()}
            </span>
            <span style={{ fontSize: "11px", background: "#262626", color: "#f4c300", padding: "2px 8px", fontFamily: "monospace" }}>
              JUDGE 4 & 5 AGREE
            </span>
          </div>

          {allDetailsMatch ? (
            <>
              {j4!.corpus_status === "keep" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "13px", color: "#ddd", marginBottom: "16px", background: "#121212", padding: "10px 14px", border: "1px solid #333" }}>
                  <div><span style={{ color: "#888" }}>Topics:</span> {j4!.topics.join(", ") || "None"}</div>
                  <div><span style={{ color: "#888" }}>Tone:</span> {j4!.tone || "None"}</div>
                  <div><span style={{ color: "#888" }}>Mechanisms:</span> {j4!.humour_mechanisms.join(", ") || "None"}</div>
                </div>
              )}
              {j4!.corpus_status === "excluded" && (
                <div style={{ fontSize: "13px", color: "#aaa", marginBottom: "14px" }}>
                  Both AI Judge 4 and Judge 5 have analyzed this meme and determined it should be excluded from the active collection.
                </div>
              )}

              <button
                type="button"
                onClick={() => onAdopt(j4!, "consensus")}
                style={{
                  width: "100%",
                  background: j4!.corpus_status === "keep" ? "#34C759" : "#FF3B30",
                  color: j4!.corpus_status === "keep" ? "#121212" : "#ffffff",
                  border: "2px solid #ffffff",
                  padding: "14px",
                  fontFamily: "Anton",
                  fontSize: "18px",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  boxShadow: "3px 3px 0px #ffffff"
                }}
              >
                ➔ APPROVE AI CONSENSUS [SPACE / ENTER]
              </button>
            </>
          ) : (
            <div>
              <div style={{ color: "#f4c300", fontSize: "13px", marginBottom: "14px" }}>
                Both AIs agree on <strong>{j4!.corpus_status.toUpperCase()}</strong>, but categorization details differ. Press [4] or [5] to pick taxonomy, or press [SPACE/ENTER] to adopt AI 4:
              </div>
              <div style={{ display: "flex", gap: "14px" }}>
                {renderJudgeCard("AI Judge 4", j4!, "4", "judge4")}
                {renderJudgeCard("AI Judge 5", j5!, "5", "judge5")}
              </div>
              <button
                type="button"
                onClick={() => onAdopt(j4!, "judge4")}
                style={{
                  width: "100%",
                  marginTop: "12px",
                  background: j4!.corpus_status === "excluded" ? "#FF3B30" : "#34C759",
                  color: j4!.corpus_status === "excluded" ? "#ffffff" : "#121212",
                  border: j4!.corpus_status === "excluded" ? "2px solid #ffffff" : "2px solid #f4c300",
                  padding: "12px",
                  fontFamily: "Anton",
                  fontSize: "16px",
                  cursor: "pointer",
                  boxShadow: j4!.corpus_status === "excluded" ? "3px 3px 0px #ffffff" : undefined
                }}
              >
                FAST-APPROVE J4 DECISION [SPACE / ENTER]
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. STATE B: AI DISAGREEMENT */}
      {bothEvaluated && !isStatusConsensus && (
        <div
          style={{
            background: "#1c1b1b",
            border: "2px solid #FF9F0A",
            padding: "18px",
            boxShadow: "4px 4px 0px #FF9F0A"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <span style={{ fontSize: "19px", color: "#FF9F0A", fontFamily: "Anton", letterSpacing: "1px" }}>
              ⚠️ AI JUDGE DISAGREEMENT
            </span>
            <span style={{ fontSize: "11px", background: "#332211", color: "#FF9F0A", padding: "2px 8px", fontFamily: "monospace" }}>
              CONFLICT DETECTED
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "#ccc", marginBottom: "14px" }}>
            AI Judge 4 and AI Judge 5 reached different conclusions. Human judge authority required:
          </div>
          <div style={{ display: "flex", gap: "14px" }}>
            {renderJudgeCard("AI Judge 4", j4!, "4", "judge4")}
            {renderJudgeCard("AI Judge 5", j5!, "5", "judge5")}
          </div>
        </div>
      )}

      {/* 3. STATE SINGLE AI: ONLY ONE AI EVALUATED */}
      {((hasJ4 && !hasJ5) || (!hasJ4 && hasJ5)) && (
        (() => {
          const singleJudge = j4 || j5!;
          const judgeLabel = hasJ4 ? "AI Judge 4" : "AI Judge 5";
          const source = hasJ4 ? "judge4" : "judge5";
          const isKeep = singleJudge.corpus_status === "keep";
          const isExcluded = singleJudge.corpus_status === "excluded";
          const borderColor = isKeep ? "#34C759" : isExcluded ? "#FF3B30" : "#f4c300";

          return (
            <div
              style={{
                background: "#1c1b1b",
                border: `2px solid ${borderColor}`,
                padding: "18px",
                boxShadow: `4px 4px 0px ${borderColor}`
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <span style={{ fontSize: "18px", color: borderColor, fontFamily: "Anton", letterSpacing: "1px" }}>
                  {isExcluded ? "⛔ " : ""}SINGLE AI EVALUATION: {judgeLabel.toUpperCase()} → {singleJudge.corpus_status.toUpperCase()}
                </span>
                <span style={{ fontSize: "11px", background: isExcluded ? "#3a1414" : "#332d18", color: borderColor, padding: "2px 8px", fontFamily: "monospace" }}>
                  1 AI READY
                </span>
              </div>

              <div style={{ background: "#121212", border: "1px solid #333", padding: "12px", marginBottom: "14px", fontSize: "13px", color: "#ddd" }}>
                <div><span style={{ color: "#888" }}>Status:</span> <strong style={{ color: isKeep ? "#34C759" : isExcluded ? "#FF3B30" : "#FF9F0A" }}>{singleJudge.corpus_status.toUpperCase()}</strong></div>
                <div><span style={{ color: "#888" }}>Topics:</span> {singleJudge.topics.join(", ") || "None"}</div>
                <div><span style={{ color: "#888" }}>Tone:</span> {singleJudge.tone || "None"}</div>
                <div><span style={{ color: "#888" }}>Mechanisms:</span> {singleJudge.humour_mechanisms.join(", ") || "None"}</div>
                {singleJudge.curator_note && (
                  <div style={{ marginTop: "4px", fontSize: "11px", color: "#aaa", fontStyle: "italic" }}>
                    Note: {singleJudge.curator_note}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => onAdopt(singleJudge, source)}
                style={{
                  width: "100%",
                  background: isKeep ? "#34C759" : isExcluded ? "#FF3B30" : "#f4c300",
                  color: isExcluded ? "#ffffff" : "#121212",
                  border: "2px solid #ffffff",
                  padding: "14px",
                  fontFamily: "Anton",
                  fontSize: "18px",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
                  boxShadow: "3px 3px 0px #ffffff"
                }}
              >
                ➔ INSTANTLY ADOPT {judgeLabel.toUpperCase()} [SPACE / ENTER]
              </button>
            </div>
          );
        })()
      )}

      {/* 4. STATE NONE: NEITHER AI HAS EVALUATED */}
      {!hasJ4 && !hasJ5 && (
        <div
          style={{
            background: "#1c1b1b",
            border: "2px solid #555",
            padding: "20px",
            textAlign: "center"
          }}
        >
          <div style={{ fontSize: "18px", color: "#f4c300", fontFamily: "Anton", letterSpacing: "1px", marginBottom: "8px" }}>
            NO AI PRE-JUDGEMENT AVAILABLE
          </div>
          <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 16px 0" }}>
            This meme has not been pre-evaluated by AI Judge 4 or Judge 5. Please curate manually.
          </p>
          <button
            type="button"
            onClick={onEnterOverride}
            style={{
              background: "#9b30ff",
              color: "#ffffff",
              border: "2px solid #f4c300",
              padding: "10px 20px",
              fontFamily: "Anton",
              fontSize: "16px",
              cursor: "pointer",
              boxShadow: "3px 3px 0px #f4c300"
            }}
          >
            OPEN MANUAL CURATION [O]
          </button>
        </div>
      )}

      {/* Action Buttons Row: Manual Override & FORCE REMOVE */}
      <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
        <button
          type="button"
          onClick={onEnterOverride}
          style={{
            flex: 1,
            background: "#222222",
            color: "#f4c300",
            border: "1px solid #f4c300",
            padding: "12px",
            fontFamily: "Anton",
            fontSize: "15px",
            cursor: "pointer",
            boxShadow: "2px 2px 0px #f4c300",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
          title="Switch to manual curation [Key: O]"
        >
          <span>✏️</span>
          <span>MANUAL OVERRIDE [O]</span>
        </button>

        <button
          type="button"
          onClick={onForceRemove}
          style={{
            flex: 1,
            background: "#380d0d",
            color: "#FF3B30",
            border: "1px solid #FF3B30",
            padding: "12px",
            fontFamily: "Anton",
            fontSize: "15px",
            cursor: "pointer",
            boxShadow: "2px 2px 0px #FF3B30",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
          title="Permanently remove invalid non-meme from R2 and database [Key: Shift+Delete]"
        >
          <span>🗑️</span>
          <span>FORCE REMOVE [SHIFT+DEL]</span>
        </button>
      </div>
    </div>
  );
}
