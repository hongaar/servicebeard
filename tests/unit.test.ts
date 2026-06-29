import type { ParsedEmail, Rule } from "@servicebeard/shared";
import {
    buildThreadMatchIndex,
    DEFAULT_CATCH_ALL_RULE, DEFAULT_INBOUND_COMMENT_TEMPLATE,
    DEFAULT_INBOUND_ISSUE_TEMPLATE,
    emailMatchesExistingThread,
    evaluateRules,
    isEligibleForInboundRuleEvaluation, isEligibleForInboundRulePreview,
    isEmailEligibleForInboundSync,
    normalizeSubject
} from "@servicebeard/shared";
import { beforeAll, describe, expect, test } from "bun:test";
import {
    advanceImapIngestedThrough,
    computeImapPollSince,
    IMAP_POLL_OVERLAP_MS,
} from "../apps/worker/src/services/inbound";
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

  test("default catch-all rule matches any email and runs after specific rules", () => {
    const catchAll: Rule = {
      ...baseRule,
      id: "catch-all",
      name: DEFAULT_CATCH_ALL_RULE.name,
      priority: DEFAULT_CATCH_ALL_RULE.priority,
      matchSender: DEFAULT_CATCH_ALL_RULE.matchSender,
      matchSubject: DEFAULT_CATCH_ALL_RULE.matchSubject,
      matchBody: DEFAULT_CATCH_ALL_RULE.matchBody,
      actionLabels: DEFAULT_CATCH_ALL_RULE.actionLabels,
    };
    const specific = { ...baseRule, id: "2", name: "VIP", priority: 0, matchSender: "vip@example.com" };
    const email = testEmail({
      messageId: "m-catch",
      inReplyTo: null,
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "anyone@example.com",
      fromName: null,
      subject: "Hello",
      body: "Anything",
      date: testEmailDate,
    });

    expect(evaluateRules([catchAll], email).rule?.name).toBe("Catch-all");
    expect(evaluateRules([specific, catchAll], email).rule?.name).toBe("Catch-all");
    expect(
      evaluateRules([specific, catchAll], { ...email, fromEmail: "vip@example.com" }).rule?.name,
    ).toBe("VIP");
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
      DEFAULT_INBOUND_ISSUE_TEMPLATE,
    );
    expect(desc).toContain("**Message from User <user@example.com>**");
    expect(desc).toContain("Something broke");
    expect(desc).toContain("<!-- servicebeard-sync:thread-123-->");
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
      inReplyTo: "<parent@servicebeard.local>",
      references: [],
      toAddresses: [],
      ccAddresses: [],
      bccAddresses: [],
      fromEmail: "customer@mail.test",
      fromName: "customer",
      subject: "Re: problem",
      body,
      date: testEmailDate,
    }), DEFAULT_INBOUND_COMMENT_TEMPLATE);

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
    }), DEFAULT_INBOUND_COMMENT_TEMPLATE);

    expect(comment).toContain("First message with no quotes");
    expect(comment).toContain("<!-- servicebeard-sync:email:<m@mail.test>-->");
  });
});

describe("loop prevention markers", () => {
  test("detects servicebeard-sync content", async () => {
    const { buildSyncMarker, isServicebeardSyncedContent } = await import(
      "@servicebeard/shared"
    );
    const marker = buildSyncMarker("email:<m@mail.test>");
    expect(isServicebeardSyncedContent(`Reply text\n\n${marker}`)).toBe(true);
    expect(isServicebeardSyncedContent("Regular agent reply")).toBe(false);
  });
});

describe("internal comment marker", () => {
  test("detects [internal] at start or end only", async () => {
    const { isServicebeardInternalContent } = await import("@servicebeard/shared");

    expect(isServicebeardInternalContent("[internal] Checking with billing")).toBe(true);
    expect(isServicebeardInternalContent("[INTERNAL] Checking with billing")).toBe(true);
    expect(isServicebeardInternalContent("Need another look [internal]")).toBe(true);
    expect(isServicebeardInternalContent("  [internal]  ")).toBe(true);
    expect(isServicebeardInternalContent("See [internal] docs for details")).toBe(false);
    expect(isServicebeardInternalContent("Regular customer-facing reply")).toBe(false);
  });
});

