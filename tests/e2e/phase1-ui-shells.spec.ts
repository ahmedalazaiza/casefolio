import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 375, height: 812, label: "375px-mobile" },
  { width: 768, height: 1024, label: "768px-tablet" },
  { width: 1440, height: 900, label: "1440px-desktop" },
] as const;

for (const vp of VIEWPORTS) {
  test(`shells and /dev/ui render without horizontal overflow at ${vp.label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });

    for (const route of ["/dev/ui", "/", "/dashboard", "/admin"]) {
      await page.goto(route);
      await expect(page.locator("h1").first()).toBeVisible();

      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasOverflow, `Horizontal overflow on ${route} at ${vp.label}`).toBe(false);
    }
  });
}

test("keyboard accessibility: skip link and mobile navigation drawer work via keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/dashboard");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();

  const drawerButton = page.getByRole("button", { name: "Open workspace navigation" });
  await drawerButton.focus();
  await page.keyboard.press("Enter");

  const mobileNav = page.getByRole("navigation", { name: "Mobile workspace navigation" });
  await expect(mobileNav).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(mobileNav).toBeHidden();
});
