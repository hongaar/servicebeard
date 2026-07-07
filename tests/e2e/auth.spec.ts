import { expect, test } from "@playwright/test";
import { E2E_USERS } from "./fixtures/constants";
import { seed } from "./helpers";

test.describe("Authentication UI flow", () => {
  test("Local email/password login redirects to dashboard and logout returns to login", async ({
    page,
  }) => {
    const data = seed();

    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: /ServiceBeard/i }),
    ).toBeVisible();

    const emailEntry = page.getByRole("button", { name: "Sign in with email" });
    if (await emailEntry.isVisible()) {
      await emailEntry.click();
    }

    await page.locator('input[type="email"]').fill(data.users.memberA.email);
    await page.locator('input[type="password"]').fill(data.password);
    await page
      .locator("form")
      .getByRole("button", { name: "Sign in", exact: true })
      .click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Teams", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(E2E_USERS.memberA.email)).toBeVisible();

    await page.getByRole("button", { name: E2E_USERS.memberA.name }).click();
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL("/login");
  });
});
