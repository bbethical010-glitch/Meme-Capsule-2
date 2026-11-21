import React from "react";
import type { CorpusStatus } from "./curateTypes";

interface EditorialButtonsProps {
  currentStatus: CorpusStatus | null;
  duplicateOf: string;
  onSelectStatus: (status: CorpusStatus) => void;
  onChangeDuplicateOf: (id: string) => void;
  onForceRemove?: () => void;
  forceRemoveLoading?: boolean;
}

export default function EditorialButtons({
  currentStatus,
  duplicateOf,
  onSelectStatus,
  onChangeDuplicateOf,
  onForceRemove,
  forceRemoveLoading
}: EditorialButtonsProps) {
  return (
    <div>
      <div style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="curate-anton" style={{ fontSize: "15px", color: "#f4c300" }}>
          LAYER 0 — EDITORIAL ACTION
        </span>
        <span style={{ fontSize: "11px", color: "#aaa" }}>
          {currentStatus ? `SELECTED: ${currentStatus.toUpperCase()}` : "SELECT ACTION [K, X, D]"}
        </span>
      </div>

      <div className="curate-editorial-strip">
        {/* KEEP */}
        <button
          type="button"
          className={`curate-action-btn ${currentStatus === "keep" ? "active" : ""}`}
          style={{
            "--btn-border": "#34C759",
            background: currentStatus === "keep" ? "#34C759" : "#1c1b1b",
            color: currentStatus === "keep" ? "#121212" : "#ffffff"
          } as React.CSSProperties}
          onClick={() => onSelectStatus("keep")}
          title="Keep in active collection [Key: K]"
        >
          <span className="curate-key-pill">[K]</span>
          <span className="curate-anton" style={{ fontSize: "16px" }}>KEEP</span>
          <span style={{ fontSize: "10px", opacity: 0.8 }}>Active Corpus</span>
        </button>

        {/* EXCLUDE */}
        <button
          type="button"
          className={`curate-action-btn ${currentStatus === "excluded" ? "active" : ""}`}
          style={{
            "--btn-border": "#FF3B30",
            background: currentStatus === "excluded" ? "#FF3B30" : "#1c1b1b",
            color: currentStatus === "excluded" ? "#ffffff" : "#ffffff"
          } as React.CSSProperties}
          onClick={() => onSelectStatus("excluded")}
          title="Exclude from active collection [Key: X]"
        >
          <span className="curate-key-pill">[X]</span>
          <span className="curate-anton" style={{ fontSize: "16px" }}>EXCLUDE</span>
          <span style={{ fontSize: "10px", opacity: 0.8 }}>Reversible</span>
        </button>

        {/* DUPLICATE */}
        <button
          type="button"
          className={`curate-action-btn ${currentStatus === "duplicate" ? "active" : ""}`}
          style={{
            "--btn-border": "#FF9F0A",
            background: currentStatus === "duplicate" ? "#FF9F0A" : "#1c1b1b",
            color: currentStatus === "duplicate" ? "#121212" : "#ffffff"
          } as React.CSSProperties}
          onClick={() => onSelectStatus("duplicate")}
          title="Mark as duplicate meme [Key: D]"
        >
          <span className="curate-key-pill">[D]</span>
          <span className="curate-anton" style={{ fontSize: "16px" }}>DUPLICATE</span>
          <span style={{ fontSize: "10px", opacity: 0.8 }}>Mark Copy</span>
        </button>
      </div>

      {/* FORCE REMOVE Button (Danger Action) */}
      {onForceRemove && (
        <div style={{ marginTop: "-8px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={onForceRemove}
            disabled={forceRemoveLoading}
            style={{
              width: "100%",
              background: "#1c1b1b",
              border: "2px solid #dd0061",
              color: "#dd0061",
              padding: "8px 12px",
              fontSize: "12px",
              fontFamily: "Oswald, sans-serif",
              fontWeight: "bold",
              cursor: forceRemoveLoading ? "not-allowed" : "pointer",
              opacity: forceRemoveLoading ? 0.5 : 1,
              boxShadow: forceRemoveLoading ? "none" : "2px 2px 0px #dd0061",
              letterSpacing: "0.5px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px"
            }}
            title="Permanently remove meme from storage & database (Shift+X)"
          >
            <span>⚡ FORCE REMOVE [SHIFT+X]</span>
            <span style={{ fontSize: "10px", color: "#888", fontWeight: "normal" }}>
              — Irreversible (Immediate R2 deletion & audit log)
            </span>
          </button>
        </div>
      )}

      {/* Duplicate-Of Input (if Duplicate is chosen) */}
      {currentStatus === "duplicate" && (
        <div style={{ background: "#221c16", border: "1px solid #FF9F0A", padding: "8px 12px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#FF9F0A", fontWeight: "bold" }}>DUPLICATE OF MEME ID:</span>
          <input
            type="text"
            placeholder="e.g. meme-1234abcd (or leave blank)"
            value={duplicateOf}
            onChange={(e) => onChangeDuplicateOf(e.target.value)}
            style={{
              background: "#121212",
              border: "1px solid #555",
              color: "#fff",
              padding: "4px 8px",
              fontFamily: "monospace",
              fontSize: "12px",
              flex: 1,
              outline: "none"
            }}
          />
        </div>
      )}
    </div>
  );
}
