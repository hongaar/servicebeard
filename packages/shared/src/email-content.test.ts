import { describe, expect, test } from "bun:test";

describe("email content conversion", () => {
  test("converts html email bodies to markdown", async () => {
    const { htmlToMarkdown, buildParsedEmailContent } =
      await import("@servicebeard/shared/email-content");
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
    const { replaceCidImagesInMarkdown } =
      await import("@servicebeard/shared/email-content");
    const map = new Map([["img001@mail.test", "![logo](/uploads/logo.png)"]]);
    const result = replaceCidImagesInMarkdown(
      "See this: ![logo](cid:img001@mail.test)",
      map,
    );
    expect(result).toBe("See this: ![logo](/uploads/logo.png)");
  });

  test("converts markdown to html for outbound email", async () => {
    const { markdownToHtml, markdownToPlainText } =
      await import("@servicebeard/shared/email-content");
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

    const resolved = replaceImagePlaceholdersInMarkdown(
      content.bodyMarkdown,
      new Map([[imagePlaceholder(0), "![photo](/uploads/abc/photo.png)"]]),
    );
    expect(resolved).toContain("![photo](/uploads/abc/photo.png)");
    expect(resolved.indexOf("![photo]")).toBeGreaterThan(
      resolved.indexOf("hallo,"),
    );
    expect(resolved.indexOf("![photo]")).toBeLessThan(
      resolved.indexOf("kennen jullie"),
    );
  });

  test("strips data-uri images from html before markdown conversion", async () => {
    const { buildParsedEmailContent, imagePlaceholder } =
      await import("@servicebeard/shared/email-content");
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
    expect(
      isResolvableImageUrl(
        "/uploads/abc123/photo.jpg",
        "https://gitlab.example.com",
      ),
    ).toBe(true);
    expect(isResolvableImageUrl("/uploads/abc123/photo.jpg")).toBe(false);

    const note =
      "oh nice\n\n![Screenshot](/uploads/06a8c6da28f76281b6f75d59bad2859c/Screenshot_2026-06-24_at_15.07.36.png){width=328 height=321}\n\ncan you see it?";
    const prepared = prepareGitLabNoteForOutboundEmail(note);
    expect(prepared).not.toContain("{width=328");
    const images = collectOutboundImageRefs(note, "https://gitlab.example.com");
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toContain("/uploads/");
  });

  test("parses gitlab upload paths into secret and filename", async () => {
    const { parseGitLabUploadPath } =
      await import("@servicebeard/shared/email-content");
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
