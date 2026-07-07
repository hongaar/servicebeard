import {
  DEFAULT_INBOUND_COMMENT_TEMPLATE,
  DEFAULT_INBOUND_ISSUE_TEMPLATE,
} from "@servicebeard/shared";
import {
  baseRule,
  testEmail,
  testEmailDate,
} from "@servicebeard/shared/testing/email-fixtures";
import { describe, expect, test } from "bun:test";
import { formatCommentBody, formatIssueDescription } from "./rules";

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

    const comment = formatCommentBody(
      testEmail({
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
      }),
      DEFAULT_INBOUND_COMMENT_TEMPLATE,
    );

    expect(comment).toContain("**Reply from customer <customer@mail.test>**");
    expect(comment).toContain("dat is mooi!");
    expect(comment).not.toContain("On 2026-06-23 22:02");
    expect(comment).not.toContain("groot probleem");
    expect(comment).not.toContain("Reply from USERNAME");
  });

  test("keeps full body when there is no quote marker", () => {
    const comment = formatCommentBody(
      testEmail({
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
      }),
      DEFAULT_INBOUND_COMMENT_TEMPLATE,
    );

    expect(comment).toContain("First message with no quotes");
    expect(comment).toContain("<!-- servicebeard-sync:email:<m@mail.test>-->");
  });

  test("uses Reply-To as the customer sender", () => {
    const comment = formatCommentBody(
      testEmail({
        messageId: "<contact@mail.test>",
        inReplyTo: null,
        references: [],
        toAddresses: [],
        ccAddresses: [],
        bccAddresses: [],
        fromEmail: "noreply@servicebeard.app",
        fromName: "ServiceBeard",
        replyToEmail: "jane@example.com",
        replyToName: "Jane",
        subject: "Contact",
        body: "Please help",
        date: testEmailDate,
      }),
      DEFAULT_INBOUND_COMMENT_TEMPLATE,
    );

    expect(comment).toContain("**Reply from Jane <jane@example.com>**");
    expect(comment).not.toContain("noreply@servicebeard.app");
  });
});

describe("issue support details footer", () => {
  test("builds collapsible footer with project link", async () => {
    const { buildIssueSupportDetailsFooter } =
      await import("@servicebeard/shared");

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
    const { buildIssueSupportDetailsFooter } =
      await import("@servicebeard/shared");

    const footer = buildIssueSupportDetailsFooter({
      webUrl: "https://app.example.com",
      teamId: "team-1",
      projectId: "project-1",
      provider: "gitlab",
    });

    expect(footer).toContain("Internal note");
    expect(footer).toContain("`[internal]`");
  });

  test("uses markdown footer for Linear projects", async () => {
    const { buildIssueSupportDetailsFooter } =
      await import("@servicebeard/shared");

    const footer = buildIssueSupportDetailsFooter({
      webUrl: "https://app.example.com",
      teamId: "team-1",
      projectId: "project-1",
      provider: "linear",
    });

    expect(footer).not.toContain("<details>");
    expect(footer).toContain("### Support details");
    expect(footer).toContain("[ServiceBeard](https://app.example.com)");
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

  test("uses markdown footer and sync marker for Linear issues", () => {
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
        provider: "linear",
      },
    );

    expect(desc).not.toContain("<details>");
    expect(desc).toContain("### Support details");
    expect(desc).toContain("[//]: # (servicebeard-sync:thread-123)");
    expect(desc).not.toContain("<!-- servicebeard-sync:");
  });
});
