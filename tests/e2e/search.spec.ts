import { expect, test } from "@playwright/test";
import { E2E_TEAMS } from "./fixtures/constants";
import { authenticateAs, seed } from "./helpers";

test.describe("Global search UI", () => {
  test("Search returns only resources from the signed-in user's teams", async ({
    page,
  }) => {
    const data = seed();
    await authenticateAs(page, "memberA");

    await page.goto(`/teams/${data.teams.teamA.id}/projects`);
    await page.getByRole("button", { name: /Search/ }).click();

    const searchDialog = page.getByRole("dialog", { name: "Search" });
    const searchInput = searchDialog.getByPlaceholder(
      "Search pages, teams, projects, conversations…",
    );
    await expect(searchInput).toBeVisible();
    await searchInput.fill("E2E Team");

    await expect(
      searchDialog.getByRole("button", { name: /E2E Team A/i }).first(),
    ).toBeVisible();
    await expect(
      searchDialog.getByText(E2E_TEAMS.teamB.name),
    ).not.toBeVisible();
  });
});
