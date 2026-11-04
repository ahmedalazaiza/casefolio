import { expect, test } from "@playwright/test";

test("home page renders Casefolio heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /casefolio/i })).toBeVisible();
});
