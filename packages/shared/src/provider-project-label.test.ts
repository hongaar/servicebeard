import { describe, expect, test } from "bun:test";

describe("provider project labels", () => {
  test("formats linear team and project ids for display", async () => {
    const { formatProviderProjectLabel } = await import("@servicebeard/shared");

    expect(
      formatProviderProjectLabel(
        "linear",
        "project:hongaar/servicebeard-support-f0a3393752bf",
      ),
    ).toEqual({
      kind: "project",
      workspace: "hongaar",
      label: "hongaar/servicebeard-support",
    });

    expect(formatProviderProjectLabel("linear", "team:hongaar/SB")).toEqual({
      kind: "team",
      workspace: "hongaar",
      label: "hongaar/SB",
    });

    expect(formatProviderProjectLabel("linear", "SB")).toEqual({
      kind: "team",
      label: "SB",
    });

    expect(formatProviderProjectLabel("github", "acme/support")).toEqual({
      label: "acme/support",
    });
  });
});
