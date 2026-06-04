import { test, expect } from "./fixtures/auth";

const API_URL = process.env.API_URL || "http://localhost:4000/graphql";

const CREATE_HOUSEHOLD = `mutation { createHousehold { id } }`;
const ADD_BABY = `
  mutation AddBaby($name: String!, $birthDate: String!) {
    addBaby(name: $name, birthDate: $birthDate) { id }
  }
`;

async function provisionBaby(token: string): Promise<void> {
  const post = (query: string, variables?: Record<string, unknown>) =>
    fetch(API_URL, {
      body: JSON.stringify({ query, variables }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }).then(async (r) => {
      const json = await r.json();
      if (json.errors) {
        throw new Error(json.errors[0].message);
      }
      return json.data;
    });

  await post(CREATE_HOUSEHOLD);
  await post(ADD_BABY, {
    birthDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    name: "Test Baby",
  });
}

test.describe("Profile sheet — overflow handling", () => {
  test("close button stays visible on a short viewport", async ({
    page,
    signInWithMagicLink,
    testEmail,
  }) => {
    await signInWithMagicLink(testEmail);
    const token = await page.evaluate(() =>
      localStorage.getItem("babytalk_token")
    );
    if (!token) throw new Error("No token after sign-in");
    await provisionBaby(token);

    // Force a short viewport so the profile sheet content overflows.
    await page.setViewportSize({ height: 500, width: 375 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Settings" }).click();

    const sheet = page.getByRole("dialog", { name: "Profile" });
    await expect(sheet).toBeVisible();

    const closeButton = sheet.getByRole("button", { name: "Close profile" });

    // The close button must be visible AND fully inside the viewport — not
    // pushed off the top of the screen by overlong content.
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeInViewport({ ratio: 1 });

    // The sheet itself must not extend above the top of the viewport.
    const sheetBox = await sheet.boundingBox();
    expect(sheetBox).not.toBeNull();
    expect(sheetBox!.y).toBeGreaterThanOrEqual(0);

    // Clicking close dismisses the sheet.
    await closeButton.click();
    await expect(sheet).toBeHidden({ timeout: 5000 });
  });

  test("close button is reachable after scrolling profile content", async ({
    page,
    signInWithMagicLink,
    testEmail,
  }) => {
    await signInWithMagicLink(testEmail);
    const token = await page.evaluate(() =>
      localStorage.getItem("babytalk_token")
    );
    if (!token) throw new Error("No token after sign-in");
    await provisionBaby(token);

    await page.setViewportSize({ height: 500, width: 375 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Settings" }).click();
    const sheet = page.getByRole("dialog", { name: "Profile" });
    await expect(sheet).toBeVisible();

    // Scroll the sheet's interior all the way down. The body of the sheet
    // is the first scrollable descendant; the header containing the close
    // button is a sibling and should not scroll with it.
    await sheet.evaluate((el) => {
      const scroller = el.querySelector<HTMLElement>(".overflow-y-auto");
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });

    // Close button is still pinned in the header — visible, in viewport,
    // and clickable.
    const closeButton = sheet.getByRole("button", { name: "Close profile" });
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toBeInViewport({ ratio: 1 });

    await closeButton.click();
    await expect(sheet).toBeHidden({ timeout: 5000 });
  });

  test("sheet fits within the viewport on a typical mobile size", async ({
    page,
    signInWithMagicLink,
    testEmail,
  }) => {
    await signInWithMagicLink(testEmail);
    const token = await page.evaluate(() =>
      localStorage.getItem("babytalk_token")
    );
    if (!token) throw new Error("No token after sign-in");
    await provisionBaby(token);

    // iPhone SE-ish — height where overflow used to happen.
    await page.setViewportSize({ height: 667, width: 375 });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Settings" }).click();
    const sheet = page.getByRole("dialog", { name: "Profile" });
    await expect(sheet).toBeVisible();

    const sheetBox = await sheet.boundingBox();
    const viewport = page.viewportSize();
    expect(sheetBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    // Sheet top edge must sit at or below the viewport top.
    expect(sheetBox!.y).toBeGreaterThanOrEqual(0);
    // Sheet bottom must not extend past the viewport bottom.
    expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(
      viewport!.height + 1
    );
  });
});
