import { test, expect } from "./fixtures/auth";

const RECENT_EVENTS = `
  query Recent($babyId: String!) {
    recentEvents(babyId: $babyId, limit: 5) {
      id type startedAt endedAt metadata
    }
  }
`;

async function fetchRecentEvents(
  token: string,
  babyId: string
): Promise<{ endedAt: string | null; metadata: string; type: string }[]> {
  const apiUrl = process.env.API_URL || "http://localhost:4000/graphql";
  const res = await fetch(apiUrl, {
    body: JSON.stringify({ query: RECENT_EVENTS, variables: { babyId } }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const json = await res.json();
  return json.data.recentEvents;
}

test.describe("Feed timer flow (suggestion zone)", () => {
  test("bottle feed starts a timer, then prompts for ounces on stop", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    const { babyId, token } = await signedInWithBaby(testEmail);

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    // Default variant for a brand-new baby is "Breast · Left". Switch to Bottle.
    await page.getByRole("button", { name: /Breast · Left/i }).click();
    await page.getByRole("button", { name: "Bottle", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Bottle", exact: true })
    ).toBeVisible();

    // Tap the main feed button — should START a timer (not show amount input)
    await page.getByRole("button", { name: /^feed$/i }).click();

    // Active timer should render with a Done button and 0:00 elapsed.
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible({
      timeout: 5000,
    });
    // No amount input yet — should not see oz/ml toggle while timer is running
    await expect(
      page.getByRole("button", { name: "oz", exact: true })
    ).toHaveCount(0);

    // Verify backend has an open feed event (endedAt is null)
    {
      const events = await fetchRecentEvents(token, babyId);
      const openFeed = events.find(
        (e) => e.type === "feed" && e.endedAt === null
      );
      expect(openFeed).toBeDefined();
      const meta = JSON.parse(openFeed!.metadata);
      expect(meta.method).toBe("bottle");
      expect(meta.amountMl).toBeUndefined();
    }

    // Stop the timer — now we should see the amount prompt
    await page.getByRole("button", { name: "Done" }).click();

    await expect(
      page.getByRole("button", { name: "oz", exact: true })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

    // Enter 4 oz and save
    await page.getByPlaceholder(/oz|ml/).fill("4");
    await page.getByRole("button", { name: "Save" }).click();

    // The amount input collapses — feed button should be visible again
    await expect(page.getByRole("button", { name: /^feed$/i })).toBeVisible({
      timeout: 5000,
    });

    // Verify backend now has a completed feed with amountMl
    {
      const events = await fetchRecentEvents(token, babyId);
      const completed = events.find(
        (e) => e.type === "feed" && e.endedAt !== null
      );
      expect(completed).toBeDefined();
      const meta = JSON.parse(completed!.metadata);
      expect(meta.method).toBe("bottle");
      // 4 oz ≈ 118 ml (29.5735 ml per oz, rounded)
      expect(meta.amountMl).toBeGreaterThan(100);
      expect(meta.amountMl).toBeLessThan(130);
    }
  });

  test("breast feed starts a timer with no ounces prompt on stop", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    const { babyId, token } = await signedInWithBaby(testEmail);

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    // Default is "Breast · Left" — just tap feed
    await page.getByRole("button", { name: /^feed$/i }).click();

    await expect(page.getByRole("button", { name: "Done" })).toBeVisible({
      timeout: 5000,
    });

    await page.getByRole("button", { name: "Done" }).click();

    // Should NOT prompt for ounces (no Save button, no oz toggle)
    await expect(page.getByRole("button", { name: /^feed$/i })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: "oz", exact: true })
    ).toHaveCount(0);

    const events = await fetchRecentEvents(token, babyId);
    const feed = events.find((e) => e.type === "feed");
    expect(feed).toBeDefined();
    expect(feed!.endedAt).not.toBeNull();
    const meta = JSON.parse(feed!.metadata);
    expect(meta.method).toBe("breast");
    expect(meta.amountMl).toBeUndefined();
  });
});

test.describe("Feed event editor", () => {
  test("editor shows Start and End fields for a bottle feed", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    await signedInWithBaby(testEmail);

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    // Switch to Bottle and start a feed
    await page.getByRole("button", { name: /Breast · Left/i }).click();
    await page.getByRole("button", { name: "Bottle", exact: true }).click();
    await page.getByRole("button", { name: /^feed$/i }).click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible({
      timeout: 5000,
    });
    // Stop + submit ounces so the event ends up in the timeline
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByPlaceholder(/oz|ml/).fill("3");
    await page.getByRole("button", { name: "Save" }).click();

    // Open the event from the recent-logs timeline
    await page
      .getByRole("heading", { name: "Recent Logs" })
      .scrollIntoViewIfNeeded();
    // Timeline rows are at the bottom of the page; the variant dropdown also
    // contains "Bottle" so .last() reliably picks the timeline row.
    await page.locator('button:has-text("Bottle")').last().click();

    // The editor sheet opens; both Started and Ended fields should appear
    await expect(page.getByText("Edit entry")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Started", { exact: true })).toBeVisible();
    await expect(page.getByText("Ended", { exact: true })).toBeVisible();
  });

  test("editor shows Start and End fields when changing method to Bottle on a new entry", async ({
    page,
    signedInWithBaby,
    testEmail,
  }) => {
    await signedInWithBaby(testEmail);

    // Navigate to the history list where adding events is possible. Failing
    // that, this is also exercised by the editor's default flow — kept here
    // as a smoke check that the duration UI is visible regardless of method.
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Log Activity" })
    ).toBeVisible({ timeout: 10_000 });

    // Create one event so the timeline isn't empty, then open it
    await page.getByRole("button", { name: /^feed$/i }).click();
    await expect(page.getByRole("button", { name: "Done" })).toBeVisible({
      timeout: 5000,
    });
    await page.getByRole("button", { name: "Done" }).click();

    // Click the breast feed in the timeline (variant dropdown also shows
    // "Breast" — .last() picks the timeline row below it).
    await page.locator('button:has-text("Breast")').last().click();
    await expect(page.getByText("Edit entry")).toBeVisible({ timeout: 5000 });

    // Switch method to Bottle and confirm duration fields stay
    await page.getByLabel("Method").selectOption("bottle");
    await expect(page.getByText("Started", { exact: true })).toBeVisible();
    await expect(page.getByText("Ended", { exact: true })).toBeVisible();

    // Switch to Solid and confirm duration fields still show
    await page.getByLabel("Method").selectOption("solid");
    await expect(page.getByText("Started", { exact: true })).toBeVisible();
    await expect(page.getByText("Ended", { exact: true })).toBeVisible();
  });
});