describe("issue support details footer", () => {
  test("builds collapsible footer with project link", async () => {
    const { buildIssueSupportDetailsFooter } = await import("@servicebeard/shared");

    const footer = buildIssueSupportDetailsFooter({
      webUrl: "https://app.example.com",
      teamId: "team-1",
      projectId: "project-1",
    });

    expect(footer).toContain("<details>");
    expect(footer).toContain("<summary>Support details</summary>");
    expect(footer).toContain("[ServiceBeard](https://app.example.com)");
    expect(footer).toContain(
      "[Open project](https://app.example.com/teams/team-1/projects/project-1)",
    );
    expect(footer).toContain("`[internal]`");
  });

  test("mentions GitLab internal notes in footer for GitLab projects", async () => {
    const { buildIssueSupportDetailsFooter } = await import("@servicebeard/shared");

    const footer = buildIssueSupportDetailsFooter({
      webUrl: "https://app.example.com",
      teamId: "team-1",
      projectId: "project-1",
      provider: "gitlab",
    });

    expect(footer).toContain("Internal note");
    expect(footer).toContain("`[internal]`");
  });

  test("includes support footer in new issue descriptions", () => {
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
      DEFAULT_INBOUND_ISSUE_TEMPLATE,
      undefined,
      {
        webUrl: "https://app.example.com",
        teamId: "team-1",
        projectId: "project-1",
      },
    );

    expect(desc).toContain("<summary>Support details</summary>");
    expect(desc).toContain("<!-- servicebeard-sync:thread-123-->");
  });
});

describe("email content conversion", () => {
  test("converts html email bodies to markdown", async () => {
    const { htmlToMarkdown, buildParsedEmailContent } = await import(
      "@servicebeard/shared/email-content"
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
      "@servicebeard/shared/email-content"
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
      "@servicebeard/shared/email-content"
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
    } = await import("@servicebeard/shared/email-content");

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
      "@servicebeard/shared/email-content"
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
    } = await import("@servicebeard/shared/email-content");
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
      "@servicebeard/shared/email-content"
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

describe("inbound rule eligibility", () => {
  const ctx = {
    supportEmail: "support@mail.test",
    projectCreatedAt: new Date("2026-06-01T10:00:00Z"),
  };

  test("accepts mail addressed directly to the support inbox", () => {
    expect(
      isEligibleForInboundRuleEvaluation(
        {
          fromEmail: "customer@mail.test",
          subject: "Help",
          inReplyTo: null,
          references: [],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
      ),
    ).toBe(true);
  });

  test("accepts Cc-only delivery to the support inbox", () => {
    expect(
      isEligibleForInboundRuleEvaluation(
        {
          fromEmail: "customer@mail.test",
          subject: "Help",
          inReplyTo: "<parent@mail.test>",
          references: ["<parent@mail.test>"],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
      ),
    ).toBe(true);
  });

  test("rejects mail sent by the support mailbox itself", () => {
    expect(
      isEligibleForInboundRuleEvaluation(
        {
          fromEmail: "support@mail.test",
          subject: "Ack",
          inReplyTo: null,
          references: [],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
      ),
    ).toBe(false);
  });
});

describe("inbound thread matching", () => {
  const index = buildThreadMatchIndex(
    [
      { messageId: "<parent@mail.test>", inReplyTo: null },
      { messageId: "<other@mail.test>", inReplyTo: "<root@mail.test>" },
    ],
    [{ subjectNormalized: "help needed", originalSenderEmail: "customer@mail.test" }],
  );

  test("matches by In-Reply-To against stored message IDs", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: "<parent@mail.test>",
          references: [],
          subject: "Re: Help",
          fromEmail: "customer@mail.test",
        },
        index,
      ),
    ).toBe(true);
  });

  test("matches by References against stored in-reply-to values", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: null,
          references: ["<root@mail.test>"],
          subject: "Re: Help",
          fromEmail: "customer@mail.test",
        },
        index,
      ),
    ).toBe(true);
  });

  test("matches by normalized subject and sender", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: null,
          references: [],
          subject: "Re: Help needed",
          fromEmail: "customer@mail.test",
        },
        index,
      ),
    ).toBe(true);
  });

  test("does not match unrelated Cc-only replies", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: "<unknown@mail.test>",
          references: ["<unknown@mail.test>"],
          subject: "Re: Other topic",
          fromEmail: "customer@mail.test",
        },
        index,
      ),
    ).toBe(false);
  });

  test("excludes existing-thread mail from rule preview", () => {
    const ctx = {
      supportEmail: "support@mail.test",
      projectCreatedAt: new Date("2026-06-01T10:00:00Z"),
    };
    expect(
      isEligibleForInboundRulePreview(
        {
          fromEmail: "customer@mail.test",
          subject: "Re: Help",
          inReplyTo: "<parent@mail.test>",
          references: ["<parent@mail.test>"],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
        index,
      ),
    ).toBe(false);
    expect(
      isEligibleForInboundRulePreview(
        {
          fromEmail: "customer@mail.test",
          subject: "New topic",
          inReplyTo: "<unknown@mail.test>",
          references: ["<unknown@mail.test>"],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
        index,
      ),
    ).toBe(true);
  });
});

