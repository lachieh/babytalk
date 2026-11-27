import { expect, test } from "@playwright/test";

/* A device pairing through this instance is sent to a self-hosted one. The
 * "self-hosted" instance is this same one: its /.well-known/config is real.
 * The test plays the device, talking to the API directly. */

const API_URL = process.env.API_URL || "http://localhost:4000/graphql";

const gql = async <T>(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> => {
  const res = await fetch(API_URL, {
    body: JSON.stringify({ query, variables }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const json = (await res.json()) as { data: T; errors?: unknown[] };
  expect(json.errors).toBeUndefined();
  return json.data;
};

const requestCode = async () => {
  const data = await gql<{ requestDeviceCode: { code: string } }>(
    "mutation { requestDeviceCode { code } }"
  );
  return data.requestDeviceCode.code;
};

test.describe("Sending a device to your own server", () => {
  test("rejects an address that isn't Bubsie", async ({ page }) => {
    const code = await requestCode();
    await page.goto(`/auth/approve?code=${code}`);

    await page.getByRole("button", { name: "Using your own server?" }).click();
    const address = page.getByLabel("Your Bubsie address");
    await expect(address).toHaveValue("https://");
    await address.fill("http://127.0.0.1:9");
    await page.getByRole("button", { name: "Send device there" }).click();

    await expect(
      page.getByText("We couldn't find Bubsie at that address.")
    ).toBeVisible();
  });

  test("refuses this server's own address", async ({ page, baseURL }) => {
    const code = await requestCode();
    const here = new URL(baseURL ?? "http://localhost:3000").origin;
    await page.goto(`/auth/approve?code=${code}`);
    await page.getByRole("button", { name: "Using your own server?" }).click();
    await page.getByLabel("Your Bubsie address").fill(`${here}/somewhere`);
    await page.getByRole("button", { name: "Send device there" }).click();

    await expect(
      page.getByText("That's this server. Use the steps above instead.")
    ).toBeVisible();
  });

  test("waits for the device, then follows it", async ({ page, baseURL }) => {
    const code = await requestCode();
    // The same instance under another name: another origin to the page.
    const here = new URL(baseURL ?? "http://localhost:3000");
    here.hostname = here.hostname === "127.0.0.1" ? "localhost" : "127.0.0.1";
    const { origin } = here;
    await page.goto(`/auth/approve?code=${code}`);

    // No account here: the expander sits under "Sign in first".
    await expect(
      page.getByRole("heading", { name: "Sign in first" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Using your own server?" }).click();
    await page.getByLabel("Your Bubsie address").fill(`${origin}/anything`);
    await page.getByRole("button", { name: "Send device there" }).click();

    await expect(
      page.getByText(`Sending your device to ${new URL(origin).host}`)
    ).toBeVisible();

    // The device sees the redirect and confirms it has moved.
    const polled = await gql<{
      pollDeviceCode: { status: string; token: string | null; webUrl: string };
    }>(
      `mutation ($code: String!) {
        pollDeviceCode(code: $code) { status token webUrl }
      }`,
      { code }
    );
    expect(polled.pollDeviceCode).toStrictEqual({
      status: "redirected",
      token: null,
      webUrl: origin,
    });
    await gql(
      `mutation ($code: String!) { confirmDeviceCodeRedirect(code: $code) }`,
      { code }
    );

    await expect(page).toHaveURL(`${origin}/auth/approve?code=${code}`, {
      timeout: 10_000,
    });
  });
});
