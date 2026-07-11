import { describe, expect, test } from "bun:test";
import { coerceDate } from "./dates";

describe("coerceDate", () => {
  test("returns Date instances unchanged", () => {
    const date = new Date("2026-07-11T18:57:57.821Z");
    expect(coerceDate(date)).toBe(date);
  });

  test("parses ISO strings from queue job JSON", () => {
    const iso = "2026-07-11T18:57:57.821Z";
    const date = coerceDate(iso);
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe(iso);
  });
});
