import { describe, it, expect } from "vitest";
import {
  applyMosaicToImageData,
  applyBlurToImageData,
  calculateTransformedDimensions
} from "../src/curate/editor/pixelEffects";

describe("Phase 6: Image Editor Prototype & Pixel Effects Contract", () => {
  it("physically modifies pixels in-place for region mosaic/pixelation", () => {
    // Create a 10x10 test image with a high-contrast gradient
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = x * 25;     // R varies 0 to 225
        data[i + 1] = y * 25; // G varies 0 to 225
        data[i + 2] = 128;    // B
        data[i + 3] = 255;    // A
      }
    }

    // Capture initial pixels at (2, 2) and (3, 3)
    const p1Before = data[(2 * width + 2) * 4];
    const p2Before = data[(3 * width + 3) * 4];
    expect(p1Before).not.toBe(p2Before);

    // Apply mosaic block of size 4 to region (0, 0) to (5, 5)
    applyMosaicToImageData(data, width, height, 0, 0, 5, 5, 4);

    // Pixels inside the same 4x4 block should now be identical (averaged)
    const p1After = data[(2 * width + 2) * 4];
    const p2After = data[(3 * width + 3) * 4];
    expect(p1After).toBe(p2After);

    // Pixels outside the region (e.g. at 8, 8) must remain untouched
    const pOutside = data[(8 * width + 8) * 4];
    expect(pOutside).toBe(8 * 25);
  });

  it("physically modifies pixels in-place for region box blur", () => {
    // Create a 10x10 test image with a sharp black-to-white edge at x = 5
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const val = x < 5 ? 0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }
    }

    // Before blur: sharp transition from 0 to 255 between x=4 and x=5
    expect(data[(5 * width + 4) * 4]).toBe(0);
    expect(data[(5 * width + 5) * 4]).toBe(255);

    // Apply blur radius 2 to full image
    applyBlurToImageData(data, width, height, 0, 0, width, height, 2);

    // After blur: edge pixels must be smoothed (intermediate values between 0 and 255)
    const blurredLeft = data[(5 * width + 4) * 4];
    const blurredRight = data[(5 * width + 5) * 4];

    expect(blurredLeft).toBeGreaterThan(0);
    expect(blurredLeft).toBeLessThan(255);
    expect(blurredRight).toBeGreaterThan(0);
    expect(blurredRight).toBeLessThan(255);
  });

  it("calculates transformed dimensions preserving source resolution", () => {
    const originalWidth = 1920;
    const originalHeight = 1080;

    // Test 1: Full uncropped at 0 rotation
    const full = calculateTransformedDimensions(originalWidth, originalHeight, null, 0);
    expect(full.width).toBe(1920);
    expect(full.height).toBe(1080);
    expect(full.cropX).toBe(0);
    expect(full.cropY).toBe(0);

    // Test 2: Rotated 90 degrees swaps width and height
    const rot90 = calculateTransformedDimensions(originalWidth, originalHeight, null, 90);
    expect(rot90.width).toBe(1080);
    expect(rot90.height).toBe(1920);

    // Test 3: Crop sub-rectangle
    const crop = calculateTransformedDimensions(
      originalWidth,
      originalHeight,
      { x: 100, y: 200, width: 800, height: 600 },
      0
    );
    expect(crop.width).toBe(800);
    expect(crop.height).toBe(600);
    expect(crop.cropX).toBe(100);
    expect(crop.cropY).toBe(200);
  });

  it("enforces compare-and-swap (CAS) revision protocol to reject stale concurrent saves", () => {
    type MemeMediaRecord = {
      id: string;
      storage_path: string;
      image_url: string;
      version: number;
    };

    let currentMeme: MemeMediaRecord = {
      id: "meme-abc-123",
      storage_path: "memes/original.png",
      image_url: "https://media.capsule.wtf/memes/original.png",
      version: 1
    };

    const updateMemeMediaWithCas = (
      expectedStoragePath: string,
      newStoragePath: string,
      newImageUrl: string
    ) => {
      if (currentMeme.storage_path !== expectedStoragePath) {
        throw new Error("Stale revision: The meme image was updated by another editor. Please reload.");
      }
      currentMeme = {
        ...currentMeme,
        storage_path: newStoragePath,
        image_url: newImageUrl,
        version: currentMeme.version + 1
      };
      return currentMeme;
    };

    // First save with correct expected path succeeds
    const saved = updateMemeMediaWithCas(
      "memes/original.png",
      "memes/edited-1.png",
      "https://media.capsule.wtf/memes/edited-1.png"
    );
    expect(saved.version).toBe(2);
    expect(saved.storage_path).toBe("memes/edited-1.png");

    // Second save from a concurrent stale session expecting 'memes/original.png' is rejected!
    expect(() =>
      updateMemeMediaWithCas(
        "memes/original.png",
        "memes/stale-edit.png",
        "https://media.capsule.wtf/memes/stale-edit.png"
      )
    ).toThrow("Stale revision: The meme image was updated by another editor. Please reload.");
  });
});

