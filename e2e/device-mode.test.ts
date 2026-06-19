import { test, expect } from "./fixtures/auth";

test.describe("Device mode persistence", () => {
  test("dashboard does NOT redirect to /station without the device-mode flag", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    await signedInWithBaby(testEmail);

    // Confirm no flag is set after a normal sign-in
    const flag = await page.evaluate(() =>
      localStorage.getItem("babytalk_device_mode")
    );
    expect(flag).toBeNull();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    // Dashboard hero heading
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });
  });

  test("dashboard redirects to /station when the device-mode flag is set", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    await signedInWithBaby(testEmail);

    await page.evaluate(() =>
      localStorage.setItem("babytalk_device_mode", "1")
    );

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/station$/, { timeout: 10_000 });
  });

  test("home page redirects logged-in device users to /station", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    await signedInWithBaby(testEmail);

    await page.evaluate(() =>
      localStorage.setItem("babytalk_device_mode", "1")
    );

    await page.goto("/");
    await expect(page).toHaveURL(/\/station$/, { timeout: 10_000 });
  });

  test("home page sends non-device logged-in users to /dashboard", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    await signedInWithBaby(testEmail);

    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test("magic-link sign-in clears a pre-existing device-mode flag", async ({
    page,
    signInWithMagicLink,
    testEmail,
  }) => {
    // Seed the flag on the origin BEFORE signing in
    await page.goto("/");
    await page.evaluate(() =>
      localStorage.setItem("babytalk_device_mode", "1")
    );

    await signInWithMagicLink(testEmail);

    const flag = await page.evaluate(() =>
      localStorage.getItem("babytalk_device_mode")
    );
    expect(flag).toBeNull();
  });

  test("/auth/device page is reachable without a token", async ({ page }) => {
    // The pairing entry point must work even on a fresh install
    await page.goto("/auth/device");
    await expect(page.getByText("Pair this device")).toBeVisible({
      timeout: 10_000,
    });
    // Pairing code (8 digits with a dash) renders inside the page
    await expect(page.getByText(/\d{4}-\d{4}/)).toBeVisible({
      timeout: 10_000,
    });
  });
});