describe("imap poll watermark", () => {
  const projectCreatedAt = new Date("2026-06-01T10:00:00Z");

  test("starts from project creation when no watermark exists", () => {
    expect(computeImapPollSince(projectCreatedAt, null)).toEqual(projectCreatedAt);
  });

  test("searches from watermark minus overlap", () => {
    const watermark = new Date("2026-06-10T12:00:00Z");
    expect(computeImapPollSince(projectCreatedAt, watermark)).toEqual(
      new Date(watermark.getTime() - IMAP_POLL_OVERLAP_MS),
    );
  });

  test("never searches before project creation", () => {
    const watermark = new Date("2026-06-02T08:00:00Z");
    expect(computeImapPollSince(projectCreatedAt, watermark)).toEqual(projectCreatedAt);
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
    const { formatMailFrom, parseMailFromName } = await import("@servicebeard/shared");
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
    expect(
      buildReferencesChain(["<a@x>"], "<b@x>"),
    ).toEqual(["<a@x>", "<b@x>"]);
    expect(buildReferencesChain(["<b@x>"], "<b@x>")).toEqual(["<b@x>"]);
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
    expect(supportMailboxCc("support@mail.test", "support@mail.test")).toBeUndefined();
  });
});

describe("inbound ack template", () => {
  test("replaces placeholders", async () => {
    const { renderInboundAckTemplate } = await import("@servicebeard/shared");
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
    const { renderInboundAckTemplate } = await import("@servicebeard/shared");
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

describe("outbound comment template", () => {
  test("replaces placeholders", async () => {
    const { renderOutboundCommentTemplate } = await import("@servicebeard/shared");
    const result = renderOutboundCommentTemplate(
      "{{commentBody}}\n\nFrom {{authorName}} on #{{issueNumber}}: {{issueUrl}}",
      {
        commentBody: "We shipped a fix.",
        authorName: "Alex",
        issueNumber: 7,
        issueUrl: "https://github.com/org/repo/issues/7",
      },
    );
    expect(result).toContain("We shipped a fix.");
    expect(result).toContain("Alex");
    expect(result).toContain("#7");
  });
});

describe("normalizeSubject", () => {
  test("strips Re: prefix", () => {
    expect(normalizeSubject("Re: Hello")).toBe("hello");
    expect(normalizeSubject("Fwd: Test")).toBe("test");
  });
});

describe("detectIssueProviderFromUrl", () => {
  test("detects GitHub cloud repository URLs", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(detectIssueProviderFromUrl("https://github.com/acme/support")).toEqual({
      provider: "github",
      providerBaseUrl: "https://github.com",
      providerProjectId: "acme/support",
    });
    expect(
      detectIssueProviderFromUrl("https://github.com/acme/support/issues/12"),
    ).toEqual({
      provider: "github",
      providerBaseUrl: "https://github.com",
      providerProjectId: "acme/support",
    });
  });

  test("detects GitLab cloud project URLs", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(detectIssueProviderFromUrl("https://gitlab.com/acme/website")).toEqual({
      provider: "gitlab",
      providerBaseUrl: "https://gitlab.com",
      providerProjectId: "acme/website",
    });
    expect(
      detectIssueProviderFromUrl("https://gitlab.com/acme/website/-/issues/4"),
    ).toEqual({
      provider: "gitlab",
      providerBaseUrl: "https://gitlab.com",
      providerProjectId: "acme/website",
    });
  });

  test("detects self-hosted instances from hostname", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(
      detectIssueProviderFromUrl("https://gitlab.example.com/acme/website"),
    ).toEqual({
      provider: "gitlab",
      providerBaseUrl: "https://gitlab.example.com",
      providerProjectId: "acme/website",
    });
    expect(
      detectIssueProviderFromUrl("https://github.example.com/acme/support"),
    ).toEqual({
      provider: "github",
      providerBaseUrl: "https://github.example.com",
      providerProjectId: "acme/support",
    });
  });

  test("returns null for ambiguous slugs", async () => {
    const { detectIssueProviderFromUrl } = await import("@servicebeard/shared");
    expect(detectIssueProviderFromUrl("acme/support")).toBeNull();
  });
});

describe("parseGitlabProject", () => {
  test("parses paths and URLs", async () => {
    const { parseGitlabProject } = await import("@servicebeard/shared");
    expect(parseGitlabProject("12345")).toBe("12345");
    expect(parseGitlabProject("acme/website")).toBe("acme/website");
    expect(parseGitlabProject("https://gitlab.com/acme/nested/website")).toBe(
      "acme/nested/website",
    );
    expect(parseGitlabProject("git@gitlab.com:acme/website.git")).toBe("acme/website");
  });
});

describe("parseGithubRepository", () => {
  test("accepts owner/repo slug", async () => {
    const { parseGithubRepository } = await import("@servicebeard/shared");
    expect(parseGithubRepository("acme/support")).toBe("acme/support");
    expect(parseGithubRepository("acme/support.git")).toBe("acme/support");
  });

  test("parses repository and issue URLs", async () => {
    const { parseGithubRepository } = await import("@servicebeard/shared");
    expect(parseGithubRepository("https://github.com/hongaar/servicebeard-support")).toBe(
      "hongaar/servicebeard-support",
    );
    expect(
      parseGithubRepository("https://github.com/hongaar/servicebeard-support/issues/1"),
    ).toBe("hongaar/servicebeard-support");
    expect(parseGithubRepository("github.com/acme/support/pull/12")).toBe("acme/support");
  });

  test("normalizes on create when provider is github", async () => {
    const { createProjectSchema } = await import("@servicebeard/shared");
    const parsed = createProjectSchema.parse({
      name: "Support",
      slug: "support",
      provider: "github",
      providerBaseUrl: "https://github.com",
      providerProjectId: "https://github.com/acme/support/issues/3",
      providerToken: "ghp_test",
      imapHost: "imap.example.com",
      imapUser: "support",
      imapPassword: "secret",
      smtpHost: "smtp.example.com",
      smtpUser: "support",
      smtpPassword: "secret",
      smtpFrom: "support@example.com",
    });
    expect(parsed.providerProjectId).toBe("acme/support");
  });
});

describe("github app install cookie", () => {
  test("roundtrips returnTo with query string", async () => {
    const { encodeGithubAppInstallCookie, decodeGithubAppInstallCookie } = await import(
      "../apps/api/src/lib/github-app-install"
    );
    const payload = {
      state: "abc123",
      teamId: "team-1",
      returnTo: "/teams/team-1/projects?create=1&wizardStep=provider",
      popup: true,
    };
    const encoded = encodeGithubAppInstallCookie(payload);
    expect(encoded).not.toContain("&");
    expect(decodeGithubAppInstallCookie(encoded)).toEqual(payload);
  });
});

describe("validation errors", () => {
  test("formatValidationError maps zod issues to field errors", async () => {
    const { formatValidationError } = await import("@servicebeard/shared");
    const { createProjectSchema } = await import("@servicebeard/shared");
    try {
      createProjectSchema.parse({ name: "", providerToken: "" });
    } catch (err) {
      const formatted = formatValidationError(err as import("zod").ZodError);
      expect(formatted.error).toContain("Validation failed");
      expect(formatted.fieldErrors.name).toBeDefined();
    }
  });

  test("updateProjectSchema strips empty secret fields", async () => {
    const { updateProjectSchema } = await import("@servicebeard/shared");
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
    const { encrypt, decrypt } = await import("@servicebeard/db");
    const plaintext = "secret-token-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test("hashToken is deterministic", async () => {
    const { hashToken } = await import("@servicebeard/db");
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("def"));
  });

  test("rejects non-hex encryption keys", async () => {
    process.env.ENCRYPTION_KEY =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/";
    const { encrypt } = await import("@servicebeard/db");
    expect(() => encrypt("secret")).toThrow(/64-character hex string/);
    process.env.ENCRYPTION_KEY =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  });
});

