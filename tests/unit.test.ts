import type { ParsedEmail, Rule } from "@serviceboard/shared";
import { evaluateRules, normalizeSubject } from "@serviceboard/shared";
import { beforeAll, describe, expect, test } from "bun:test";
import { isEmailEligibleForInboundSync } from "../apps/worker/src/services/inbound";
import { formatCommentBody, formatIssueDescription } from "../apps/worker/src/services/rules";

const testEmailDate = new Date("2026-01-15T12:00:00Z");

function testEmail(
  overrides: Omit<ParsedEmail, "bodyMarkdown" | "bodyHtml" | "inlineImages"> & {
    bodyMarkdown?: string;
    bodyHtml?: string | null;
    inlineImages?: ParsedEmail["inlineImages"];
  },
): ParsedEmail {
  return {
    bodyMarkdown: overrides.bodyMarkdown ?? overrides.body,
    bodyHtml: overrides.bodyHtml ?? null,
    inlineImages: overrides.inlineImages ?? [],
    ...overrides,
  };
}

const baseRule: Rule = {
  id: "1",
  projectId: "p1",
  name: "Support",
  priority: 0,
  isEnabled: true,
  matchSender: "support@example.com",
  matchSubject: null,
  matchBody: null,
  actionCreateIssue: true,
  actionStatus: null,
  actionLabels: ["support"],
  actionAssigneeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("rules engine", () => {
  test("matches sender pattern", () => {
    const result = evaluateRules([baseRule], testEmail({
      messageId: "m1",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "support@example.com",
      fromName: "Support",
      subject: "Help needed",
      body: "Please help",
      date: testEmailDate,
    }));
    expect(result.matched).toBe(true);
    expect(result.rule?.name).toBe("Support");
  });

  test("does not match wrong sender", () => {
    const result = evaluateRules([baseRule], testEmail({
      messageId: "m2",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "other@example.com",
      fromName: null,
      subject: "Help",
      body: "body",
      date: testEmailDate,
    }));
    expect(result.matched).toBe(false);
  });

  test("subject regex match", () => {
    const rule = { ...baseRule, matchSender: null, matchSubject: "urgent", matchBody: null };
    const result = evaluateRules([rule], testEmail({
      messageId: "m3",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "a@b.com",
      fromName: null,
      subject: "URGENT: server down",
      body: "help",
      date: testEmailDate,
    }));
    expect(result.matched).toBe(true);
  });

  test("first matching rule wins by priority", () => {
    const low = { ...baseRule, name: "Low", priority: 10, matchSender: null };
    const high = { ...baseRule, id: "2", name: "High", priority: 0, matchSender: null };
    const result = evaluateRules([low, high], testEmail({
      messageId: "m4",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "a@b.com",
      fromName: null,
      subject: "test",
      body: "test",
      date: testEmailDate,
    }));
    expect(result.rule?.name).toBe("High");
  });

  test("skips disabled rules", () => {
    const disabled = { ...baseRule, isEnabled: false, matchSender: null };
    const result = evaluateRules([disabled], testEmail({
      messageId: "m5",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "a@b.com",
      fromName: null,
      subject: "test",
      body: "test",
      date: testEmailDate,
    }));
    expect(result.matched).toBe(false);
  });
});

describe("issue description formatting", () => {
  test("includes sender header and sync marker", () => {
    const desc = formatIssueDescription(
      testEmail({
        messageId: "<abc@mail.com>",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "user@example.com",
        fromName: "User",
        subject: "Bug report",
        body: "Something broke",
        date: testEmailDate,
      }),
      "thread-123",
    );
    expect(desc).toContain("**Message from User <user@example.com>**");
    expect(desc).toContain("Something broke");
    expect(desc).toContain("<!-- serviceboard-sync:thread-123-->");
    expect(desc).not.toContain("Email metadata");
  });
});

describe("inbound comment formatting", () => {
  test("strips quoted reply history from customer follow-ups", () => {
    const body = `dat is mooi!

On 2026-06-23 22:02, support@mail.test wrote:
> Dit is inderdaad een groot probleem. Gelukkig hebben wij altijd goede
> oplossingen.
>
> ---
> Reply from USERNAME on issue #4
> https://gitlab/support/-/work_items/4`;

    const comment = formatCommentBody(testEmail({
      messageId: "<reply@mail.test>",
      inReplyTo: "<parent@serviceboard.local>",
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "customer@mail.test",
      fromName: "customer",
      subject: "Re: problem",
      body,
      date: testEmailDate,
    }));

    expect(comment).toContain("**Reply from customer <customer@mail.test>**");
    expect(comment).toContain("dat is mooi!");
    expect(comment).not.toContain("On 2026-06-23 22:02");
    expect(comment).not.toContain("groot probleem");
    expect(comment).not.toContain("Reply from USERNAME");
  });

  test("keeps full body when there is no quote marker", () => {
    const comment = formatCommentBody(testEmail({
      messageId: "<m@mail.test>",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "customer@mail.test",
      fromName: null,
      subject: "Help",
      body: "First message with no quotes",
      date: testEmailDate,
    }));

    expect(comment).toContain("First message with no quotes");
    expect(comment).toContain("<!-- serviceboard-sync:email:<m@mail.test>-->");
  });
});

describe("loop prevention markers", () => {
  test("detects serviceboard-sync content", async () => {
    const { buildSyncMarker, isServiceboardSyncedContent } = await import(
      "@serviceboard/shared"
    );
    const marker = buildSyncMarker("email:<m@mail.test>");
    expect(isServiceboardSyncedContent(`Reply text\n\n${marker}`)).toBe(true);
    expect(isServiceboardSyncedContent("Regular agent reply")).toBe(false);
  });
});

describe("email content conversion", () => {
  test("converts html email bodies to markdown", async () => {
    const { htmlToMarkdown, buildParsedEmailContent } = await import(
      "@serviceboard/shared/email-content"
    );
    expect(htmlToMarkdown("<p>Hello <strong>world</strong></p>")).toContain(
      "**world**",
    );

    const content = buildParsedEmailContent(
      false,
      "<p>HTML <em>body</em></p>",
      [],
    );
    expect(content.bodyMarkdown).toContain("*body*");
    expect(content.body).toContain("HTML");
  });

  test("replaces cid image refs in markdown", async () => {
    const { replaceCidImagesInMarkdown } = await import(
      "@serviceboard/shared/email-content"
    );
    const map = new Map([["img001@mail.test", "![logo](/uploads/logo.png)"]]);
    const result = replaceCidImagesInMarkdown(
      "See this: ![logo](cid:img001@mail.test)",
      map,
    );
    expect(result).toBe("See this: ![logo](/uploads/logo.png)");
  });

  test("converts markdown to html for outbound email", async () => {
    const { markdownToHtml, markdownToPlainText } = await import(
      "@serviceboard/shared/email-content"
    );
    const markdown = "Hello **team**\n\n![shot](https://example.com/a.png)";
    expect(markdownToHtml(markdown)).toContain("<strong>team</strong>");
    expect(markdownToPlainText(markdown)).toContain("Hello team");
  });

  test("preserves inline image position with placeholders", async () => {
    const {
      buildParsedEmailContent,
      imagePlaceholder,
      replaceHtmlImagesWithPlaceholders,
      replaceImagePlaceholdersInMarkdown,
    } = await import("@serviceboard/shared/email-content");

    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const html = `<p>hallo,</p><p><img src="cid:img@test" alt="" /></p><p>kennen jullie deze persoon?</p>`;
    const { html: withPlaceholders, slots } =
      replaceHtmlImagesWithPlaceholders(html);

    expect(withPlaceholders).toContain(imagePlaceholder(0));
    expect(slots).toHaveLength(1);
    expect(slots[0]?.contentId).toBe("img@test");

    const content = buildParsedEmailContent(
      "hallo,\n\nkennen jullie deze persoon?",
      html,
      [
        {
          filename: "photo.png",
          contentType: "image/png",
          content: Buffer.from(tinyPng, "base64"),
          cid: "img@test",
        },
      ],
    );

    expect(content.bodyMarkdown).toContain("hallo,");
    expect(content.bodyMarkdown).toContain("kennen jullie deze persoon?");
    expect(content.bodyMarkdown).toContain(imagePlaceholder(0));
    expect(content.bodyMarkdown.indexOf(imagePlaceholder(0))).toBeGreaterThan(
      content.bodyMarkdown.indexOf("hallo,"),
    );
    expect(content.bodyMarkdown.indexOf(imagePlaceholder(0))).toBeLessThan(
      content.bodyMarkdown.indexOf("kennen jullie"),
    );

    const resolved = replaceImagePlaceholdersInMarkdown(content.bodyMarkdown, new Map([
      [imagePlaceholder(0), "![photo](/uploads/abc/photo.png)"],
    ]));
    expect(resolved).toContain("![photo](/uploads/abc/photo.png)");
    expect(resolved.indexOf("![photo]")).toBeGreaterThan(resolved.indexOf("hallo,"));
    expect(resolved.indexOf("![photo]")).toBeLessThan(
      resolved.indexOf("kennen jullie"),
    );
  });

  test("strips data-uri images from html before markdown conversion", async () => {
    const { buildParsedEmailContent, imagePlaceholder } = await import(
      "@serviceboard/shared/email-content"
    );
    const tinyPng =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const content = buildParsedEmailContent(
      false,
      `<p>Look</p><img src="data:image/png;base64,${tinyPng}" alt="dot">`,
      [],
    );

    expect(content.bodyMarkdown).not.toContain("data:image");
    expect(content.bodyMarkdown).toContain(imagePlaceholder(0));
    expect(content.inlineImages).toHaveLength(1);
    expect(content.inlineImages[0]?.contentType).toBe("image/png");
  });

  test("resolves gitlab upload paths to absolute urls", async () => {
    const {
      resolveProviderImageUrl,
      isResolvableImageUrl,
      collectOutboundImageRefs,
      prepareGitLabNoteForOutboundEmail,
    } = await import("@serviceboard/shared/email-content");
    expect(
      resolveProviderImageUrl(
        "/uploads/abc123/photo.jpg",
        "https://gitlab.example.com",
      ),
    ).toBe("https://gitlab.example.com/uploads/abc123/photo.jpg");
    expect(isResolvableImageUrl("/uploads/abc123/photo.jpg", "https://gitlab.example.com")).toBe(
      true,
    );
    expect(isResolvableImageUrl("/uploads/abc123/photo.jpg")).toBe(false);

    const note =
      'oh nice\n\n![Screenshot](/uploads/06a8c6da28f76281b6f75d59bad2859c/Screenshot_2026-06-24_at_15.07.36.png){width=328 height=321}\n\ncan you see it?';
    const prepared = prepareGitLabNoteForOutboundEmail(note);
    expect(prepared).not.toContain("{width=328");
    const images = collectOutboundImageRefs(
      note,
      "https://gitlab.example.com",
    );
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toContain("/uploads/");
  });

  test("parses gitlab upload paths into secret and filename", async () => {
    const { parseGitLabUploadPath } = await import(
      "@serviceboard/shared/email-content"
    );
    expect(
      parseGitLabUploadPath(
        "/uploads/297cf8e52cbd85a440cd6f299ad200c2/emojis.com_toucan-_nose-bird_-emoji.png",
      ),
    ).toEqual({
      secret: "297cf8e52cbd85a440cd6f299ad200c2",
      filename: "emojis.com_toucan-_nose-bird_-emoji.png",
    });
    expect(
      parseGitLabUploadPath(
        "https://gitlab-host/uploads/297cf8e52cbd85a440cd6f299ad200c2/photo.png",
      ),
    ).toEqual({
      secret: "297cf8e52cbd85a440cd6f299ad200c2",
      filename: "photo.png",
    });
  });
});

describe("stripQuotedReply", () => {
  test("removes On ... wrote blocks", async () => {
    const { stripQuotedReply } = await import("@serviceboard/shared");
    expect(
      stripQuotedReply("Hello\n\nOn Mon, Jun 1, 2026, Jane wrote:\n> old"),
    ).toBe("Hello");
  });

  test("removes outlook original message blocks", async () => {
    const { stripQuotedReply } = await import("@serviceboard/shared");
    expect(
      stripQuotedReply("Thanks\n\n-----Original Message-----\nFrom: a@b.com"),
    ).toBe("Thanks");
  });
});

describe("inbound sync window", () => {
  const projectCreatedAt = new Date("2026-06-01T10:00:00Z");

  test("accepts emails sent after project creation", () => {
    expect(
      isEmailEligibleForInboundSync(
        new Date("2026-06-02T08:00:00Z"),
        projectCreatedAt,
      ),
    ).toBe(true);
  });

  test("accepts emails sent at project creation time", () => {
    expect(
      isEmailEligibleForInboundSync(projectCreatedAt, projectCreatedAt),
    ).toBe(true);
  });

  test("rejects emails sent before project creation", () => {
    expect(
      isEmailEligibleForInboundSync(
        new Date("2026-05-31T23:59:59Z"),
        projectCreatedAt,
      ),
    ).toBe(false);
  });
});

describe("mail from validation", () => {
  test("accepts localhost addresses", async () => {
    const { isValidMailFrom } = await import("@serviceboard/shared");
    expect(isValidMailFrom("support@localhost")).toBe(true);
    expect(isValidMailFrom("Support <support@localhost>")).toBe(true);
  });

  test("rejects invalid from values", async () => {
    const { isValidMailFrom } = await import("@serviceboard/shared");
    expect(isValidMailFrom("not-an-email")).toBe(false);
    expect(isValidMailFrom("missing <angle>")).toBe(false);
  });

  test("parses address from display name format", async () => {
    const { parseMailFromAddress } = await import("@serviceboard/shared");
    expect(parseMailFromAddress("Support <support@mail.test>")).toBe(
      "support@mail.test",
    );
    expect(parseMailFromAddress("support@mail.test")).toBe("support@mail.test");
  });
});

describe("email threading helpers", () => {
  test("normalizes message IDs to angle-bracket form", async () => {
    const { normalizeMessageId } = await import("@serviceboard/shared");
    expect(normalizeMessageId("abc@mail.test")).toBe("<abc@mail.test>");
    expect(normalizeMessageId("<abc@mail.test>")).toBe("<abc@mail.test>");
  });

  test("builds references chain with parent message", async () => {
    const { buildReferencesChain } = await import("@serviceboard/shared");
    expect(
      buildReferencesChain(["<a@x>"], "<b@x>"),
    ).toEqual(["<a@x>", "<b@x>"]);
    expect(buildReferencesChain(["<b@x>"], "<b@x>")).toEqual(["<b@x>"]);
  });

  test("formats quoted reply body", async () => {
    const { formatQuotedReply } = await import("@serviceboard/shared");
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
    const { supportMailboxCc } = await import("@serviceboard/shared");
    expect(supportMailboxCc("support@mail.test", "customer@mail.test")).toBe(
      "support@mail.test",
    );
    expect(supportMailboxCc("support@mail.test", "support@mail.test")).toBeUndefined();
  });
});

describe("inbound ack template", () => {
  test("replaces placeholders", async () => {
    const { renderInboundAckTemplate } = await import("@serviceboard/shared");
    const result = renderInboundAckTemplate(
      "Hi {{senderName}}, we got your email about {{subject}}. Issue #{{issueNumber}}: {{issueUrl}}",
      {
        senderName: "Jane",
        senderEmail: "jane@example.com",
        subject: "Help",
        issueNumber: 42,
        issueUrl: "https://gitlab.example.com/issues/42",
      },
    );
    expect(result).toContain("Hi Jane");
    expect(result).toContain("Help");
    expect(result).toContain("#42");
    expect(result).toContain("https://gitlab.example.com/issues/42");
  });

  test("leaves unknown placeholders unchanged", async () => {
    const { renderInboundAckTemplate } = await import("@serviceboard/shared");
    const result = renderInboundAckTemplate("{{unknown}}", {
      senderName: "Jane",
      senderEmail: "jane@example.com",
      subject: "Help",
      issueNumber: 1,
      issueUrl: "https://example.com",
    });
    expect(result).toBe("{{unknown}}");
  });
});

describe("normalizeSubject", () => {
  test("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Hello")).toBe("hello");
    expect(normalizeSubject("Fwd: Test")).toBe("test");
  });
});

