import { DEFAULT_IMAP_POLL_OVERLAP_HOURS } from "@servicebeard/shared";
import { describe, expect, test } from "bun:test";
import { advanceImapIngestedThrough, computeImapPollSince } from "./inbound";

const DEFAULT_IMAP_POLL_OVERLAP_MS =
  DEFAULT_IMAP_POLL_OVERLAP_HOURS * 60 * 60 * 1000;

describe("imap poll watermark", () => {
  const projectCreatedAt = new Date("2026-06-01T10:00:00Z");

  test("starts from project creation when no watermark exists", () => {
    expect(computeImapPollSince(projectCreatedAt, null)).toEqual(
      projectCreatedAt,
    );
  });

  test("searches from watermark minus overlap", () => {
    const watermark = new Date("2026-06-10T12:00:00Z");
    expect(computeImapPollSince(projectCreatedAt, watermark)).toEqual(
      new Date(watermark.getTime() - DEFAULT_IMAP_POLL_OVERLAP_MS),
    );
  });

  test("never searches before project creation", () => {
    const watermark = new Date("2026-06-02T08:00:00Z");
    expect(computeImapPollSince(projectCreatedAt, watermark)).toEqual(
      projectCreatedAt,
    );
  });

  test("advances watermark to latest scanned internal date", () => {
    const current = new Date("2026-06-05T10:00:00Z");
    const scanned = new Date("2026-06-06T10:00:00Z");
    expect(advanceImapIngestedThrough(current, scanned)).toEqual(scanned);
  });

  test("keeps watermark when scan found nothing new", () => {
    const current = new Date("2026-06-06T10:00:00Z");
    expect(advanceImapIngestedThrough(current, null)).toEqual(current);
  });
});
