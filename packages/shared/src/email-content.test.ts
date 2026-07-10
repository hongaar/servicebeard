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

  test("adds email-client spacing to markdown body html", async () => {
    const { markdownToHtml, styleEmailContentHtml } =
      await import("@servicebeard/shared/email-content");
    const html = styleEmailContentHtml(
      markdownToHtml(
        "First paragraph.\n\nSecond paragraph.\n\n---\n\nFooter link: [issue](https://example.com)",
      ),
    );

    expect(html).toContain('style="margin: 0 0 1em 0;"');
    expect(html).toContain(
      'style="border: 0; border-top: 1px solid #e5e7eb; margin: 1.25em 0;"',
    );
    expect(html).toContain('style="color: #2563eb;"');
  });

  test("strips blockquote from html before plain body extraction", async () => {
    const { buildParsedEmailContent, stripQuotedHtmlBlocks } =
      await import("@servicebeard/shared/email-content");
    const html =
      "<p>Thanks!</p><blockquote><p>On Mon, Jane wrote:</p><p>Old message</p></blockquote>";
    expect(stripQuotedHtmlBlocks(html)).not.toContain("Old message");

    const content = buildParsedEmailContent(false, html, []);
    expect(content.body).toBe("Thanks!");
    expect(content.body).not.toContain("Old message");
  });

  test("strips gmail_quote divs from html", async () => {
    const { stripQuotedHtmlBlocks } =
      await import("@servicebeard/shared/email-content");
    const html =
      '<p>Reply</p><div class="gmail_quote"><p>Quoted history</p></div>';
    expect(stripQuotedHtmlBlocks(html)).not.toContain("Quoted history");
  });

  test("strips styled email quote tables from html", async () => {
    const { buildParsedEmailContent, stripQuotedHtmlBlocks } =
      await import("@servicebeard/shared/email-content");
    const html =
      '<p>Thanks!</p><table data-sb-quote="1"><tr><td>On Mon, support wrote:</td></tr><tr><td>Old message</td></tr></table>';
    expect(stripQuotedHtmlBlocks(html)).not.toContain("Old message");

    const content = buildParsedEmailContent(false, html, []);
    expect(content.body).toBe("Thanks!");
    expect(content.body).not.toContain("Old message");
  });

  test("strips nested gmail_quote divs from html", async () => {
    const { stripQuotedHtmlBlocks } =
      await import("@servicebeard/shared/email-content");
    const html =
      '<p>Reply</p><div class="gmail_quote"><div><p>Nested</p><p>Quoted history</p></div></div>';
    expect(stripQuotedHtmlBlocks(html)).not.toContain("Quoted history");
    expect(stripQuotedHtmlBlocks(html)).toContain("Reply");
  });

  test("strips Dutch attribution from multipart replies", async () => {
    const { buildParsedEmailContent } =
      await import("@servicebeard/shared/email-content");
    const text =
      "nog een plaintext antwoord!\n\nsupport@mail.test schreef op 2026-07-10 14:19:\n\n> Test team";
    const html =
      "<p>nog een plaintext antwoord!</p><table><tr><td>Test team</td></tr><tr><td>oh hi there!</td></tr></table>";

    const content = buildParsedEmailContent(text, html, []);
    expect(content.body).toBe("nog een plaintext antwoord!");
    expect(content.bodyMarkdown).not.toContain("oh hi there!");
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

  test("collects github html image refs from issue comments", async () => {
    const { collectOutboundImageRefs } =
      await import("@servicebeard/shared/email-content");
    const note =
      'See screenshot:\n\n<img width="393" alt="image" src="https://github.com/user-attachments/assets/abc-123" />';
    const images = collectOutboundImageRefs(note, "https://github.com");
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toBe(
      "https://github.com/user-attachments/assets/abc-123",
    );
  });

  test("collects linear markdown image refs from issue comments", async () => {
    const { collectOutboundImageRefs } =
      await import("@servicebeard/shared/email-content");
    const note =
      "Updated mockup\n\n![mockup](https://uploads.linear.app/abc/mockup.png)\n\nthoughts?";
    const images = collectOutboundImageRefs(note, "https://linear.app");
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toContain("uploads.linear.app");
  });

  test("collects github raw attachment urls from markdown", async () => {
    const { collectOutboundImageRefs } =
      await import("@servicebeard/shared/email-content");
    const note =
      "![shot](https://github.com/acme/app/raw/servicebeard-attachments/.servicebeard/attachments/uuid/shot.png)";
    const images = collectOutboundImageRefs(note, "https://github.com");
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toContain("/raw/servicebeard-attachments/");
  });

  test("maps github user-attachments urls to signed bodyHTML urls", async () => {
    const { mapCommentImageDownloadUrls } =
      await import("@servicebeard/shared/email-content");
    const displayUrl = "https://github.com/user-attachments/assets/abc-123";
    const signedUrl =
      "https://private-user-images.githubusercontent.com/1/abc?jwt=token";
    const overrides = mapCommentImageDownloadUrls(
      `<img alt="Image" src="${displayUrl}" />`,
      `<img alt="Image" src="${signedUrl}" />`,
      "https://github.com",
    );
    expect(overrides.get(displayUrl)).toBe(signedUrl);
  });

  test("replaces inlined images with plain-text placeholders", async () => {
    const { replaceInlinedImagesWithPlainTextPlaceholders } =
      await import("@servicebeard/shared/email-content");
    const urlToCid = new Map([["https://example.com/a.png", "img1@local"]]);
    const result = replaceInlinedImagesWithPlainTextPlaceholders(
      "Before ![logo](https://example.com/a.png) after",
      urlToCid,
    );
    expect(result).toBe("Before [logo] after");
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
