import { markdownToHtml } from "@servicebeard/shared/email-content";
import { describe, expect, test } from "bun:test";
import { applyEmailStyleToHtml } from "./email-style-apply";

const baseProject = {
  id: "project-1",
  name: "Support Desk",
  emailStylePreset: "minimal",
  emailStyleConfig: {
    primaryColor: "#2563eb",
    logo: null,
    showTeamName: true,
    teamName: "Acme",
    showProjectName: true,
    projectName: "Support Desk",
  },
} as Parameters<typeof applyEmailStyleToHtml>[0];

describe("applyEmailStyleToHtml", () => {
  test("renders plain html with structured quote when preset is none", () => {
    const result = applyEmailStyleToHtml(
      { ...baseProject, emailStylePreset: "none" },
      {
        contentMarkdown: "Hello",
        quoted: {
          fromName: "Jane",
          fromEmail: "jane@example.com",
          date: new Date("2026-06-01T10:00:00Z"),
          body: "Prior message",
        },
        fallbackHtml: "<p>plain</p>",
      },
    );

    expect(result.html).toContain("Hello");
    expect(result.html).toContain("sb-email-quote");
    expect(result.html).toContain("Prior message");
    expect(result.html).not.toContain("&gt; Prior");
    expect(result.attachments).toHaveLength(0);
  });

  test("wraps content in styled html and adds logo attachment for branded preset", () => {
    const result = applyEmailStyleToHtml(
      {
        ...baseProject,
        emailStylePreset: "branded",
        emailStyleConfig: {
          ...baseProject.emailStyleConfig!,
          logo: {
            data: Buffer.from("logo").toString("base64"),
            contentType: "image/png",
          },
        },
      },
      {
        contentMarkdown: "Thanks for your patience.",
        quoted: {
          fromName: "Jane",
          fromEmail: "jane@example.com",
          date: new Date("2026-06-01T10:00:00Z"),
          body: "Help needed",
        },
        fallbackHtml: markdownToHtml("fallback"),
      },
    );

    expect(result.html).toContain("Thanks for your patience.");
    expect(result.html).toContain("sb-email-quote");
    expect(result.html).toContain("Help needed");
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.cid).toBe("servicebeard-logo@local");
  });
});
