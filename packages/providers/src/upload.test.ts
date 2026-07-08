import { describe, expect, test } from "bun:test";
import {
  assertNonEmptyUpload,
  inferImageContentTypeFromUrl,
  signedUploadHeaders,
} from "./upload";

describe("provider upload helpers", () => {
  test("assertNonEmptyUpload rejects empty buffers", () => {
    expect(() => assertNonEmptyUpload(Buffer.alloc(0), "photo.png")).toThrow(
      "Cannot upload empty file: photo.png",
    );
    expect(assertNonEmptyUpload(Buffer.from("x"), "photo.png").length).toBe(1);
  });

  test("signedUploadHeaders normalizes content-type for GCS uploads", () => {
    const headers = signedUploadHeaders(
      [
        { key: "content-type", value: "image/png" },
        { key: "x-goog-content-length-range", value: "1,100" },
      ],
      "image/jpeg",
    );
    expect(headers["Content-Type"]).toBe("image/png");
    expect(headers["content-type"]).toBeUndefined();
    expect(headers["x-goog-content-length-range"]).toBe("1,100");
  });
});

describe("inferImageContentTypeFromUrl", () => {
  test("infers from file extension", () => {
    expect(inferImageContentTypeFromUrl("https://example.com/a.webp")).toBe(
      "image/webp",
    );
  });

  test("infers github user-attachments without extension", () => {
    expect(
      inferImageContentTypeFromUrl(
        "https://github.com/user-attachments/assets/abc-123",
      ),
    ).toBe("image/png");
  });

  test("infers linear upload host without extension", () => {
    expect(
      inferImageContentTypeFromUrl("https://uploads.linear.app/abc/file"),
    ).toBe("image/png");
  });
});
