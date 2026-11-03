import React, { useState, useEffect, useCallback, useRef } from "react";
import type { CurateMemeItem } from "../curateTypes";
import type { EditorState, EditorTool } from "./imageEditorTypes";
import { KonvaCanvas } from "./KonvaCanvas";
import { exportEditorToBlob } from "./exportCanvas";

interface ImageEditorModalProps {
  meme: CurateMemeItem;
  token?: string;
  onClose: () => void;
  onSaveSuccess: (updatedMeme: { id: string; image_url: string; storage_path?: string }) => void;
}

const DEFAULT_STATE: EditorState = {
  rotation: 0,
  crop: null,
  blurRegions: [],
  lines: [],
  shapes: [],
  texts: []
};

const PALETTE = ["#FFFFFF", "#F4C300", "#FF3B30", "#34C759", "#00F0FF", "#9B30FF", "#000000"];

export default function ImageEditorModal({
  meme,
  token,
  onClose,
  onSaveSuccess
}: ImageEditorModalProps) {
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [imageLoading, setImageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTool, setActiveTool] = useState<EditorTool>("select");
  const [brushColor, setBrushColor] = useState<string>("#F4C300");
  const [brushSize, setBrushSize] = useState<number>(8);

  const [editorState, setEditorState] = useState<EditorState>(DEFAULT_STATE);
  const [history, setHistory] = useState<EditorState[]>([DEFAULT_STATE]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [isSaving, setIsSaving] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [containerDim, setContainerDim] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Measure container dimensions
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDim({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 600
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Load image with CORS resilience and same-origin proxy fallback
  useEffect(() => {
    let cancelled = false;
    let objectUrlToRevoke: string | null = null;

    const sessionToken =
      token ||
      sessionStorage.getItem("curator_token") ||
      localStorage.getItem("mc_curator_token") ||
      localStorage.getItem("curator_token") ||
      "";

    const loadImage = async () => {
      setImageLoading(true);
      setLoadError(null);

      try {
        let blob: Blob | null = null;

        // Attempt 1: Fetch via same-origin media proxy (bypasses browser CORS restrictions)
        try {
          const proxyUrl = `/api/curate/media/proxy?id=${encodeURIComponent(meme.id)}&url=${encodeURIComponent(meme.image_url)}`;
          const proxyRes = await fetch(proxyUrl, {
            headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}
          });
          if (proxyRes.ok) {
            blob = await proxyRes.blob();
          }
        } catch (e) {
          console.warn("Media proxy fetch failed, attempting direct fetch:", e);
        }

        // Attempt 2: If proxy returned error, attempt direct CORS fetch
        if (!blob) {
          try {
            const directRes = await fetch(meme.image_url, { mode: "cors" });
            if (directRes.ok) {
              blob = await directRes.blob();
            }
          } catch {
            // Direct CORS fetch failed
          }
        }

        if (cancelled) return;

        if (blob) {
          const objectUrl = URL.createObjectURL(blob);
          objectUrlToRevoke = objectUrl;

          const img = new Image();
          img.onload = () => {
            if (cancelled) return;
            setImageObj(img);
            setImageLoading(false);
          };
          img.onerror = () => {
            if (cancelled) return;
            setLoadError("Failed to decode image data.");
            setImageLoading(false);
          };
          img.src = objectUrl;
        } else {
          // Attempt 3: Direct Image tag with crossOrigin
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            if (cancelled) return;
            setImageObj(img);
            setImageLoading(false);
          };
          img.onerror = () => {
            if (cancelled) return;
            setLoadError("Failed to load meme image for editing (CORS or network error).");
            setImageLoading(false);
          };
          img.src = meme.image_url;
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Image loader error:", err);
        setLoadError(
          "Failed to load meme image for editing: " +
            (err instanceof Error ? err.message : "Network error")
        );
        setImageLoading(false);
      }
    };

    loadImage();

    return () => {
      cancelled = true;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [meme.id, meme.image_url, token]);

  // Push state to history stack
  const updateState = useCallback(
    (updater: (prev: EditorState) => EditorState) => {
      setEditorState((prev) => {
        const next = updater(prev);
        setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
        setHistoryIndex((i) => i + 1);
        return next;
      });
    },
    [historyIndex]
  );

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setEditorState(history[prevIdx]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setEditorState(history[nextIdx]);
    }
  }, [historyIndex, history]);

  const handleReset = useCallback(() => {
    if (window.confirm("Reset all edits and return to original image?")) {
      updateState(() => DEFAULT_STATE);
    }
  }, [updateState]);

  const handleRotate = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      rotation: (prev.rotation + 90) % 360
    }));
  }, [updateState]);

  const handleTogglePreview = useCallback(async () => {
    if (previewBlobUrl) {
      URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
      return;
    }
    if (!imageObj) return;
    try {
      const { blob } = await exportEditorToBlob(imageObj, editorState);
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
    } catch (err) {
      alert(`Preview failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [imageObj, editorState, previewBlobUrl]);

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl);
    };
  }, [previewBlobUrl]);

  // Handle Save with compare-and-swap CAS protocol
  const handleSave = useCallback(async () => {
    if (!imageObj || isSaving) return;
    setIsSaving(true);

    try {
      // 1. Export full-resolution canvas
      const { blob } = await exportEditorToBlob(imageObj, editorState);

      // 2. Prepare multipart upload with CAS revision token
      const expectedStoragePath = meme.storage_path || "";
      const formData = new FormData();
      formData.append("meme_id", meme.id);
      formData.append("expected_storage_path", expectedStoragePath);
      formData.append("file", blob, `edited-${meme.id}.webp`);

      const sessionToken =
        token ||
        sessionStorage.getItem("curator_token") ||
        localStorage.getItem("mc_curator_token") ||
        localStorage.getItem("curator_token") ||
        "";

      const response = await fetch("/api/curate/media/edit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`
        },
        body: formData
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 409) {
          alert("⚠️ CONFLICT ERROR: The image was modified by another editor. Please close and reload the newest revision.");
        } else {
          alert(`Save failed: ${(result as { error?: string }).error || "Server error"}`);
        }
        return;
      }

      onSaveSuccess({
        id: meme.id,
        image_url: (result as { image_url: string }).image_url,
        storage_path: (result as { storage_path?: string }).storage_path
      });
      onClose();
    } catch (err) {
      console.error("Image editor save error:", err);
      alert(`Save failed: ${err instanceof Error ? err.message : "Network error"}`);
    } finally {
      setIsSaving(false);
    }
  }, [imageObj, editorState, meme, isSaving, onSaveSuccess, onClose]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, handleUndo, handleRedo, handleSave]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.92)",
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        boxSizing: "border-box",
        fontFamily: "Oswald, sans-serif"
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#181818",
          border: "2px solid #333",
          boxShadow: "3px 3px 0px #000",
          padding: "10px 16px",
          marginBottom: "10px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontFamily: "Anton", fontSize: "20px", color: "#f4c300", letterSpacing: "1px" }}>
            🎨 CANONICAL IMAGE EDITOR
          </span>
          <span style={{ fontSize: "12px", color: "#888", fontFamily: "monospace" }}>
            ID: {meme.id}
          </span>
          {imageObj && (
            <span style={{ fontSize: "12px", color: "#34C759", border: "1px solid #34C759", padding: "2px 6px" }}>
              {imageObj.naturalWidth} × {imageObj.naturalHeight}px
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#222",
              border: "1px solid #555",
              color: "#fff",
              padding: "6px 14px",
              cursor: "pointer",
              fontFamily: "Anton"
            }}
          >
            ✕ ESC CLOSE
          </button>
        </div>
      </div>

      {/* Toolbar Strip */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
          background: "#1f1f1f",
          border: "2px solid #333",
          boxShadow: "2px 2px 0px #000",
          padding: "8px 12px",
          marginBottom: "10px"
        }}
      >
        {/* Tool Select Buttons */}
        {(
          [
            { id: "select", label: "✋ SELECT" },
            { id: "crop", label: "✂️ CROP" },
            { id: "blur", label: "🌫️ BLUR" },
            { id: "mosaic", label: "⬛ MOSAIC" },
            { id: "brush", label: "✏️ BRUSH" },
            { id: "rectangle", label: "⬜ RECT" },
            { id: "circle", label: "⚪ CIRCLE" },
            { id: "text", label: "🔤 TEXT" }
          ] as const
        ).map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActiveTool(tool.id)}
            style={{
              background: activeTool === tool.id ? "#f4c300" : "#2a2a2a",
              color: activeTool === tool.id ? "#000" : "#fff",
              border: `2px solid ${activeTool === tool.id ? "#fff" : "#444"}`,
              padding: "6px 12px",
              fontSize: "12px",
              fontFamily: "Anton",
              cursor: "pointer",
              boxShadow: activeTool === tool.id ? "2px 2px 0px #fff" : "none"
            }}
          >
            {tool.label}
          </button>
        ))}

        <div style={{ width: "1px", height: "24px", background: "#444", margin: "0 4px" }} />

        {/* Rotate Button */}
        <button
          type="button"
          onClick={handleRotate}
          style={{
            background: "#2a2a2a",
            color: "#34C759",
            border: "2px solid #34C759",
            padding: "6px 10px",
            fontSize: "12px",
            fontFamily: "Anton",
            cursor: "pointer"
          }}
          title="Rotate 90 degrees clockwise"
        >
          🔄 ROTATE 90°
        </button>

        {/* Clear Crop */}
        {editorState.crop && (
          <button
            type="button"
            onClick={() => updateState((p) => ({ ...p, crop: null }))}
            style={{
              background: "#380d0d",
              color: "#ff4d4d",
              border: "1px solid #ff4d4d",
              padding: "6px 10px",
              fontSize: "11px",
              cursor: "pointer"
            }}
          >
            ✕ CLEAR CROP
          </button>
        )}

        <div style={{ width: "1px", height: "24px", background: "#444", margin: "0 4px" }} />

        {/* Color Palette */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBrushColor(c)}
              style={{
                width: "20px",
                height: "20px",
                background: c,
                border: `2px solid ${brushColor === c ? "#fff" : "#333"}`,
                cursor: "pointer",
                borderRadius: "2px"
              }}
              title={c}
            />
          ))}
        </div>

        {/* Brush Size Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "8px" }}>
          <span style={{ fontSize: "11px", color: "#aaa" }}>SIZE:</span>
          <input
            type="range"
            min={2}
            max={40}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            style={{ width: "70px", accentColor: "#f4c300" }}
          />
          <span style={{ fontSize: "11px", color: "#fff", width: "24px" }}>{brushSize}px</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Undo / Redo */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex === 0}
            style={{
              background: "#2a2a2a",
              color: historyIndex === 0 ? "#555" : "#fff",
              border: "1px solid #444",
              padding: "6px 10px",
              fontSize: "12px",
              cursor: historyIndex === 0 ? "not-allowed" : "pointer"
            }}
            title="Undo (Ctrl+Z)"
          >
            ↩️ UNDO
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            style={{
              background: "#2a2a2a",
              color: historyIndex >= history.length - 1 ? "#555" : "#fff",
              border: "1px solid #444",
              padding: "6px 10px",
              fontSize: "12px",
              cursor: historyIndex >= history.length - 1 ? "not-allowed" : "pointer"
            }}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪️ REDO
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: "#2a2a2a",
              color: "#ff6b8b",
              border: "1px solid #ff6b8b",
              padding: "6px 10px",
              fontSize: "11px",
              cursor: "pointer"
            }}
            title="Reset edits"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          minHeight: "400px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center"
        }}
      >
        {imageLoading && (
          <div style={{ color: "#f4c300", fontFamily: "Anton", fontSize: "20px" }}>
            LOADING IMAGE FOR EDITING...
          </div>
        )}

        {loadError && (
          <div style={{ color: "#ff4d4d", background: "#221111", padding: "16px", border: "2px solid #ff4d4d" }}>
            <p style={{ fontWeight: "bold" }}>{loadError}</p>
            <p style={{ fontSize: "12px", marginTop: "6px" }}>
              Make sure R2 media assets have CORS enabled for this domain.
            </p>
          </div>
        )}

        {!imageLoading && !loadError && imageObj && !previewBlobUrl && (
          <KonvaCanvas
            image={imageObj}
            editorState={editorState}
            activeTool={activeTool}
            brushColor={brushColor}
            brushSize={brushSize}
            onUpdateState={updateState}
            containerWidth={containerDim.width}
            containerHeight={containerDim.height}
          />
        )}

        {/* Pure Preview Mode */}
        {previewBlobUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <img
              src={previewBlobUrl}
              alt="Export preview"
              style={{
                maxWidth: "100%",
                maxHeight: "calc(100vh - 220px)",
                border: "2px solid #34C759",
                boxShadow: "0 0 20px rgba(52, 199, 89, 0.4)"
              }}
            />
            <span style={{ fontSize: "12px", color: "#34C759", background: "#112211", padding: "4px 10px" }}>
              ✓ LIVE EXPORT PREVIEW (True modified pixels at source resolution)
            </span>
          </div>
        )}
      </div>

      {/* Bottom Footer Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#181818",
          border: "2px solid #333",
          padding: "12px 16px",
          marginTop: "10px"
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleTogglePreview}
            style={{
              background: previewBlobUrl ? "#34C759" : "#222",
              color: previewBlobUrl ? "#000" : "#fff",
              border: `2px solid ${previewBlobUrl ? "#fff" : "#555"}`,
              padding: "8px 16px",
              fontFamily: "Anton",
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            {previewBlobUrl ? "✏️ BACK TO EDITING" : "👁️ PREVIEW EXPORT"}
          </button>
          <span style={{ fontSize: "11px", color: "#888" }}>
            {editorState.blurRegions.length} blur/mosaic • {editorState.lines.length} strokes • {editorState.shapes.length} shapes • {editorState.texts.length} texts
          </span>
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#222",
              border: "1px solid #555",
              color: "#aaa",
              padding: "10px 18px",
              fontFamily: "Anton",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            CANCEL
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: isSaving ? "#666" : "#34C759",
              color: "#000",
              border: "2px solid #fff",
              boxShadow: "3px 3px 0px #fff",
              padding: "10px 24px",
              fontFamily: "Anton",
              fontSize: "15px",
              letterSpacing: "0.5px",
              cursor: isSaving ? "not-allowed" : "pointer"
            }}
          >
            {isSaving ? "SAVING MEDIA..." : "💾 SAVE CANONICAL REVISION"}
          </button>
        </div>
      </div>
    </div>
  );
}
