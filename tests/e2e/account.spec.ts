import { expect, test } from "@playwright/test";
import { authenticateAs } from "./helpers";

test.describe("Account settings UI", () => {
  test("Account page renders linked sign-in methods", async ({ page }) => {
    await authenticateAs(page, "ownerA");
    await page.goto("/account");

    await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByText("Connected accounts")).toBeVisible();
    await expect(
      page.getByText(
        "Local sign-in (email, password, or passkey) is always available for this account.",
      ),
    ).toBeVisible();
  });
});
