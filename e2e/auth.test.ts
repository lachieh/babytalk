import { test, expect } from "./fixtures/auth";
import { clearMailpit, getMessagesForEmail } from "./fixtures/mailpit";

test.describe("Magic link authentication", () => {
  test.beforeEach(async () => {
    await clearMailpit();
  });

  test("full sign-in flow: request link, receive email, verify, reach dashboard", async ({
    page,
    signInWithMagicLink,
    testEmail,
  }) => {
    await signInWithMagicLink(testEmail);

    // Should be on the dashboard after sign-in
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("login page shows email sent confirmation", async ({
    page,
    testEmail,
  }) => {
    await page.goto("/auth/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.getByText("Sign in with a magic link")).toBeVisible();

    await page.getByPlaceholder("you@example.com").fill(testEmail);
    await page.getByRole("button", { name: "Send magic link" }).click();

    // Confirmation screen
    await expect(page.getByText("Check your email")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(testEmail)).toBeVisible();
  });

  test("email is actually received in mailpit", async ({ page, testEmail }) => {
    await page.goto("/auth/login");
    await page.getByPlaceholder("you@example.com").fill(testEmail);
    await page.getByRole("button", { name: "Send magic link" }).click();
    await expect(page.getByText("Check your email")).toBeVisible({
      timeout: 10_000,
    });

    // Verify Mailpit actually received the email
    const messages = await getMessagesForEmail(testEmail);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[0].Subject).toContain("Sign in");
    expect(messages[0].To[0].Address).toBe(testEmail);
  });

  test("expired or invalid token shows error", async ({ page }) => {
    await page.goto("/auth/verify?token=00000000-0000-0000-0000-000000000000");

    await expect(page.getByText("Something went wrong")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
  });

  test("missing token shows error", async ({ page }) => {
    await page.goto("/auth/verify");

    await expect(page.getByText("Missing token")).toBeVisible({
      timeout: 5000,
    });
  });

  test("login page renders correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ height: 812, width: 375 });
    await page.goto("/auth/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();

    // Email input and submit button should be visible and usable
    const emailInput = page.getByPlaceholder("you@example.com");
    await expect(emailInput).toBeVisible();

    const submitButton = page.getByRole("button", {
      name: "Send magic link",
    });
    await expect(submitButton).toBeVisible();

    // Touch targets should be at least 44px tall
    const buttonBox = await submitButton.boundingBox();
    expect(buttonBox?.height).toBeGreaterThanOrEqual(44);

    const inputBox = await emailInput.boundingBox();
    expect(inputBox?.height).toBeGreaterThanOrEqual(44);
  });
});
