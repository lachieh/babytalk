import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero content and CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("For tired parents")).toBeVisible();
    await expect(page.getByRole("heading", { name: "BabyTalk" })).toBeVisible();
    await expect(
      page.getByText("Track feeds, sleep, and diapers")
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  });

  test("CTA links to login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Get started" }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("mobile viewport renders without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/");

    const body = page.locator("body");
    const bodyBox = await body.boundingBox();
    // No horizontal scrollbar — body should not exceed viewport width
    expect(bodyBox?.width).toBeLessThanOrEqual(375);
  });
});
