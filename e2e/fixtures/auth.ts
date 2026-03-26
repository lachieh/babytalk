import { test as base, expect } from "@playwright/test";

import { clearMailpit, extractMagicLinkToken } from "./mailpit";

/**
 * Extended Playwright test fixture that provides magic-link authentication
 * helpers. Uses Mailpit (local SMTP catch-all) to intercept real emails
 * sent by the API and extract verification tokens.
 */
export const test = base.extend<{
  /** Sign in via magic link flow — requests link, intercepts email, verifies token */
  signInWithMagicLink: (email: string) => Promise<void>;
  /** Generate a unique test email for isolation between test runs */
  testEmail: string;
}>({
  signInWithMagicLink: async ({ page }, use) => {
    const signIn = async (email: string) => {
      // Clear previous emails
      await clearMailpit();

      // Navigate to login
      await page.goto("/auth/login");
      await page.getByPlaceholder("you@example.com").fill(email);
      await page.getByRole("button", { name: "Send magic link" }).click();

      // Wait for "Check your email" confirmation
      await expect(page.getByText("Check your email")).toBeVisible({
        timeout: 10_000,
      });

      // Intercept the email and extract the magic link token
      const { token } = await extractMagicLinkToken(email);

      // Navigate directly to the verification URL
      await page.goto(`/auth/verify?token=${token}`);

      // Wait for redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    };

    await use(signIn);
  },

  testEmail: async ({}, use) => {
    const id = Math.random().toString(36).slice(2, 10);
    await use(`test-${id}@babytalk.test`);
  },
});

export { expect };
