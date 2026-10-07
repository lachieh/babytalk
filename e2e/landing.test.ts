import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero content and CTA", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Shared baby tracking")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Log every feed in a single tap." })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Start tracking" }).first()
    ).toBeVisible();
  });

  test("CTA links to login page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Start tracking" }).first().click();
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
