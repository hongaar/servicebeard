import { describe, expect, test } from "bun:test";

describe("global search", () => {
  test("filterSearchActions matches labels and keywords", async () => {
    const { buildSearchActions, filterSearchActions } =
      await import("./globalSearch");

    const actions = buildSearchActions({
      teamId: "team-1",
      projectId: "project-1",
      isAdmin: true,
    });

    expect(
      filterSearchActions(actions, "templates").some(
        (a) => a.label === "Templates",
      ),
    ).toBe(true);
    expect(
      filterSearchActions(actions, "help").some((a) => a.group === "Help"),
    ).toBe(true);
    expect(
      filterSearchActions(actions, "health").some(
        (a) => a.label === "System health",
      ),
    ).toBe(true);
    expect(
      filterSearchActions(actions, "admin").every((a) =>
        [
          "Admin overview",
          "System health",
          "Project status",
          "Audit log",
          "Job runs",
        ].includes(a.label)
          ? a.group === "Admin"
          : true,
      ),
    ).toBe(true);
  });

  test("groupSearchResults preserves group order", async () => {
    const { groupSearchResults } = await import("./globalSearchResults");

    const groups = groupSearchResults([
      {
        id: "1",
        label: "Teams",
        group: "Teams",
        kind: "navigate",
        to: "/",
      },
      {
        id: "2",
        label: "Projects",
        group: "Navigation",
        kind: "navigate",
        to: "/",
      },
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Navigation", "Teams"]);
  });
});
