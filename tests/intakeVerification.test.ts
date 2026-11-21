import { describe, it, expect } from "vitest";
import {
  detectMediaMime,
  isExtensionSupported,
  sanitizeFilename,
  ALLOWED_MEDIA,
  MAX_BYTES
} from "../functions/_shared/intake";

describe("Step 3: Intake Media Validation & Sniffing", () => {
  it("Validates MAX_BYTES is exactly 20 MiB", () => {
    expect(MAX_BYTES).toBe(20 * 1024 * 1024);
  });

  it("Validates allowed extensions match specifications", () => {
    expect(isExtensionSupported("test.jpg")).toBe(true);
    expect(isExtensionSupported("test.png")).toBe(true);
    expect(isExtensionSupported("test.webp")).toBe(true);
    expect(isExtensionSupported("test.gif")).toBe(true);
    expect(isExtensionSupported("test.mp4")).toBe(true);
    expect(isExtensionSupported("test.exe")).toBe(false);
    expect(isExtensionSupported("test.php")).toBe(false);
  });

  it("Detects PNG magic bytes", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectMediaMime(pngBytes)).toBe("image/png");
  });

  it("Detects JPEG magic bytes", () => {
    const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(detectMediaMime(jpgBytes)).toBe("image/jpeg");
  });

  it("Detects GIF magic bytes", () => {
    const gifBytes = new TextEncoder().encode("GIF89a...");
    expect(detectMediaMime(gifBytes)).toBe("image/gif");
  });

  it("Detects WebP magic bytes", () => {
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50  // 'WEBP'
    ]);
    expect(detectMediaMime(webpBytes)).toBe("image/webp");
  });

  it("Sanitizes filenames safely", () => {
    expect(sanitizeFilename("My Meme File! #1.PNG")).toBe("my-meme-file-1.png");
    expect(sanitizeFilename("../../etc/passwd.jpg")).toBe("passwd.jpg");
    expect(sanitizeFilename("..\\windows\\cmd.exe")).toBe("cmd.exe");
  });
});
