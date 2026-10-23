import React, { useState, useEffect, useRef } from "react";

export type RefreshInterval = 10000 | 30000 | 60000 | 300000 | 0;

interface AutoRefreshControlProps {
  onRefresh: () => void | Promise<void>;
  isRefreshing?: boolean;
  storageKey?: string;
  defaultInterval?: RefreshInterval;
}

const INTERVAL_OPTIONS: { label: string; value: RefreshInterval }[] = [
  { label: "Every 10 seconds", value: 10000 },
  { label: "Every 30 seconds", value: 30000 },
  { label: "Every minute", value: 60000 },
  { label: "Every 5 minutes", value: 300000 },
  { label: "Off", value: 0 },
];

export default function AutoRefreshControl({
  onRefresh,
  isRefreshing = false,
  storageKey = "meme_capsule_autorefresh_interval",
  defaultInterval = 10000,
}: AutoRefreshControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [intervalMs, setIntervalMs] = useState<RefreshInterval>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if ([10000, 30000, 60000, 300000, 0].includes(parsed)) {
          return parsed as RefreshInterval;
        }
      }
    } catch {
      // fallback
    }
    return defaultInterval;
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Interval timer effect for silent backend sync
  useEffect(() => {
    if (intervalMs <= 0) return;

    const timer = setInterval(() => {
      onRefresh();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, onRefresh]);

  const handleSelectInterval = (val: RefreshInterval) => {
    setIntervalMs(val);
    try {
      sessionStorage.setItem(storageKey, String(val));
    } catch {
      // ignore
    }
    setIsOpen(false);
  };

  const getButtonLabel = (val: RefreshInterval) => {
    switch (val) {
      case 10000:
        return "10s";
      case 30000:
        return "30s";
      case 60000:
        return "1m";
      case 300000:
        return "5m";
      default:
        return "Off";
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      {/* Trigger Button (GitHub Actions style) */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "#21262d",
          color: "#c9d1d9",
          border: "1px solid #30363d",
          borderRadius: "6px",
          padding: "5px 12px",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          outline: "none",
          transition: "background 0.15s, border-color 0.15s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#30363d";
          e.currentTarget.style.borderColor = "#8b949e";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#21262d";
          e.currentTarget.style.borderColor = "#30363d";
        }}
      >
        <span style={{ color: intervalMs > 0 ? "#58a6ff" : "#8b949e" }}>
          Auto-refresh: {getButtonLabel(intervalMs)}
        </span>
        <span
          style={{
            fontSize: "10px",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            display: "inline-block",
            color: "#8b949e",
          }}
        >
          ▾
        </span>
        {isRefreshing && (
          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#2ea043",
              animation: "pulse 1s infinite alternate",
            }}
            title="Syncing live data from DB..."
          />
        )}
      </button>

      {/* GitHub Actions styled Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            backgroundColor: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "6px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
            width: "210px",
            zIndex: 1000,
            padding: "4px 0",
            overflow: "hidden",
            textAlign: "left",
          }}
        >
          <div
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#8b949e",
              borderBottom: "1px solid #21262d",
              marginBottom: "4px",
            }}
          >
            Auto-refresh
          </div>

          {INTERVAL_OPTIONS.map((opt) => {
            const isSelected = intervalMs === opt.value;
            return (
              <div
                key={opt.value}
                onClick={() => handleSelectInterval(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "7px 14px",
                  fontSize: "13px",
                  color: isSelected ? "#ffffff" : "#c9d1d9",
                  background: isSelected ? "#1f242c" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#21262d";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    width: "16px",
                    display: "inline-block",
                    fontWeight: "bold",
                    color: "#58a6ff",
                    marginRight: "6px",
                  }}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span>{opt.label}</span>
              </div>
            );
          })}

          <div style={{ height: "1px", backgroundColor: "#30363d", margin: "4px 0" }} />

          {/* Refresh now option */}
          <div
            onClick={() => {
              onRefresh();
              setIsOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 14px",
              fontSize: "13px",
              color: "#c9d1d9",
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#21262d")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              style={{
                display: "inline-block",
                transform: isRefreshing ? "rotate(180deg)" : "none",
                transition: "transform 0.3s",
                marginRight: "2px",
              }}
            >
              🔄
            </span>
            <span style={{ fontWeight: 500 }}>Refresh now</span>
          </div>
        </div>
      )}
    </div>
  );
}
