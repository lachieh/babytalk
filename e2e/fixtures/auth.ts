import { test as base, expect } from "@playwright/test";

import { clearMailpit, extractMagicLinkToken } from "./mailpit";

const API_URL = process.env.API_URL || "http://localhost:4000/graphql";

interface BabySetup {
  babyId: string;
  householdId: string;
  token: string;
}

const CREATE_HOUSEHOLD = `
  mutation { createHousehold { id } }
`;

const ADD_BABY = `
  mutation AddBaby($name: String!, $birthDate: String!) {
    addBaby(name: $name, birthDate: $birthDate) { id }
  }
`;

async function gql<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(API_URL, {
    body: JSON.stringify({ query, variables }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0].message);
  }
  return json.data as T;
}

/**
 * Extended Playwright test fixture that provides magic-link authentication
 * helpers. Uses Mailpit (local SMTP catch-all) to intercept real emails
 * sent by the API and extract verification tokens.
 */
export const test = base.extend<{
  /** Sign in via magic link flow — requests link, intercepts email, verifies token */
  signInWithMagicLink: (email: string) => Promise<void>;
  /**
   * Sign in, then provision a household + baby via GraphQL so the dashboard
   * skips the setup redirect. Returns the bearer token and ids.
   */
  signedInWithBaby: (email: string) => Promise<BabySetup>;
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

  signedInWithBaby: async ({ page, signInWithMagicLink }, use) => {
    const setup = async (email: string): Promise<BabySetup> => {
      await signInWithMagicLink(email);

      const token = await page.evaluate(() =>
        localStorage.getItem("babytalk_token")
      );
      if (!token) {
        throw new Error("No babytalk_token after sign-in");
      }

      // The dashboard layout redirects to /dashboard/setup until both a
      // household and baby exist — provision them directly via GraphQL.
      const household = await gql<{ createHousehold: { id: string } }>(
        token,
        CREATE_HOUSEHOLD
      );
      const baby = await gql<{ addBaby: { id: string } }>(token, ADD_BABY, {
        birthDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
        name: "Test Baby",
      });

      return {
        babyId: baby.addBaby.id,
        householdId: household.createHousehold.id,
        token,
      };
    };

    await use(setup);
  },

  testEmail: async ({}, use) => {
    const id = Math.random().toString(36).slice(2, 10);
    await use(`test-${id}@babytalk.test`);
  },
});

export { expect };
