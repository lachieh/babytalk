// Pairing through one Bubsie ("bubsie.app", A) to a self-hosted one (B), with the phone side driven
// in Chrome through A's approve page; then B rejecting the device's refresh token. Each run gets
// fresh databases (bubsie-servers.ts). Run with scripts/emulator-test.sh against a build whose web
// URL is A:
//   BUBSIE_WEB_URL=http://$BUBSIE_HOST:$BUBSIE_WEB_PORT scripts/build.sh
// BUBSIE_OLD_API: a checkout from before redirects (e.g. dd52dbd) with apps/api/dist built, for the
// "old server" fallback; without it that test is skipped.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

import type { Browser, Page } from "@playwright/test";

import {
  approve,
  gql,
  magicToken,
  mailIds,
  newFamily,
  recentEvents,
  signIn,
} from "./bubsie-api.ts";
import { Device } from "./bubsie-device.ts";
import { Instance, ports } from "./bubsie-servers.ts";

const SCREENS = process.env.BUBSIE_SCREENS ?? "screens";
const OLD_API = process.env.BUBSIE_OLD_API;
const { chromium } = createRequire(
  path.join(process.env.BUBSIE_REPO ?? "", "package.json")
)("@playwright/test") as typeof import("@playwright/test");

let a: Instance;
let b: Instance;
let old: Instance | undefined;
let browser: Browser;

before(async () => {
  [a, b, old] = await Promise.all([
    Instance.start({ name: "bubsie_fw_a", ...ports(0) }),
    Instance.start({ name: "bubsie_fw_b", ...ports(1) }),
    OLD_API
      ? Instance.start({
          name: "bubsie_fw_old",
          ...ports(2),
          apiCheckout: OLD_API,
        })
      : undefined,
  ]);
  browser = await chromium.launch({
    channel: process.env.BUBSIE_CHROME_CHANNEL ?? "chrome",
  });
});

after(async () => {
  await browser?.close();
  await Promise.all([a?.stop(), b?.stop(), old?.stop()]);
});

/** Boot a new device, join the emulator's network, keep UTC, and return the code it shows. */
async function toPairing(device: Device): Promise<string> {
  await device.waitFor(/screen: wifi-list/, 40);
  await device.run(0.5);
  await device.tapLabel("emulator");
  await device.waitFor(/screen: timezone/, 40);
  await device.run(0.5);
  await device.tap(233, 392);
  await device.waitFor(/screen: pairing/, 30);
  return (await device.waitFor(/app: pair: code ([A-Z0-9]{8})/, 30))[1]!;
}

/** On the phone: open A's approve page for `code` and send the device to `to`. */
async function sendDevice(
  page: Page,
  code: string,
  to: Instance
): Promise<void> {
  await page.goto(`${a.webUrl}/auth/approve?code=${code}`);
  await page.getByRole("heading", { name: "Sign in first" }).waitFor();
  await page.getByRole("button", { name: "Using your own server?" }).click();
  await page.getByLabel("Your Bubsie address").fill(to.webUrl);
  await page.getByRole("button", { name: "Send device there" }).click();
  await page.getByText(`Sending your device to ${to.host}`).waitFor();
}

function deviceCode(instance: Instance, code: string): Record<string, string> {
  const [row] = instance.sql(
    `SELECT approved_at IS NOT NULL, consumed_at IS NOT NULL, user_id IS NOT NULL, coalesce(redirect_web_url, ''), redirect_confirmed_at IS NOT NULL FROM device_codes WHERE code = '${code}'`
  );
  assert.ok(row, `${code} is not in ${instance.options.name}`);
  const [approved, consumed, user, redirect, confirmed] = row.split("\t");
  return {
    approved: approved!,
    consumed: consumed!,
    user: user!,
    redirect: redirect!,
    confirmed: confirmed!,
  };
}

const count = (instance: Instance, table: string) =>
  Number(instance.sql(`SELECT count(*) FROM ${table}`)[0]);

const escape = (text: string) => text.replaceAll(".", "\\.");

