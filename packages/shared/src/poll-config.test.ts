import { afterEach, describe, expect, test } from "bun:test";
import {
  DEFAULT_IMAP_POLL_OVERLAP_HOURS,
  getImapPollOverlapMs,
} from "./poll-config";

const original = process.env.IMAP_POLL_OVERLAP_HOURS;

afterEach(() => {
  if (original === undefined) {
    delete process.env.IMAP_POLL_OVERLAP_HOURS;
  } else {
    process.env.IMAP_POLL_OVERLAP_HOURS = original;
  }
});

describe("getImapPollOverlapMs", () => {
  test("defaults to 24 hours", () => {
    delete process.env.IMAP_POLL_OVERLAP_HOURS;
    expect(getImapPollOverlapMs()).toBe(
      DEFAULT_IMAP_POLL_OVERLAP_HOURS * 60 * 60 * 1000,
    );
  });

  test("reads IMAP_POLL_OVERLAP_HOURS from env", () => {
    process.env.IMAP_POLL_OVERLAP_HOURS = "4";
    expect(getImapPollOverlapMs()).toBe(4 * 60 * 60 * 1000);
  });

  test("falls back when value is out of range", () => {
    process.env.IMAP_POLL_OVERLAP_HOURS = "0";
    expect(getImapPollOverlapMs()).toBe(
      DEFAULT_IMAP_POLL_OVERLAP_HOURS * 60 * 60 * 1000,
    );

    process.env.IMAP_POLL_OVERLAP_HOURS = "999";
    expect(getImapPollOverlapMs()).toBe(
      DEFAULT_IMAP_POLL_OVERLAP_HOURS * 60 * 60 * 1000,
    );
  });
});
