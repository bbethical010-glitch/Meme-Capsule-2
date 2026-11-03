import type { EditorState } from "./imageEditorTypes";
import {
  applyBlurToImageData,
  applyMosaicToImageData,
  calculateTransformedDimensions
} from "./pixelEffects";

/**
 * Renders the entire editor state onto a full-resolution offscreen canvas
 * preserving the original image's native resolution.
 */
export async function exportEditorToBlob(
  sourceImage: HTMLImageElement,
  state: EditorState,
  quality: number = 0.92
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  const origW = sourceImage.naturalWidth || sourceImage.width;
  const origH = sourceImage.naturalHeight || sourceImage.height;

  const { rotation, crop, blurRegions, lines, shapes, texts } = state;
  const normRot = ((rotation % 360) + 360) % 360;
  const isRotated90or270 = normRot === 90 || normRot === 270;

  // 1. Offscreen canvas for rotated full-res base image
  const rotW = isRotated90or270 ? origH : origW;
  const rotH = isRotated90or270 ? origW : origH;

  const canvas = document.createElement("canvas");
  canvas.width = rotW;
  canvas.height = rotH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Could not obtain offscreen canvas context");

  // 2. Apply rotation & draw source image
  ctx.save();
  if (normRot === 90) {
    ctx.translate(rotW, 0);
    ctx.rotate(Math.PI / 2);
  } else if (normRot === 180) {
    ctx.translate(rotW, rotH);
    ctx.rotate(Math.PI);
  } else if (normRot === 270) {
    ctx.translate(0, rotH);
    ctx.rotate((3 * Math.PI) / 2);
  }
  ctx.drawImage(sourceImage, 0, 0, origW, origH);
  ctx.restore();

  // 3. Apply region blur & mosaic effects directly to physical pixels
  if (blurRegions.length > 0) {
    const imgData = ctx.getImageData(0, 0, rotW, rotH);
    for (const region of blurRegions) {
      if (region.type === "mosaic") {
        applyMosaicToImageData(
          imgData.data,
          rotW,
          rotH,
          region.x,
          region.y,
          region.width,
          region.height,
          region.intensity || 14
        );
      } else if (region.type === "blur") {
        applyBlurToImageData(
          imgData.data,
          rotW,
          rotH,
          region.x,
          region.y,
          region.width,
          region.height,
          region.intensity || 10
        );
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 4. Draw shapes
  for (const s of shapes) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.strokeWidth;
    if (s.fill) ctx.fillStyle = s.fill;

    if (s.type === "rectangle") {
      if (s.fill) ctx.fillRect(s.x, s.y, s.width, s.height);
      ctx.strokeRect(s.x, s.y, s.width, s.height);
    } else if (s.type === "circle") {
      ctx.beginPath();
      const radiusX = Math.abs(s.width) / 2;
      const radiusY = Math.abs(s.height) / 2;
      const centerX = s.x + radiusX;
      const centerY = s.y + radiusY;
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
      if (s.fill) ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 5. Draw brush lines
  for (const line of lines) {
    if (line.points.length < 4) continue;
    ctx.save();
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(line.points[0], line.points[1]);
    for (let i = 2; i < line.points.length; i += 2) {
      ctx.lineTo(line.points[i], line.points[i + 1]);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 6. Draw text annotations
  for (const t of texts) {
    ctx.save();
    ctx.font = `bold ${t.fontSize}px ${t.fontFamily || "Oswald, sans-serif"}`;
    ctx.fillStyle = t.fill || "#FFFFFF";
    if (t.stroke && t.strokeWidth) {
      ctx.strokeStyle = t.stroke;
      ctx.lineWidth = t.strokeWidth;
      ctx.strokeText(t.text, t.x, t.y);
    }
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }

  // 7. Perform cropping if crop rectangle is set
  const dims = calculateTransformedDimensions(origW, origH, crop, rotation);

  let finalCanvas = canvas;
  if (crop) {
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = dims.width;
    croppedCanvas.height = dims.height;
    const cCtx = croppedCanvas.getContext("2d");
    if (!cCtx) throw new Error("Could not obtain cropped context");

    cCtx.drawImage(
      canvas,
      dims.cropX,
      dims.cropY,
      dims.cropW,
      dims.cropH,
      0,
      0,
      dims.width,
      dims.height
    );
    finalCanvas = croppedCanvas;
  }

  // 8. Export to Blob (prefer image/webp, fallback image/png)
  const mimeType = "image/webp";
  const blob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to serialize canvas to Blob"));
      },
      mimeType,
      quality
    );
  });

  return {
    blob,
    width: dims.width,
    height: dims.height,
    mimeType
  };
}

