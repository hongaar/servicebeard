import { expect, test } from "@playwright/test";
import { E2E_TEAMS } from "./fixtures/constants";
import { authenticateAs, seed } from "./helpers";

test.describe("UI access control", () => {
  test("Member sees only their teams on dashboard", async ({ page }) => {
    await authenticateAs(page, "memberA");
    await page.goto("/");

    await expect(page.getByText(E2E_TEAMS.teamA.name)).toBeVisible();
    await expect(page.getByText(E2E_TEAMS.teamB.name)).not.toBeVisible();
  });

  test("Member cannot access another team's URL directly", async ({ page }) => {
    const data = seed();
    await authenticateAs(page, "memberA");

    await page.goto(`/teams/${data.teams.teamB.id}/projects`);

    await expect(
      page.getByRole("heading", { name: "Access denied" }),
    ).toBeVisible();
  });
});
