import { expect, test } from "@playwright/test";

test("home page renders Casefolio heading and toggles dark/light theme class", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Turn finished projects into publishable case studies",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Start free" }).first()).toBeVisible();

  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: "Toggle color theme" });
  const initialDark = await html.evaluate((el) => el.classList.contains("dark"));

  await toggle.click();
  await expect.poll(() => html.evaluate((el) => el.classList.contains("dark"))).toBe(!initialDark);
});
