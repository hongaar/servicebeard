import { describe, expect, test } from "bun:test";

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
    const { renderOutboundCommentTemplate } =
      await import("@servicebeard/shared");
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

describe("buildMarkdownEmailParts", () => {
  test("produces plain text and html from markdown templates", async () => {
    const { buildMarkdownEmailParts } = await import("@servicebeard/shared");
    const { text, html } = buildMarkdownEmailParts("Hello **{{name}}**");
    expect(text).toContain("Hello");
    expect(text).toContain("{{name}}");
    expect(html).toContain("<strong>");
    expect(html).toContain("{{name}}");
  });
});

describe("template preview variables", () => {
  test("fills sample values for known template variables", async () => {
    const { templatePreviewVariables, renderInboundAckTemplate } =
      await import("@servicebeard/shared");
    const vars = templatePreviewVariables([
      "senderName",
      "subject",
      "issueNumber",
      "issueUrl",
    ]);
    const rendered = renderInboundAckTemplate(
      "Hi {{senderName}}, issue #{{issueNumber}}: {{issueUrl}}",
      {
        senderName: vars.senderName,
        senderEmail: "jane@example.com",
        subject: vars.subject,
        issueNumber: Number(vars.issueNumber),
        issueUrl: vars.issueUrl,
      },
    );
    expect(rendered).toContain("Jane Customer");
    expect(rendered).toContain("#42");
    expect(rendered).not.toContain("{{");
  });
});
