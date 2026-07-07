import { describe, expect, test } from "bun:test";

describe("auth providers", () => {
  test("infers provider type from external subject", async () => {
    const { inferProviderFromExternalSub, isRedirectProvider } =
      await import("./providers");

    expect(inferProviderFromExternalSub("github:123")).toBe("github");
    expect(inferProviderFromExternalSub("gitlab:456")).toBe("gitlab");
    expect(inferProviderFromExternalSub("linear:789")).toBe("linear");
    expect(inferProviderFromExternalSub("local:user@example.com")).toBe(
      "local",
    );
    expect(inferProviderFromExternalSub("auth0|abc")).toBe("oidc");

    expect(isRedirectProvider("github")).toBe(true);
    expect(isRedirectProvider("local")).toBe(false);
  });
});
