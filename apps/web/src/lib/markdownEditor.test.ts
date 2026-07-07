import { describe, expect, test } from "bun:test";

describe("markdownEditor helpers", () => {
  test("wraps the current selection", async () => {
    const { wrapSelection } = await import("./markdownEditor");
    const result = wrapSelection("hello world", 6, 11, "**", "**");
    expect(result.value).toBe("hello **world**");
    expect(result.selectionStart).toBe(8);
    expect(result.selectionEnd).toBe(13);
  });

  test("prefixes list lines", async () => {
    const { prefixLines } = await import("./markdownEditor");
    const result = prefixLines("one\ntwo", 0, 7, "- ");
    expect(result.value).toBe("- one\n- two");
  });
});
