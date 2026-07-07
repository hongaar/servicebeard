import { describe, expect, test } from "bun:test";

describe("provider upload helpers", () => {
  test("assertNonEmptyUpload rejects empty buffers", async () => {
    const { assertNonEmptyUpload } = await import("./upload");
    expect(() => assertNonEmptyUpload(Buffer.alloc(0), "photo.png")).toThrow(
      "Cannot upload empty file: photo.png",
    );
    expect(assertNonEmptyUpload(Buffer.from("x"), "photo.png").length).toBe(1);
  });

  test("signedUploadHeaders normalizes content-type for GCS uploads", async () => {
    const { signedUploadHeaders } = await import("./upload");
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
