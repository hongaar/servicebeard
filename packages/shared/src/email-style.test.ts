import { describe, expect, test } from "bun:test";
import {
  contrastColorOnBackground,
  DEFAULT_EMAIL_STYLE_CONFIG,
  logoDataUri,
  renderPlainEmailPreviewHtml,
  renderStyledEmailHtml,
  splitReplyAndQuote,
} from "./email-style";

const sampleQuoted = {
  fromName: "Jane",
  fromEmail: "jane@example.com",
  date: new Date("2026-06-01T10:00:00Z"),
  body: "Help needed",
};

describe("renderStyledEmailHtml", () => {
  test("returns null for none preset", () => {
    expect(
      renderStyledEmailHtml({
        preset: "none",
        config: DEFAULT_EMAIL_STYLE_CONFIG,
        contentHtml: "<p>Hello</p>",
      }),
    ).toBeNull();
  });

  test("renders minimal preset with accent color", () => {
    const html = renderStyledEmailHtml({
      preset: "minimal",
      config: {
        ...DEFAULT_EMAIL_STYLE_CONFIG,
        primaryColor: "#ff0000",
        teamName: "Acme Support",
        showTeamName: true,
        showProjectName: false,
      },
      contentHtml: "<p>Thank you for contacting us.</p>",
      quoted: sampleQuoted,
    });

    expect(html).toContain("Acme Support");
    expect(html).toContain("#ff0000");
    expect(html).toContain("sb-email-quote");
    expect(html).toContain("Jane &lt;jane@example.com&gt; wrote:");
    expect(html).toContain("Help needed");
    expect(html).not.toContain("&gt; Help");
    expect(html).toContain("Thank you for contacting us.");
  });

  test("renders branded preset with logo cid", () => {
    const logo = {
      data: Buffer.from("fake-logo").toString("base64"),
      contentType: "image/png",
    };
    const html = renderStyledEmailHtml({
      preset: "branded",
      config: {
        ...DEFAULT_EMAIL_STYLE_CONFIG,
        teamName: "Acme",
        projectName: "Helpdesk",
        showTeamName: true,
        showProjectName: true,
        logo,
      },
      contentHtml: "<p>Reply body</p>",
      quoted: sampleQuoted,
      logoSrc: "cid:servicebeard-logo@local",
    });

    expect(html).toContain('src="cid:servicebeard-logo@local"');
    expect(html).toContain("Acme · Helpdesk");
    expect(html).toContain("sb-email-quote");
    expect(html).toContain("Help needed");
    expect(html).not.toContain("&gt; Help");
  });

  test("hides team and project names when disabled", () => {
    const html = renderStyledEmailHtml({
      preset: "minimal",
      config: {
        ...DEFAULT_EMAIL_STYLE_CONFIG,
        teamName: "Hidden Team",
        projectName: "Hidden Project",
        showTeamName: false,
        showProjectName: false,
      },
      contentHtml: "<p>Body</p>",
    });

    expect(html).not.toContain("Hidden Team");
    expect(html).not.toContain("Hidden Project");
  });

  test("logoDataUri builds data uri", () => {
    expect(logoDataUri({ data: "abc", contentType: "image/png" })).toBe(
      "data:image/png;base64,abc",
    );
  });

  test("uses dark header text on light branded backgrounds", () => {
    const html = renderStyledEmailHtml({
      preset: "branded",
      config: {
        ...DEFAULT_EMAIL_STYLE_CONFIG,
        primaryColor: "#fde2e4",
        teamName: "Acme",
        projectName: "Support",
        showTeamName: true,
        showProjectName: true,
      },
      contentHtml: "<p>Body</p>",
    });

    expect(html).toContain("color: #111827");
    expect(contrastColorOnBackground("#fde2e4")).toBe("#111827");
    expect(contrastColorOnBackground("#111827")).toBe("#ffffff");
  });

  test("renders plain email preview html", () => {
    const html = renderPlainEmailPreviewHtml(
      '<p>Thank you for contacting us.</p><p>Follow up soon.</p><hr><p><a href="https://example.com">Reference</a></p>',
      sampleQuoted,
    );

    expect(html).toContain("Thank you for contacting us.");
    expect(html).toContain('style="margin: 0 0 1em 0;"');
    expect(html).toContain(
      'style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.25em 0;"',
    );
    expect(html).toContain("sb-email-quote");
    expect(html).toContain("Jane &lt;jane@example.com&gt; wrote:");
    expect(html).toContain("Help needed");
    expect(html).not.toContain("&gt; Help");
  });
});

describe("splitReplyAndQuote", () => {
  test("splits reply text from quoted history", () => {
    const result = splitReplyAndQuote("Thanks!", sampleQuoted);

    expect(result.replyText).toBe("Thanks!");
    expect(result.quotedText).toContain("Jane <jane@example.com> wrote:");
    expect(result.quotedText).toContain("> Help needed");
  });

  test("returns null quoted text when quote body is empty", () => {
    const result = splitReplyAndQuote("Only reply", {
      fromName: null,
      fromEmail: "a@b.com",
      date: new Date(),
      body: "   ",
    });

    expect(result.replyText).toBe("Only reply");
    expect(result.quotedText).toBeNull();
  });
});