describe("GitLab webhook parsing", () => {
  test("parses note event", async () => {
    const { GitLabProvider } = await import("@servicebeard/providers");
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
    const { GitLabProvider } = await import("@servicebeard/providers");
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
    const { GitLabProvider } = await import("@servicebeard/providers");
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

describe("GitHub webhook parsing", () => {
  test("parses issue_comment created event", async () => {
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const event = provider.parseWebhook({
      action: "created",
      issue: { id: 100, number: 7 },
      comment: {
        id: 42,
        body: "Thanks for the report",
        user: { id: 5, login: "agent", name: "Support Agent" },
        created_at: "2026-01-01T12:00:00Z",
      },
    });

    expect(event).not.toBeNull();
    expect(event!.noteId).toBe("42");
    expect(event!.issueIid).toBe(7);
    expect(event!.authorName).toBe("Support Agent");
    expect(event!.authorUsername).toBe("agent");
  });

  test("skips bot comments", async () => {
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const event = provider.parseWebhook({
      action: "created",
      issue: { id: 100, number: 7 },
      comment: {
        id: 43,
        body: "automated",
        user: { id: 1, login: "bot", type: "Bot" },
        created_at: "2026-01-01T12:00:00Z",
      },
    });

    expect(event).toBeNull();
  });

  test("verifies webhook signature", async () => {
    const { createHmac } = await import("node:crypto");
    const { GitHubProvider } = await import("@servicebeard/providers");
    const provider = new GitHubProvider({
      baseUrl: "https://github.com",
      projectId: "octocat/Hello-World",
      token: "token",
    });

    const body = '{"action":"created"}';
    const secret = "test-secret";
    const signature =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

    expect(provider.verifyWebhook({ "x-hub-signature-256": signature }, body, secret)).toBe(
      true,
    );
    expect(provider.verifyWebhook({ "x-hub-signature-256": "sha256=bad" }, body, secret)).toBe(
      false,
    );
  });
});

describe("sync error classification", () => {
  test("classifies mail and provider operations", async () => {
    const { classifySyncError } = await import("@servicebeard/shared");
    expect(classifySyncError("imap", "fetch-unseen")).toBe("mail");
    expect(classifySyncError("smtp", "send-mail")).toBe("mail");
    expect(classifySyncError("github", "list-comments")).toBe("provider");
    expect(classifySyncError("inbound", "process-message")).toBe("provider");
    expect(classifySyncError("api", "unknown")).toBeNull();
  });
});

describe("login provider env", () => {
  const oidcEnv = {
    OIDC_ISSUER: "https://idp.example.com",
    OIDC_CLIENT_ID: "client",
    OIDC_CLIENT_SECRET: "secret",
  };
  const githubEnv = {
    GITHUB_CLIENT_ID: "client",
    GITHUB_CLIENT_SECRET: "secret",
  };
  const gitlabEnv = {
    GITLAB_CLIENT_ID: "client",
    GITLAB_CLIENT_SECRET: "secret",
  };

  function withEnv(
    values: Record<string, string | undefined>,
    run: () => void | Promise<void>,
  ): void | Promise<void> {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(values)) {
      previous.set(key, process.env[key]);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }

    try {
      return run();
    } finally {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }

  test("oauth providers stay disabled unless *_LOGIN=true", async () => {
    const {
      isGithubLoginEnabled,
      isGitlabLoginEnabled,
      isLocalLoginEnabled,
      isOidcLoginEnabled,
    } = await import("../apps/api/src/lib/env");

    withEnv({
      ...oidcEnv,
      ...githubEnv,
      ...gitlabEnv,
      OIDC_LOGIN: undefined,
      GITHUB_LOGIN: undefined,
      GITLAB_LOGIN: undefined,
      LOCAL_LOGIN: undefined,
    }, () => {
      expect(isOidcLoginEnabled()).toBe(false);
      expect(isGithubLoginEnabled()).toBe(false);
      expect(isGitlabLoginEnabled()).toBe(false);
      expect(isLocalLoginEnabled()).toBe(false);
    });
  });

  test("oauth providers require config even when *_LOGIN=true", async () => {
    const {
      isGithubLoginEnabled,
      isGitlabLoginEnabled,
      isOidcLoginEnabled,
    } = await import("../apps/api/src/lib/env");

    withEnv({
      OIDC_LOGIN: "true",
      GITHUB_LOGIN: "true",
      GITLAB_LOGIN: "true",
      OIDC_ISSUER: undefined,
      OIDC_CLIENT_ID: undefined,
      OIDC_CLIENT_SECRET: undefined,
      GITHUB_CLIENT_ID: undefined,
      GITHUB_CLIENT_SECRET: undefined,
      GITLAB_CLIENT_ID: undefined,
      GITLAB_CLIENT_SECRET: undefined,
    }, () => {
      expect(isOidcLoginEnabled()).toBe(false);
      expect(isGithubLoginEnabled()).toBe(false);
      expect(isGitlabLoginEnabled()).toBe(false);
    });
  });

  test("oauth providers enable only with *_LOGIN=true and full config", async () => {
    const {
      isGithubLoginEnabled,
      isGitlabLoginEnabled,
      isOidcLoginEnabled,
    } = await import("../apps/api/src/lib/env");

    withEnv({
      OIDC_ISSUER: oidcEnv.OIDC_ISSUER,
      OIDC_CLIENT_ID: oidcEnv.OIDC_CLIENT_ID,
      OIDC_CLIENT_SECRET: oidcEnv.OIDC_CLIENT_SECRET,
      GITHUB_CLIENT_ID: githubEnv.GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET: githubEnv.GITHUB_CLIENT_SECRET,
      GITLAB_CLIENT_ID: gitlabEnv.GITLAB_CLIENT_ID,
      GITLAB_CLIENT_SECRET: gitlabEnv.GITLAB_CLIENT_SECRET,
      OIDC_LOGIN: "true",
      GITHUB_LOGIN: "true",
      GITLAB_LOGIN: "true",
    }, () => {
      expect(isOidcLoginEnabled()).toBe(true);
      expect(isGithubLoginEnabled()).toBe(true);
      expect(isGitlabLoginEnabled()).toBe(true);
    });
  });

  test("oauth callback URL prefers WEB_URL for browser cookie flow", async () => {
    const { getOAuthCallbackUrl } = await import("../apps/api/src/lib/env");

    withEnv(
      {
        OAUTH_REDIRECT_URI: undefined,
        WEB_URL: "http://localhost:5173",
        API_URL: "http://localhost:3000",
      },
      () => {
        expect(getOAuthCallbackUrl()).toBe("http://localhost:5173/api/auth/callback");
      },
    );
  });

  test("local login requires LOCAL_LOGIN=true", async () => {
    const { isLocalLoginEnabled } = await import("../apps/api/src/lib/env");

    withEnv({ LOCAL_LOGIN: "false" }, () => {
      expect(isLocalLoginEnabled()).toBe(false);
    });

    withEnv({ LOCAL_LOGIN: "true" }, () => {
      expect(isLocalLoginEnabled()).toBe(true);
    });
  });
});

describe("auth providers", () => {
  test("infers provider type from external subject", async () => {
    const { inferProviderFromExternalSub, isRedirectProvider } = await import(
      "../apps/api/src/lib/login/providers"
    );

    expect(inferProviderFromExternalSub("github:123")).toBe("github");
    expect(inferProviderFromExternalSub("gitlab:456")).toBe("gitlab");
    expect(inferProviderFromExternalSub("local:user@example.com")).toBe("local");
    expect(inferProviderFromExternalSub("auth0|abc")).toBe("oidc");

    expect(isRedirectProvider("github")).toBe(true);
    expect(isRedirectProvider("local")).toBe(false);
  });
});

describe("mail autoconfig", () => {
  test("mail.test resolves to local GreenMail settings", async () => {
    const { lookupMailAutoconfig, usesLocalPartMailAuth } = await import(
      "@servicebeard/shared/mail-autoconfig"
    );

    const config = lookupMailAutoconfig("support@mail.test");
    expect(config?.providerName).toBe("GreenMail (local dev)");
    expect(config?.imap).toEqual({ host: "localhost", port: 3143, secure: false });
    expect(config?.smtp).toEqual({ host: "localhost", port: 3025, secure: false });
    expect(usesLocalPartMailAuth("support@mail.test")).toBe(true);
    expect(usesLocalPartMailAuth("support@gmail.com")).toBe(false);
  });
});

describe("mail discovery parsers", () => {
  test("parses Mozilla autoconfig XML", async () => {
    const { parseMozillaAutoconfigXml } = await import("@servicebeard/shared/mail-discover");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<clientConfig version="1.1">
  <emailProvider id="migadu.com">
    <displayName>Migadu</displayName>
    <incomingServer type="imap">
      <hostname>imap.migadu.com</hostname>
      <port>993</port>
      <socketType>SSL</socketType>
    </incomingServer>
    <outgoingServer type="smtp">
      <hostname>smtp.migadu.com</hostname>
      <port>465</port>
      <socketType>SSL</socketType>
    </outgoingServer>
  </emailProvider>
</clientConfig>`;

    expect(parseMozillaAutoconfigXml(xml, "servicebeard.app")).toEqual({
      providerName: "Migadu",
      imap: { host: "imap.migadu.com", port: 993, secure: true },
      smtp: { host: "smtp.migadu.com", port: 465, secure: true },
    });
  });

  test("parses Microsoft autodiscover XML", async () => {
    const { parseMicrosoftAutodiscoverXml } = await import("@servicebeard/shared/mail-discover");
    const xml = `<?xml version="1.0" encoding="utf-8" ?>
<Autodiscover xmlns="http://schemas.microsoft.com/exchange/autodiscover/responseschema/2006">
  <Response xmlns="http://schemas.microsoft.com/exchange/autodiscover/outlook/responseschema/2006a">
    <Account>
      <Protocol>
        <Type>IMAP</Type>
        <Server>imap.example.com</Server>
        <Port>993</Port>
        <SSL>on</SSL>
      </Protocol>
      <Protocol>
        <Type>SMTP</Type>
        <Server>smtp.example.com</Server>
        <Port>465</Port>
        <SSL>on</SSL>
      </Protocol>
    </Account>
  </Response>
</Autodiscover>`;

    expect(parseMicrosoftAutodiscoverXml(xml, "servicebeard.app")).toEqual({
      providerName: "servicebeard.app",
      imap: { host: "imap.example.com", port: 993, secure: true },
      smtp: { host: "smtp.example.com", port: 465, secure: true },
    });
  });

  test("builds config from DNS SRV targets", async () => {
    const { mailAutoconfigFromSrvRecords } = await import("@servicebeard/shared/mail-discover");

    expect(
      mailAutoconfigFromSrvRecords(
        { name: "imap.migadu.com.", port: 993 },
        { name: "smtp.migadu.com.", port: 465 },
        "servicebeard.app",
      ),
    ).toEqual({
      providerName: "servicebeard.app",
      imap: { host: "imap.migadu.com", port: 993, secure: true },
      smtp: { host: "smtp.migadu.com", port: 465, secure: true },
    });
  });
});

describe("mail connection errors", () => {
  test("maps SMTP connection closed on port 465 to actionable guidance", async () => {
    const { formatMailConnectionError } = await import("../apps/api/src/lib/mail-connection-error");

    const err = formatMailConnectionError(
      { protocol: "SMTP", host: "smtp.migadu.com", port: 465, secure: true },
      new Error("Connection closed"),
    );

    expect(err.message).toContain("SMTP connection to smtp.migadu.com:465 (TLS)");
    expect(err.message).toContain("Port 465 is often blocked");
    expect(err.message).toContain("587");
  });

  test("maps SMTP timeout on port 465 to actionable guidance", async () => {
    const { formatMailConnectionError } = await import("../apps/api/src/lib/mail-connection-error");

    const err = formatMailConnectionError(
      { protocol: "SMTP", host: "smtp.migadu.com", port: 465, secure: true },
      new Error("Connection timeout"),
    );

    expect(err.message).toContain("timed out");
    expect(err.message).toContain("587");
  });

  test("maps authentication failures clearly", async () => {
    const { formatMailConnectionError } = await import("../apps/api/src/lib/mail-connection-error");

    const err = formatMailConnectionError(
      { protocol: "IMAP", host: "imap.migadu.com", port: 993, secure: true },
      new Error("Invalid login: 535 5.7.8 Error: authentication failed"),
    );

    expect(err.message).toContain("IMAP authentication failed");
    expect(err.message).toContain("username and password");
  });
});

describe("provider project URLs", () => {
  test("builds GitHub and GitLab issues URLs", async () => {
    const { providerIssuesWebUrl } = await import("@servicebeard/shared");

    expect(
      providerIssuesWebUrl("github", "https://github.com", "acme/support"),
    ).toBe("https://github.com/acme/support/issues");
    expect(
      providerIssuesWebUrl("gitlab", "https://gitlab.com", "acme/support"),
    ).toBe("https://gitlab.com/acme/support/-/issues");
    expect(providerIssuesWebUrl("gitlab", "https://gitlab.com", "12345")).toBe(
      "https://gitlab.com/projects/12345/issues",
    );
  });
});

describe("entitlements", () => {
  test("default provider allows unlimited projects and team access", async () => {
    const { getEntitlements } = await import("../apps/api/src/lib/entitlements");

    await expect(
      getEntitlements().assertCanCreateProject("team-1", 999),
    ).resolves.toBeUndefined();
    await expect(
      getEntitlements().assertTeamAccess("team-1", { path: "/api/teams/team-1/projects" }),
    ).resolves.toBeUndefined();
  });
});

describe("global search", () => {
  test("filterSearchActions matches labels and keywords", async () => {
    const { buildSearchActions, filterSearchActions } = await import(
      "../apps/web/src/lib/globalSearch"
    );

    const actions = buildSearchActions({
      teamId: "team-1",
      projectId: "project-1",
      isAdmin: true,
    });

    expect(filterSearchActions(actions, "templates").some((a) => a.label === "Templates")).toBe(
      true,
    );
    expect(filterSearchActions(actions, "help").some((a) => a.group === "Help")).toBe(true);
    expect(filterSearchActions(actions, "status").some((a) => a.label === "System status")).toBe(
      true,
    );
  });

  test("groupSearchResults preserves group order", async () => {
    const { groupSearchResults } = await import("../apps/web/src/lib/globalSearchResults");

    const groups = groupSearchResults([
      {
        id: "1",
        label: "Teams",
        group: "Teams",
        kind: "navigate",
        to: "/",
      },
      {
        id: "2",
        label: "Projects",
        group: "Navigation",
        kind: "navigate",
        to: "/",
      },
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Navigation", "Teams"]);
  });
});
