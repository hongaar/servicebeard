import { expect, test } from "@playwright/test";
import {
  E2E_PROJECTS,
  E2E_RULES,
  E2E_TEAMS,
  E2E_THREAD,
} from "./fixtures/constants";
import { authenticateAs, seed } from "./helpers";

test.describe("Projects and resources UI flow", () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAs(page, "adminA");
  });

  test("Admin can view seeded team projects, rules, and conversation threads", async ({
    page,
  }) => {
    const data = seed();

    await page.goto("/");
    await expect(page.getByText(E2E_TEAMS.teamA.name)).toBeVisible();
    await page.getByRole("link", { name: E2E_TEAMS.teamA.name }).click();

    await expect(page).toHaveURL(
      new RegExp(`/teams/${data.teams.teamA.id}/projects`),
    );
    await expect(page.getByText(E2E_PROJECTS.projectA.name)).toBeVisible();
    await page
      .getByRole("link", { name: `Open ${E2E_PROJECTS.projectA.name}` })
      .click();

    await expect(page).toHaveURL(
      new RegExp(
        `/teams/${data.teams.teamA.id}/projects/${data.projects.projectA.id}`,
      ),
    );

    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Rules", exact: true })
      .click();
    await expect(page.getByText(E2E_RULES.ruleA.name)).toBeVisible();

    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Conversations", exact: true })
      .click();
    await expect(
      page.getByText(E2E_THREAD.threadA.subjectNormalized),
    ).toBeVisible();
  });

  test("Admin can create a new team from the dashboard", async ({ page }) => {
    const teamName = `E2E UI Team ${Date.now()}`;

    await page.goto("/");
    await page.getByRole("button", { name: "Create team" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox").fill(teamName);
    await dialog
      .getByRole("button", { name: "Create team", exact: true })
      .click();

    await expect(
      page.getByRole("heading", { name: "Projects", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(teamName)).toBeVisible();
  });
});
