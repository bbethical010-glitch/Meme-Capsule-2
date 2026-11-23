import React from "react";
import type { CorpusSummaryResponse, CorpusState } from "../types/corpus";
import { STATE_METADATA } from "../types/corpus";

interface CorpusCategoryCardsProps {
  summary: CorpusSummaryResponse | null;
  activeStateFilter?: CorpusState | "all" | string;
  onSelectState?: (state: CorpusState) => void;
  showTotal?: boolean;
  className?: string;
}

export const CorpusCategoryCards: React.FC<CorpusCategoryCardsProps> = ({
  summary,
  activeStateFilter,
  onSelectState,
  showTotal = true,
  className = ""
}) => {
  const states: CorpusState[] = ["draft", "archive", "active", "conflict", "excluded"];

  const total = summary ? summary.total : 0;
  const isIntact = summary ? summary.integrity.ok : true;

  return (
    <div className={`corpus-category-container ${className}`} style={{ marginBottom: "20px" }}>
      {showTotal && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#121212",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "12px 18px",
            marginBottom: "14px"
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
            <span style={{ fontSize: "12px", letterSpacing: "1px", color: "#888", fontWeight: "bold" }}>
              TOTAL CORPUS
            </span>
            <span style={{ fontSize: "28px", fontWeight: "900", fontFamily: "Oswald, sans-serif", color: "#fff" }}>
              {summary ? total.toLocaleString() : "—"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                padding: "3px 8px",
                borderRadius: "4px",
                background: isIntact ? "rgba(52, 199, 89, 0.15)" : "rgba(255, 59, 48, 0.15)",
                color: isIntact ? "#34c759" : "#ff3b30",
                border: `1px solid ${isIntact ? "#34c759" : "#ff3b30"}`
              }}
            >
              {isIntact ? "✓ 5-STATE INTACT" : "⚠ DRIFT DETECTED"}
            </span>
            {summary?.last_maintenance_at && (
              <span style={{ fontSize: "10px", color: "#666" }}>
                Maintained: {new Date(summary.last_maintenance_at).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px"
        }}
      >
        {states.map((st) => {
          const meta = STATE_METADATA[st];
          const count = summary ? summary[st] : 0;
          const isSelected = activeStateFilter === st;

          return (
            <button
              key={st}
              type="button"
              onClick={() => onSelectState && onSelectState(st)}
              style={{
                textAlign: "left",
                background: isSelected ? "rgba(255, 255, 255, 0.06)" : "#18181b",
                border: `2px solid ${isSelected ? meta.color : "#27272a"}`,
                borderTop: `4px solid ${meta.color}`,
                borderRadius: "8px",
                padding: "12px 14px",
                cursor: onSelectState ? "pointer" : "default",
                transition: "all 0.15s ease",
                boxShadow: isSelected ? `0 0 12px ${meta.color}33` : "none"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    letterSpacing: "0.8px",
                    color: meta.color
                  }}
                >
                  {meta.label}
                </span>
              </div>

              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "900",
                  fontFamily: "Oswald, sans-serif",
                  color: "#fff",
                  marginBottom: "4px"
                }}
              >
                {summary ? count.toLocaleString() : "—"}
              </div>

              <div style={{ fontSize: "10px", color: "#888", lineHeight: "1.3" }}>
                {meta.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CorpusCategoryCards;
