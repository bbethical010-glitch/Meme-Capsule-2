import React, { useState } from "react";
import type { SuperMemeItem } from "./curateSuperApi";
import { resolveSuperMeme } from "./curateSuperApi";
import {
  CURATION_TOPICS,
  CURATION_TONES,
  CURATION_MECHANISMS,
  type CorpusStatus
} from "../curateTypes";

interface CuratorResolveModalProps {
  meme: SuperMemeItem;
  onClose: () => void;
  onResolved: () => void;
}

export default function CuratorResolveModal({
  meme,
  onClose,
  onResolved
}: CuratorResolveModalProps) {
  const initial = meme.final_decision || (meme.judges.length > 0 ? meme.judges[0] : null);

  const [status, setStatus] = useState<CorpusStatus>(initial?.corpus_status || "keep");
  const [duplicateOf, setDuplicateOf] = useState<string>(initial?.duplicate_of || "");
  const [topics, setTopics] = useState<string[]>(initial?.topics || []);
  const [tone, setTone] = useState<string | null>(initial?.tone || null);
  const [mechanisms, setMechanisms] = useState<string[]>(initial?.humour_mechanisms || []);
  const [note, setNote] = useState<string>(initial?.curator_note || "");
  const [saving, setSaving] = useState(false);

  const adoptJudge = (j: typeof meme.judges[0]) => {
    setStatus(j.corpus_status);
    setDuplicateOf(j.duplicate_of || "");
    setTopics(j.topics || []);
    setTone(j.tone || null);
    setMechanisms(j.humour_mechanisms || []);
    setNote(j.curator_note || "");
  };

  const handleToggleTopic = (topicId: string) => {
    setTopics((prev) => {
      if (prev.includes(topicId)) return prev.filter((t) => t !== topicId);
      if (prev.length >= 3) return [...prev.slice(1), topicId];
      return [...prev, topicId];
    });
  };

  const handleToggleMechanism = (mechId: string) => {
    setMechanisms((prev) => {
      if (prev.includes(mechId)) return prev.filter((m) => m !== mechId);
      if (prev.length >= 2) return [...prev.slice(1), mechId];
      return [...prev, mechId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await resolveSuperMeme({
        meme_id: meme.id,
        corpus_status: status,
        duplicate_of: status === "duplicate" ? duplicateOf : null,
        topics: status === "keep" ? topics : [],
        tone: status === "keep" ? tone : null,
        humour_mechanisms: status === "keep" ? mechanisms : [],
        curator_note: note || null
      });
      onResolved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resolve meme");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.88)",
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "#1c1b1b",
          border: "2px solid #9b30ff",
          boxShadow: "6px 6px 0px #f4c300",
          maxWidth: "1000px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "24px"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333", paddingBottom: "12px", marginBottom: "20px" }}>
          <div>
            <span style={{ fontSize: "11px", color: "#f4c300", fontFamily: "monospace" }}>SUPER ADMIN RESOLUTION</span>
            <h2 className="curate-anton" style={{ margin: 0, fontSize: "24px", color: "#fff" }}>
              {meme.title} ({meme.id})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#FF3B30", fontSize: "16px", cursor: "pointer", fontFamily: "Anton" }}
          >
            ✕ CLOSE
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px" }}>
          {/* Left: Image & Judge Reviews Comparison */}
          <div>
            <div style={{ background: "#121212", border: "1px solid #444", padding: "8px", textAlign: "center", marginBottom: "16px" }}>
              <img
                src={meme.image_url}
                alt={meme.title}
                style={{ maxWidth: "100%", maxHeight: "240px", objectFit: "contain" }}
              />
            </div>

            <h4 className="curate-anton" style={{ color: "#9b30ff", margin: "0 0 8px 0", fontSize: "14px" }}>
              JUDGES SUBMISSIONS ({meme.judges.length})
            </h4>

            {meme.judges.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#666", padding: "12px", background: "#161616" }}>
                No judges have reviewed this meme yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {meme.judges.map((j) => (
                  <div
                    key={j.user_id}
                    style={{
                      background: "#242424",
                      border: "1px solid #333",
                      padding: "10px",
                      fontSize: "12px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <strong style={{ color: "#f4c300" }}>{j.user_name}</strong>
                      <span
                        style={{
                          fontSize: "10px",
                          fontFamily: "Anton",
                          padding: "2px 6px",
                          background: j.corpus_status === "keep" ? "#34C759" : j.corpus_status === "excluded" ? "#FF3B30" : "#FF9F0A",
                          color: "#121212"
                        }}
                      >
                        {j.corpus_status.toUpperCase()}
                      </span>
                    </div>

                    <div style={{ color: "#aaa", fontSize: "11px", marginBottom: "4px" }}>
                      <strong>Topics:</strong> {j.topics.length ? j.topics.join(", ") : "None"}
                    </div>
                    <div style={{ color: "#aaa", fontSize: "11px", marginBottom: "4px" }}>
                      <strong>Tone:</strong> {j.tone || "None"} | <strong>Mechanisms:</strong> {j.humour_mechanisms.length ? j.humour_mechanisms.join(", ") : "None"}
                    </div>

                    <button
                      type="button"
                      onClick={() => adoptJudge(j)}
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        background: "#333",
                        border: "1px solid #555",
                        color: "#f4c300",
                        padding: "4px",
                        fontFamily: "Oswald",
                        fontSize: "11px",
                        cursor: "pointer"
                      }}
                    >
                      ⚡ ADOPT {j.user_name.toUpperCase()}'S DECISION
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Final Decision Builder Form */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Layer 0 Action */}
            <div style={{ background: "#222", padding: "12px", border: "1px solid #444" }}>
              <div style={{ fontSize: "13px", fontFamily: "Anton", color: "#f4c300", marginBottom: "8px" }}>
                AUTHORITATIVE EDITORIAL STATUS
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                {(["keep", "excluded", "duplicate"] as CorpusStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    style={{
                      padding: "8px",
                      fontFamily: "Anton",
                      fontSize: "13px",
                      cursor: "pointer",
                      border: "2px solid #555",
                      background: status === s ? (s === "keep" ? "#34C759" : s === "excluded" ? "#FF3B30" : "#FF9F0A") : "#161616",
                      color: status === s ? "#121212" : "#fff"
                    }}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>

              {status === "duplicate" && (
                <div style={{ marginTop: "8px" }}>
                  <input
                    type="text"
                    placeholder="Duplicate of meme ID..."
                    value={duplicateOf}
                    onChange={(e) => setDuplicateOf(e.target.value)}
                    style={{ width: "100%", background: "#121212", border: "1px solid #555", color: "#fff", padding: "6px" }}
                  />
                </div>
              )}
            </div>

            {/* Layer 1 Categorization (Enabled if KEEP) */}
            {status === "keep" && (
              <>
                {/* Topics */}
                <div style={{ background: "#222", padding: "12px", border: "1px solid #444" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "13px", fontFamily: "Anton", color: "#9b30ff" }}>TOPICS ({topics.length}/3)</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {CURATION_TOPICS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleToggleTopic(t.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                          background: topics.includes(t.id) ? "#9b30ff" : "#161616",
                          color: "#fff",
                          border: "1px solid #444"
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div style={{ background: "#222", padding: "12px", border: "1px solid #444" }}>
                  <div style={{ fontSize: "13px", fontFamily: "Anton", color: "#f4c300", marginBottom: "6px" }}>
                    DOMINANT TONE ({tone || "NONE"})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {CURATION_TONES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(tone === t.id ? null : t.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                          background: tone === t.id ? t.color : "#161616",
                          color: tone === t.id ? "#121212" : "#fff",
                          border: "1px solid #444",
                          fontWeight: tone === t.id ? "bold" : "normal"
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mechanisms */}
                <div style={{ background: "#222", padding: "12px", border: "1px solid #444" }}>
                  <div style={{ fontSize: "13px", fontFamily: "Anton", color: "#5AC8FA", marginBottom: "6px" }}>
                    HUMOUR MECHANISMS ({mechanisms.length}/2)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {CURATION_MECHANISMS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleToggleMechanism(m.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: "11px",
                          cursor: "pointer",
                          background: mechanisms.includes(m.id) ? "#5AC8FA" : "#161616",
                          color: mechanisms.includes(m.id) ? "#121212" : "#fff",
                          border: "1px solid #444",
                          fontWeight: mechanisms.includes(m.id) ? "bold" : "normal"
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Note & Submit */}
            <div>
              <input
                type="text"
                placeholder="Superadmin resolution rationale..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                style={{ width: "100%", background: "#181818", border: "1px solid #333", color: "#fff", padding: "8px", fontSize: "12px" }}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                background: "#34C759",
                color: "#121212",
                border: "2px solid #f4c300",
                padding: "12px",
                fontFamily: "Anton",
                fontSize: "16px",
                cursor: "pointer",
                boxShadow: "3px 3px 0px #f4c300"
              }}
            >
              {saving ? "SAVING..." : "🔒 SAVE AUTHORITATIVE RESOLUTION"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