const occurrences = (device: Device, pattern: RegExp) =>
  device.board.serial.match(new RegExp(pattern.source, "g"))?.length ?? 0;

test("pairs with a self-hosted server through bubsie.app, then signs out when it rejects the refresh token", async () => {
  // The person has an account on B only.
  const family = await newFamily(["Ada"], b.apiUrl);
  const ada = family.babies[0]!;
  const device = await Device.boot({ network: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    const code = await toPairing(device);
    await device.find(`Server: ${a.host}`);
    await device.run(0.8);
    device.screenshot(SCREENS, "31-redirect-pairing-on-a");

    // On the phone, on A, before signing in: "Using your own server?" with B's address.
    await sendDevice(page, code, b);
    // The device takes the code to B, tells A, and from then on belongs to B.
    await device.waitFor(
      new RegExp(
        `app: pair: ${b.apiUrl} -> 200 \\{"data":\\{"requestDeviceCode":\\{"code":"${code}"`
      ),
      20
    );
    await device.waitFor(
      new RegExp(
        `app: pair: ${a.apiUrl} -> 200 \\{"data":\\{"confirmDeviceCodeRedirect":true\\}`
      ),
      20
    );
    await device.waitFor(
      new RegExp(`app: pair: server is now ${b.webUrl}\\b`),
      10
    );
    await device.find(`Server: ${b.host}`);
    await device.run(0.8);
    device.screenshot(SCREENS, "32-redirect-pairing-on-b");
    // The phone follows to B's approve page, for the same code.
    await page.waitForURL(`${b.webUrl}/auth/approve?code=${code}`, {
      timeout: 15_000,
    });

    // Sign in on B and approve there.
    await page.getByRole("button", { name: "Sign in" }).click();
    const seen = await mailIds(family.email);
    await page.getByPlaceholder("you@example.com").fill(family.email);
    await page.getByRole("button", { name: "Send magic link" }).click();
    await page.getByText("Check your email").waitFor();
    await page.goto(
      `${b.webUrl}/auth/verify?token=${await magicToken(family.email, seen)}`
    );
    await page
      .getByRole("heading", { name: "Device signed in" })
      .waitFor({ timeout: 15_000 });
    await device.waitFor(/app: pair: approved/, 20);
    await device.waitFor(/sync: babies: 1/, 20);
    await device.waitFor(/screen: station/, 10);

    // A sent the device on and never signed it in: no approval, no tokens, no sessions.
    assert.deepEqual(deviceCode(a, code), {
      approved: "f",
      consumed: "f",
      user: "f",
      redirect: b.webUrl,
      confirmed: "t",
    });
    assert.equal(count(a, "refresh_sessions"), 0);
    assert.equal(count(a, "users"), 0);
    assert.deepEqual(deviceCode(b, code), {
      approved: "t",
      consumed: "t",
      user: "t",
      redirect: "",
      confirmed: "f",
    });

    // A log on the device reaches B, and only B.
    await device.tapLabel("Feed");
    await device.waitFor(
      /sync: log feed \{"method":"breast","side":"left"\}: ok/,
      5
    );
    await device.waitFor(/sync: sent create/, 20);
    const events = await recentEvents(ada.id, family.token, b.apiUrl);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, "feed");
    assert.equal(count(a, "events"), 0);
    await device.run(6);
    device.screenshot(SCREENS, "33-redirect-station-on-b");

    // B is the device's server across a restart.
    for (let i = 0; i < 3; i++) await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page settings/, 5);
    await device.tapLabel("Settings");
    await device.waitFor(/screen: settings/, 5);
    await device.tapLabel("Restart");
    assert.equal(
      (await device.waitFor(/settings: server (\S+),/, 30))[1],
      b.webUrl
    );
    await device.waitFor(/sync: events: 1/, 60);

    // B rotates its JWT secret: the access token stops working, the refresh token still does.
    await b.rotateJwtSecret();
    await device.waitFor(/api: refresh: ok/, 40);
    await device.waitFor(/sync: events: 1/, 20);

    // B revokes the session (and the access token goes with another rotation): the device signs out
    // to pairing, on B, once.
    b.sql(
      "UPDATE refresh_sessions SET revoked_at = now() WHERE revoked_at IS NULL"
    );
    await b.rotateJwtSecret();
    await device.waitFor(/api: refresh: rejected/, 40);
    await device.waitFor(/app: signed out by the server/, 5);
    await device.waitFor(
      /app: pair: notice This device was signed out\. Pair it again\./,
      20
    );
    const again = (
      await device.waitFor(/app: pair: code ([A-Z0-9]{8})/, 30)
    )[1]!;
    assert.notEqual(again, code);
    assert.equal(deviceCode(b, again).consumed, "f", "the new code is B's");
    await device.find(`Server: ${b.host}`);
    const toA = new RegExp(`app: pair: ${escape(a.apiUrl)}`);
    const refreshes = occurrences(device, /api: refresh: /);
    const askedA = occurrences(device, toA);
    await device.run(20); // pairing polls; nothing refreshes or signs out again
    assert.equal(occurrences(device, /app: signed out by the server/), 1);
    assert.equal(occurrences(device, /api: refresh: /), refreshes);
    assert.equal(occurrences(device, toA), askedA, "pairing again stays on B");
    device.screenshot(SCREENS, "34-signed-out-pairing-on-b");

    // And it pairs again on B.
    assert.equal(
      await approve(again, await signIn(family.email, b.apiUrl), b.apiUrl),
      true
    );
    await device.waitFor(/app: pair: approved/, 20);
    await device.waitFor(/sync: babies: 1/, 20);
    assert.equal(occurrences(device, /panic/), 0);
  } catch (error) {
    const file = path.join(tmpdir(), "bubsie-phone.png");
    await page.screenshot({ path: file }).catch(() => {});
    throw new Error(`${String(error)} (phone: ${file} at ${page.url()})`, {
      cause: error,
    });
  } finally {
    await context.close();
    await device.close();
  }
});

