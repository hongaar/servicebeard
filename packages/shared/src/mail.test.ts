import { describe, expect, test } from "bun:test";

describe("stripQuotedReply", () => {
  test("removes On ... wrote blocks", async () => {
    const { stripQuotedReply } = await import("@servicebeard/shared");
    expect(
      stripQuotedReply("Hello\n\nOn Mon, Jun 1, 2026, Jane wrote:\n> old"),
    ).toBe("Hello");
  });

  test("removes outlook original message blocks", async () => {
    const { stripQuotedReply } = await import("@servicebeard/shared");
    expect(
      stripQuotedReply("Thanks\n\n-----Original Message-----\nFrom: a@b.com"),
    ).toBe("Thanks");
  });

  test("removes Dutch reply attribution lines", async () => {
    const { stripQuotedReply } = await import("@servicebeard/shared");
    expect(
      stripQuotedReply(
        "nog een plaintext antwoord!\n\nsupport@mail.test schreef op 2026-07-10 14:19:\n\n> quoted",
      ),
    ).toBe("nog een plaintext antwoord!");
  });

  test("removes attribution when quote body is empty", async () => {
    const { stripQuotedReply } = await import("@servicebeard/shared");
    expect(
      stripQuotedReply(
        "dat is leuk, een antwoord!\n\nsupport@mail.test schreef op 2026-07-10 14:19:",
      ),
    ).toBe("dat is leuk, een antwoord!");
  });

  test("prefers cleaner plain text over html-derived markdown", async () => {
    const { pickStrippedReplyBody } = await import("@servicebeard/shared");
    const plain =
      "nog een plaintext antwoord!\n\nsupport@mail.test schreef op 2026-07-10 14:19:\n\n> quoted";
    const markdown =
      "nog een plaintext antwoord!\n\nTest team · gh-test\n\noh hi there!\n\nReply from Joram";

    expect(pickStrippedReplyBody(markdown, plain)).toBe(
      "nog een plaintext antwoord!",
    );
  });
});

describe("mail from validation", () => {
  test("accepts localhost addresses", async () => {
    const { isValidMailFrom } = await import("@servicebeard/shared");
    expect(isValidMailFrom("support@localhost")).toBe(true);
    expect(isValidMailFrom("Support <support@localhost>")).toBe(true);
  });

  test("rejects invalid from values", async () => {
    const { isValidMailFrom } = await import("@servicebeard/shared");
    expect(isValidMailFrom("not-an-email")).toBe(false);
    expect(isValidMailFrom("missing <angle>")).toBe(false);
  });

  test("parses address from display name format", async () => {
    const { parseMailFromAddress } = await import("@servicebeard/shared");
    expect(parseMailFromAddress("Support <support@mail.test>")).toBe(
      "support@mail.test",
    );
    expect(parseMailFromAddress("support@mail.test")).toBe("support@mail.test");
  });

  test("parses and formats display name", async () => {
    const { formatMailFrom, parseMailFromName } =
      await import("@servicebeard/shared");
    expect(parseMailFromName("Support <support@mail.test>")).toBe("Support");
    expect(parseMailFromName("support@mail.test")).toBeNull();
    expect(formatMailFrom("support@mail.test", "Support")).toBe(
      "Support <support@mail.test>",
    );
    expect(formatMailFrom("support@mail.test", "")).toBe("support@mail.test");
  });
});

describe("email threading helpers", () => {
  test("normalizes message IDs to angle-bracket form", async () => {
    const { normalizeMessageId } = await import("@servicebeard/shared");
    expect(normalizeMessageId("abc@mail.test")).toBe("<abc@mail.test>");
    expect(normalizeMessageId("<abc@mail.test>")).toBe("<abc@mail.test>");
  });

  test("builds references chain with parent message", async () => {
    const { buildReferencesChain } = await import("@servicebeard/shared");
    expect(buildReferencesChain(["<a@x>"], "<b@x>")).toEqual([
      "<a@x>",
      "<b@x>",
    ]);
    expect(buildReferencesChain(["<b@x>"], "<b@x>")).toEqual(["<b@x>"]);
  });

  test("resolves inbound sender from Reply-To", async () => {
    const { resolveInboundSender } = await import("@servicebeard/shared");
    expect(
      resolveInboundSender(
        "noreply@servicebeard.app",
        "ServiceBeard",
        "jane@example.com",
        "Jane",
      ),
    ).toEqual({ email: "jane@example.com", name: "Jane" });
    expect(
      resolveInboundSender("customer@mail.test", "Customer", null, null),
    ).toEqual({ email: "customer@mail.test", name: "Customer" });
  });

  test("formats quoted reply body", async () => {
    const { formatQuotedReply } = await import("@servicebeard/shared");
    const body = formatQuotedReply("Thanks for your message.", {
      fromName: "Jane",
      fromEmail: "jane@example.com",
      date: new Date("2026-06-01T10:00:00Z"),
      body: "Help needed",
    });
    expect(body).toContain("Thanks for your message.");
    expect(body).toContain("Jane <jane@example.com> wrote:");
    expect(body).toContain("> Help needed");
  });

  test("resolves support mailbox cc", async () => {
    const { supportMailboxCc } = await import("@servicebeard/shared");
    expect(supportMailboxCc("support@mail.test", "customer@mail.test")).toBe(
      "support@mail.test",
    );
    expect(
      supportMailboxCc("support@mail.test", "support@mail.test"),
    ).toBeUndefined();
  });
});

describe("splitReplyAndQuote", () => {
  test("splits styled email reply from quote section", async () => {
    const { splitReplyAndQuote } = await import("@servicebeard/shared");
    const result = splitReplyAndQuote("New reply only", {
      fromName: "Support",
      fromEmail: "support@mail.test",
      date: new Date("2026-06-01T10:00:00Z"),
      body: "Previous message content",
    });
    expect(result.replyText).toBe("New reply only");
    expect(result.quotedText).toContain("Support <support@mail.test> wrote:");
  });
});
