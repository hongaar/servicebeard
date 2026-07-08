import type { IssueProvider } from "@servicebeard/providers";
import { describe, expect, mock, test } from "bun:test";
import { buildOutboundMultipartContent } from "./email-content-outbound";

function mockProvider(
  downloads: Record<string, { content: Buffer; contentType: string }>,
): IssueProvider {
  return {
    name: "github",
    downloadFile: mock(async (url: string) => downloads[url] ?? null),
  } as unknown as IssueProvider;
}

describe("buildOutboundMultipartContent", () => {
  test("inlines github html comment images via signed download overrides", async () => {
    const displayUrl = "https://github.com/user-attachments/assets/abc-123";
    const signedUrl =
      "https://private-user-images.githubusercontent.com/1/abc?jwt=token";
    const provider = mockProvider({
      [signedUrl]: {
        content: Buffer.from("fake-png"),
        contentType: "image/png",
      },
    });

    const intro = `Here is the fix:\n\n<img alt="screenshot" src="${displayUrl}" />`;
    const body = `${intro}\n\n---\nQuoted previous message with <img src="${displayUrl}" />`;
    const result = await buildOutboundMultipartContent(
      body,
      provider,
      { baseUrl: "https://github.com", projectId: "acme/app", token: "t" },
      {
        imageSource: intro,
        imageDownloadUrlOverrides: new Map([[displayUrl, signedUrl]]),
      },
    );

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]?.contentType).toBe("image/png");
    expect(result.html).toContain('src="cid:');
    expect(result.html).not.toContain(displayUrl);
    expect(result.text).toContain("[screenshot]");
    expect(result.text).not.toContain(displayUrl);
  });

  test("inlines gitlab upload markdown images as cid attachments", async () => {
    const imagePath = "/uploads/secret123/photo.png";
    const imageUrl = `https://gitlab.example.com${imagePath}`;
    const provider = mockProvider({
      [imageUrl]: {
        content: Buffer.from("fake-jpg"),
        contentType: "image/jpeg",
      },
    });

    const markdown = `Looks good\n\n![photo](${imagePath})`;
    const result = await buildOutboundMultipartContent(markdown, provider, {
      baseUrl: "https://gitlab.example.com",
      projectId: "1",
      token: "t",
    });

    expect(result.attachments).toHaveLength(1);
    expect(result.html).toContain('src="cid:');
    expect(result.text).toContain("[photo]");
    expect(result.text).not.toContain(imagePath);
  });
});