/** A device sent to `to`, which cannot take its code, says why and pairs on A instead. */
async function fallsBack(
  to: Instance,
  notice: RegExp,
  screen: string,
  takeFirst = false
): Promise<void> {
  const device = await Device.boot({ network: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    const code = await toPairing(device);
    if (takeFirst) {
      await gql(
        "mutation($code: String) { requestDeviceCode(code: $code) { code } }",
        { code },
        undefined,
        to.apiUrl
      );
    }
    await sendDevice(page, code, to);
    await device.waitFor(
      /app: pair: \S+ -> 200 \{"data":\{"pollDeviceCode":\{"status":"redirected"/,
      20
    );
    await device.waitFor(notice, 20);
    const fresh = (
      await device.waitFor(/app: pair: code ([A-Z0-9]{8})/, 20)
    )[1]!;
    assert.notEqual(fresh, code);
    await device.find(`Server: ${a.host}`);
    await device.run(0.8);
    device.screenshot(SCREENS, screen);
    assert.equal(occurrences(device, /pair: server is now/), 0);
    // A sent the old code on and never heard it arrived.
    assert.equal(deviceCode(a, code).confirmed, "f");

    // It pairs on A.
    const family = await newFamily(["Ada"], a.apiUrl);
    assert.equal(await approve(fresh, family.token, a.apiUrl), true);
    await device.waitFor(/app: pair: approved/, 20);
    await device.waitFor(/sync: babies: 1/, 20);
  } finally {
    await context.close();
    await device.close();
  }
}

test("falls back to bubsie.app when the self-hosted server already has the code", async () => {
  await fallsBack(
    b,
    new RegExp(
      `app: pair: notice ${escape(b.host)} already has a device using this code\\. Pair with ${escape(a.host)} instead\\.`
    ),
    "35-redirect-code-taken",
    true
  );
});

test(
  "falls back to bubsie.app when the self-hosted server predates redirects",
  { skip: !OLD_API },
  async () => {
    await fallsBack(
      old!,
      new RegExp(
        `app: pair: notice ${escape(old!.host)} can't take over pairing yet\\. Pair with ${escape(a.host)} instead\\.`
      ),
      "36-redirect-old-server"
    );
  }
);