describe("validation errors", () => {
  test("formatValidationError maps zod issues to field errors", async () => {
    const { formatValidationError } = await import("@serviceboard/shared");
    const { createProjectSchema } = await import("@serviceboard/shared");
    try {
      createProjectSchema.parse({ name: "", providerToken: "" });
    } catch (err) {
      const formatted = formatValidationError(err as import("zod").ZodError);
      expect(formatted.error).toContain("Validation failed");
      expect(formatted.fieldErrors.name).toBeDefined();
    }
  });

  test("updateProjectSchema strips empty secret fields", async () => {
    const { updateProjectSchema } = await import("@serviceboard/shared");
    const parsed = updateProjectSchema.parse({
      name: "Updated",
      providerToken: "",
      imapPassword: "",
    });
    expect(parsed.name).toBe("Updated");
    expect(parsed).not.toHaveProperty("providerToken");
    expect(parsed).not.toHaveProperty("imapPassword");
  });
});

describe("crypto", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });

  test("encrypt/decrypt roundtrip", async () => {
    const { encrypt, decrypt } = await import("@serviceboard/db");
    const plaintext = "secret-token-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("hashToken is deterministic", async () => {
    const { hashToken } = await import("@serviceboard/db");
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("def"));
  });
});

describe("GitLab webhook parsing", () => {
  test("parses note event", async () => {
    const { GitLabProvider } = await import("@serviceboard/providers");
    const provider = new GitLabProvider({
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "token",
    });

    const event = provider.parseWebhook({
      object_kind: "note",
      object_attributes: {
        id: 42,
        note: "Thanks for the report",
        noteable_type: "Issue",
        internal: false,
        created_at: "2026-01-01T12:00:00Z",
      },
      user: { id: 5, username: "agent", name: "Support Agent" },
      issue: { id: 100, iid: 7 },
    });

    expect(event).not.toBeNull();
    expect(event!.noteId).toBe("42");
    expect(event!.issueIid).toBe(7);
    expect(event!.authorName).toBe("Support Agent");
    expect(event!.authorUsername).toBe("agent");
    expect(event!.internal).toBe(false);
    expect(event!.system).toBe(false);
  });

  test("skips system notes", async () => {
    const { GitLabProvider } = await import("@serviceboard/providers");
    const provider = new GitLabProvider({
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "token",
    });

    const event = provider.parseWebhook({
      object_kind: "note",
      object_attributes: {
        id: 43,
        note: "assigned to @agent",
        noteable_type: "Issue",
        system: true,
        created_at: "2026-01-01T12:00:00Z",
      },
      user: { id: 5, username: "agent", name: "Support Agent" },
      issue: { id: 100, iid: 7 },
    });

    expect(event).toBeNull();
  });

  test("skips non-issue notes", async () => {
    const { GitLabProvider } = await import("@serviceboard/providers");
    const provider = new GitLabProvider({
      baseUrl: "https://gitlab.com",
      projectId: "1",
      token: "token",
    });

    const event = provider.parseWebhook({
      object_kind: "note",
      object_attributes: {
        id: 42,
        noteable_type: "MergeRequest",
      },
    });

    expect(event).toBeNull();
  });
});
