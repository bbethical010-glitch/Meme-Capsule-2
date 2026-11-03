import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Line as KonvaLine,
  Rect as KonvaRect,
  Circle as KonvaCircle,
  Text as KonvaText,
  Transformer,
  Group
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";
import type {
  BlurRegion,
  CropRect,
  DrawLine,
  EditorState,
  EditorTool,
  ShapeAnnotation,
  TextAnnotation
} from "./imageEditorTypes";

interface KonvaCanvasProps {
  image: HTMLImageElement;
  editorState: EditorState;
  activeTool: EditorTool;
  brushColor: string;
  brushSize: number;
  onUpdateState: (updater: (prev: EditorState) => EditorState) => void;
  containerWidth: number;
  containerHeight: number;
}

export const KonvaCanvas: React.FC<KonvaCanvasProps> = ({
  image,
  editorState,
  activeTool,
  brushColor,
  brushSize,
  onUpdateState,
  containerWidth,
  containerHeight
}) => {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const isDrawingRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const origW = image.naturalWidth || image.width;
  const origH = image.naturalHeight || image.height;

  const normRot = ((editorState.rotation % 360) + 360) % 360;
  const isRotated90or270 = normRot === 90 || normRot === 270;
  const rotW = isRotated90or270 ? origH : origW;
  const rotH = isRotated90or270 ? origW : origH;

  // Scale stage to fit container
  const padding = 20;
  const maxW = Math.max(300, containerWidth - padding * 2);
  const maxH = Math.max(300, containerHeight - padding * 2);

  const scale = Math.min(maxW / rotW, maxH / rotH, 1.5);
  const stageWidth = Math.round(rotW * scale);
  const stageHeight = Math.round(rotH * scale);

  // Active shape/selection in progress
  const [inProgressRegion, setInProgressRegion] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Attach transformer to selected node
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    if (selectedId && activeTool === "select") {
      const node = stageRef.current.findOne(`#${selectedId}`);
      if (node) {
        transformerRef.current.nodes([node]);
        transformerRef.current.getLayer()?.batchDraw();
        return;
      }
    }
    transformerRef.current.nodes([]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedId, activeTool]);

  const getPointerPos = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    // Map stage pixels back to full original image coordinates
    return {
      x: pos.x / scale,
      y: pos.y / scale
    };
  };

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (activeTool === "select") {
      // Clicked on empty area? Deselect
      if (e.target === e.target.getStage() || e.target.hasName("base-image")) {
        setSelectedId(null);
      }
      return;
    }

    const { x, y } = getPointerPos(e);
    isDrawingRef.current = true;

    if (activeTool === "brush") {
      const newLine: DrawLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: "brush",
        points: [x, y],
        color: brushColor,
        strokeWidth: brushSize / scale
      };
      onUpdateState((prev) => ({ ...prev, lines: [...prev.lines, newLine] }));
    } else if (
      activeTool === "crop" ||
      activeTool === "blur" ||
      activeTool === "mosaic" ||
      activeTool === "rectangle" ||
      activeTool === "circle"
    ) {
      setInProgressRegion({ startX: x, startY: y, currentX: x, currentY: y });
    } else if (activeTool === "text") {
      const promptText = window.prompt("Enter caption text:", "Meme text here");
      if (promptText && promptText.trim()) {
        const newText: TextAnnotation = {
          id: `text-${Date.now()}`,
          text: promptText.trim(),
          x,
          y,
          fontSize: Math.round(28 / scale),
          fill: brushColor || "#FFFFFF",
          fontFamily: "Oswald, Anton, sans-serif",
          stroke: "#000000",
          strokeWidth: Math.round(2 / scale)
        };
        onUpdateState((prev) => ({ ...prev, texts: [...prev.texts, newText] }));
      }
      isDrawingRef.current = false;
    }
  }, [activeTool, brushColor, brushSize, scale, onUpdateState]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!isDrawingRef.current) return;
    const { x, y } = getPointerPos(e);

    if (activeTool === "brush") {
      onUpdateState((prev) => {
        const lines = [...prev.lines];
        if (lines.length === 0) return prev;
        const lastLine = { ...lines[lines.length - 1] };
        lastLine.points = lastLine.points.concat([x, y]);
        lines[lines.length - 1] = lastLine;
        return { ...prev, lines };
      });
    } else if (inProgressRegion) {
      setInProgressRegion((prev) => prev ? { ...prev, currentX: x, currentY: y } : null);
    }
  }, [activeTool, inProgressRegion, onUpdateState]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (inProgressRegion) {
      const x = Math.min(inProgressRegion.startX, inProgressRegion.currentX);
      const y = Math.min(inProgressRegion.startY, inProgressRegion.currentY);
      const w = Math.abs(inProgressRegion.currentX - inProgressRegion.startX);
      const h = Math.abs(inProgressRegion.currentY - inProgressRegion.startY);

      if (w > 5 && h > 5) {
        if (activeTool === "crop") {
          onUpdateState((prev) => ({ ...prev, crop: { x, y, width: w, height: h } }));
        } else if (activeTool === "blur" || activeTool === "mosaic") {
          const newRegion: BlurRegion = {
            id: `blur-${Date.now()}`,
            type: activeTool,
            x,
            y,
            width: w,
            height: h,
            intensity: activeTool === "mosaic" ? 14 : 10
          };
          onUpdateState((prev) => ({ ...prev, blurRegions: [...prev.blurRegions, newRegion] }));
        } else if (activeTool === "rectangle" || activeTool === "circle") {
          const newShape: ShapeAnnotation = {
            id: `shape-${Date.now()}`,
            type: activeTool,
            x,
            y,
            width: w,
            height: h,
            color: brushColor,
            strokeWidth: Math.max(2, brushSize / scale)
          };
          onUpdateState((prev) => ({ ...prev, shapes: [...prev.shapes, newShape] }));
        }
      }
      setInProgressRegion(null);
    }
  }, [activeTool, inProgressRegion, brushColor, brushSize, scale, onUpdateState]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "repeating-conic-gradient(#1a1a1a 0% 25%, #121212 0% 50%) 50% / 20px 20px"
      }}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        style={{
          boxShadow: "0 0 20px rgba(0,0,0,0.8)",
          border: "2px solid #333",
          cursor: activeTool === "select" ? "default" : "crosshair"
        }}
      >
        <Layer>
          {/* 1. Base Image Layer */}
          <Group
            rotation={normRot}
            x={normRot === 90 ? rotW : normRot === 180 ? rotW : 0}
            y={normRot === 180 ? rotH : normRot === 270 ? rotH : 0}
          >
            <KonvaImage
              name="base-image"
              image={image}
              width={origW}
              height={origH}
            />
          </Group>

          {/* 2. Visual Overlays for Blur & Mosaic Regions */}
          {editorState.blurRegions.map((region) => (
            <Group key={region.id}>
              <KonvaRect
                x={region.x}
                y={region.y}
                width={region.width}
                height={region.height}
                fill={region.type === "mosaic" ? "rgba(0, 0, 0, 0.45)" : "rgba(255, 255, 255, 0.35)"}
                stroke={region.type === "mosaic" ? "#f4c300" : "#00f0ff"}
                strokeWidth={2 / scale}
                dash={[4 / scale, 4 / scale]}
              />
              <KonvaText
                x={region.x + 4 / scale}
                y={region.y + 4 / scale}
                text={region.type === "mosaic" ? "⬛ MOSAIC" : "🌫️ BLUR"}
                fontSize={11 / scale}
                fontFamily="Oswald, sans-serif"
                fill="#ffffff"
              />
            </Group>
          ))}

          {/* 3. Shapes */}
          {editorState.shapes.map((s) => (
            <Group key={s.id} id={s.id} onClick={() => setSelectedId(s.id)}>
              {s.type === "rectangle" ? (
                <KonvaRect
                  x={s.x}
                  y={s.y}
                  width={s.width}
                  height={s.height}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                  fill={s.fill}
                  draggable={activeTool === "select"}
                />
              ) : (
                <KonvaCircle
                  x={s.x + s.width / 2}
                  y={s.y + s.height / 2}
                  radius={Math.abs(s.width) / 2}
                  stroke={s.color}
                  strokeWidth={s.strokeWidth}
                  fill={s.fill}
                  draggable={activeTool === "select"}
                />
              )}
            </Group>
          ))}

          {/* 4. Brush Lines */}
          {editorState.lines.map((l) => (
            <KonvaLine
              key={l.id}
              points={l.points}
              stroke={l.color}
              strokeWidth={l.strokeWidth}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}

          {/* 5. Text Annotations */}
          {editorState.texts.map((t) => (
            <KonvaText
              key={t.id}
              id={t.id}
              x={t.x}
              y={t.y}
              text={t.text}
              fontSize={t.fontSize}
              fontFamily={t.fontFamily}
              fill={t.fill}
              stroke={t.stroke}
              strokeWidth={t.strokeWidth}
              draggable={activeTool === "select"}
              onClick={() => setSelectedId(t.id)}
            />
          ))}

          {/* 6. In-Progress Drag Region Preview */}
          {inProgressRegion && (
            <KonvaRect
              x={Math.min(inProgressRegion.startX, inProgressRegion.currentX)}
              y={Math.min(inProgressRegion.startY, inProgressRegion.currentY)}
              width={Math.abs(inProgressRegion.currentX - inProgressRegion.startX)}
              height={Math.abs(inProgressRegion.currentY - inProgressRegion.startY)}
              stroke={activeTool === "crop" ? "#34C759" : activeTool === "mosaic" ? "#f4c300" : "#ff007f"}
              strokeWidth={2 / scale}
              dash={[5 / scale, 5 / scale]}
              fill={activeTool === "crop" ? "rgba(52, 199, 89, 0.15)" : "rgba(255, 255, 255, 0.1)"}
            />
          )}

          {/* 7. Active Crop Overlay (if applied) */}
          {editorState.crop && (
            <Group>
              <KonvaRect
                x={editorState.crop.x}
                y={editorState.crop.y}
                width={editorState.crop.width}
                height={editorState.crop.height}
                stroke="#34C759"
                strokeWidth={3 / scale}
                dash={[6 / scale, 4 / scale]}
              />
              <KonvaText
                x={editorState.crop.x + 6 / scale}
                y={editorState.crop.y + 6 / scale}
                text={`✂️ CROP (${Math.round(editorState.crop.width)}x${Math.round(editorState.crop.height)})`}
                fontSize={12 / scale}
                fontFamily="Oswald, sans-serif"
                fill="#34C759"
              />
            </Group>
          )}

          {/* Transformer for Selection Tool */}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
};

