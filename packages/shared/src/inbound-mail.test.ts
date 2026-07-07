import { describe, expect, test } from "bun:test";
import {
  buildThreadMatchIndex,
  emailMatchesExistingThread,
  isEligibleForInboundRuleEvaluation,
  isEligibleForInboundRulePreview,
  isEmailEligibleForInboundSync,
} from "./inbound-mail";

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

  test("accepts relayed mail when Reply-To is the customer", () => {
    expect(
      isEligibleForInboundRuleEvaluation(
        {
          fromEmail: "noreply@servicebeard.app",
          senderEmail: "customer@mail.test",
          subject: "Contact form",
          inReplyTo: null,
          references: [],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
      ),
    ).toBe(true);
  });

  test("accepts contact form relay when system From matches support inbox", () => {
    expect(
      isEligibleForInboundRuleEvaluation(
        {
          fromEmail: "support@mail.test",
          senderEmail: "customer@mail.test",
          subject: "[ServiceBeard Contact] General — Jane",
          inReplyTo: null,
          references: [],
          date: new Date("2026-06-02T08:00:00Z"),
        },
        ctx,
      ),
    ).toBe(true);
  });
});

describe("inbound thread matching", () => {
  const index = buildThreadMatchIndex(
    [
      { messageId: "<parent@mail.test>", inReplyTo: null },
      { messageId: "<other@mail.test>", inReplyTo: "<root@mail.test>" },
    ],
    [
      {
        subjectNormalized: "help needed",
        originalSenderEmail: "customer@mail.test",
        lastActivityAt: new Date("2026-06-02T08:00:00Z"),
      },
    ],
  );
  const matchAt = new Date("2026-06-02T08:00:00Z");

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
        matchAt,
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
        matchAt,
      ),
    ).toBe(true);
  });

  test("matches by normalized subject and sender for reply subjects", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: null,
          references: [],
          subject: "Re: Help needed",
          fromEmail: "customer@mail.test",
        },
        index,
        matchAt,
      ),
    ).toBe(true);
  });

  test("does not match by subject alone for new conversations", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: null,
          references: [],
          subject: "Help needed",
          fromEmail: "customer@mail.test",
        },
        index,
        matchAt,
      ),
    ).toBe(false);
  });

  test("does not match stale conversations by subject", () => {
    const staleIndex = buildThreadMatchIndex(
      [],
      [
        {
          subjectNormalized: "problem",
          originalSenderEmail: "customer@mail.test",
          lastActivityAt: new Date("2026-05-01T08:00:00Z"),
        },
      ],
    );
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: null,
          references: [],
          subject: "Re: problem",
          fromEmail: "customer@mail.test",
        },
        staleIndex,
        new Date("2026-06-02T08:00:00Z"),
      ),
    ).toBe(false);
  });

  test("still matches stale conversations by message references", () => {
    const staleIndex = buildThreadMatchIndex(
      [{ messageId: "<parent@mail.test>", inReplyTo: null }],
      [
        {
          subjectNormalized: "problem",
          originalSenderEmail: "customer@mail.test",
          lastActivityAt: new Date("2026-05-01T08:00:00Z"),
        },
      ],
    );
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: "<parent@mail.test>",
          references: [],
          subject: "Re: problem",
          fromEmail: "customer@mail.test",
        },
        staleIndex,
        new Date("2026-06-02T08:00:00Z"),
      ),
    ).toBe(true);
  });

  test("matches by normalized subject and Reply-To sender", () => {
    expect(
      emailMatchesExistingThread(
        {
          inReplyTo: null,
          references: [],
          subject: "Re: Help needed",
          fromEmail: "noreply@servicebeard.app",
          senderEmail: "customer@mail.test",
        },
        index,
        matchAt,
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
        matchAt,
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
