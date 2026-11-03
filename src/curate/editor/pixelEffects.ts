import type { CropRect } from "./imageEditorTypes";

/**
 * Applies a mosaic / pixelation effect directly to the ImageData buffer
 * within the specified bounding rectangle.
 * Modifies pixels in-place so canvas exports contain real transformed pixels.
 */
export function applyMosaicToImageData(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  blockSize: number = 12
): void {
  const startX = Math.max(0, Math.floor(rx));
  const startY = Math.max(0, Math.floor(ry));
  const endX = Math.min(imageWidth, Math.ceil(rx + rw));
  const endY = Math.min(imageHeight, Math.ceil(ry + rh));
  const size = Math.max(2, Math.floor(blockSize));

  for (let y = startY; y < endY; y += size) {
    for (let x = startX; x < endX; x += size) {
      const blockW = Math.min(size, endX - x);
      const blockH = Math.min(size, endY - y);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let count = 0;

      // 1. Calculate average RGBA for block
      for (let by = 0; by < blockH; by++) {
        for (let bx = 0; bx < blockW; bx++) {
          const px = (y + by) * imageWidth + (x + bx);
          const i = px * 4;
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
          aSum += data[i + 3];
          count++;
        }
      }

      if (count === 0) continue;
      const avgR = Math.round(rSum / count);
      const avgG = Math.round(gSum / count);
      const avgB = Math.round(bSum / count);
      const avgA = Math.round(aSum / count);

      // 2. Fill block with average RGBA
      for (let by = 0; by < blockH; by++) {
        for (let bx = 0; bx < blockW; bx++) {
          const px = (y + by) * imageWidth + (x + bx);
          const i = px * 4;
          data[i] = avgR;
          data[i + 1] = avgG;
          data[i + 2] = avgB;
          data[i + 3] = avgA;
        }
      }
    }
  }
}

/**
 * Fast separable box blur on the specified sub-rectangle of ImageData.
 * Modifies pixel values in-place so exported media has real blurred pixels.
 */
export function applyBlurToImageData(
  data: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  radius: number = 8
): void {
  const startX = Math.max(0, Math.floor(rx));
  const startY = Math.max(0, Math.floor(ry));
  const endX = Math.min(imageWidth, Math.ceil(rx + rw));
  const endY = Math.min(imageHeight, Math.ceil(ry + rh));
  const r = Math.max(1, Math.min(50, Math.floor(radius)));
  const width = endX - startX;
  const height = endY - startY;

  if (width <= 0 || height <= 0) return;

  // Extract region into a working buffer
  const buffer = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = ((startY + y) * imageWidth + (startX + x)) * 4;
      const dstIdx = (y * width + x) * 4;
      buffer[dstIdx] = data[srcIdx];
      buffer[dstIdx + 1] = data[srcIdx + 1];
      buffer[dstIdx + 2] = data[srcIdx + 2];
      buffer[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  const temp = new Uint8ClampedArray(buffer.length);

  // Horizontal 1D box blur pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let hits = 0;

      for (let k = -r; k <= r; k++) {
        const nx = x + k;
        if (nx >= 0 && nx < width) {
          const idx = (y * width + nx) * 4;
          rSum += buffer[idx];
          gSum += buffer[idx + 1];
          bSum += buffer[idx + 2];
          aSum += buffer[idx + 3];
          hits++;
        }
      }

      const outIdx = (y * width + x) * 4;
      temp[outIdx] = Math.round(rSum / hits);
      temp[outIdx + 1] = Math.round(gSum / hits);
      temp[outIdx + 2] = Math.round(bSum / hits);
      temp[outIdx + 3] = Math.round(aSum / hits);
    }
  }

  // Vertical 1D box blur pass & write back to target data
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let hits = 0;

      for (let k = -r; k <= r; k++) {
        const ny = y + k;
        if (ny >= 0 && ny < height) {
          const idx = (ny * width + x) * 4;
          rSum += temp[idx];
          gSum += temp[idx + 1];
          bSum += temp[idx + 2];
          aSum += temp[idx + 3];
          hits++;
        }
      }

      const dstIdx = ((startY + y) * imageWidth + (startX + x)) * 4;
      data[dstIdx] = Math.round(rSum / hits);
      data[dstIdx + 1] = Math.round(gSum / hits);
      data[dstIdx + 2] = Math.round(bSum / hits);
      data[dstIdx + 3] = Math.round(aSum / hits);
    }
  }
}

/**
 * Calculates transformed source bounds after crop and rotation.
 * Ensures export maintains intended source pixel resolution.
 */
export function calculateTransformedDimensions(
  originalWidth: number,
  originalHeight: number,
  crop: CropRect | null,
  rotationDegrees: number
): { width: number; height: number; cropX: number; cropY: number; cropW: number; cropH: number } {
  const normRot = ((rotationDegrees % 360) + 360) % 360;
  const isRotated90or270 = normRot === 90 || normRot === 270;

  const currentW = isRotated90or270 ? originalHeight : originalWidth;
  const currentH = isRotated90or270 ? originalWidth : originalHeight;

  const cropX = crop ? Math.max(0, Math.min(currentW - 1, crop.x)) : 0;
  const cropY = crop ? Math.max(0, Math.min(currentH - 1, crop.y)) : 0;
  const cropW = crop ? Math.max(1, Math.min(currentW - cropX, crop.width)) : currentW;
  const cropH = crop ? Math.max(1, Math.min(currentH - cropY, crop.height)) : currentH;

  return {
    width: Math.round(cropW),
    height: Math.round(cropH),
    cropX: Math.round(cropX),
    cropY: Math.round(cropY),
    cropW: Math.round(cropW),
    cropH: Math.round(cropH)
  };
}

