// Boots the Bubsie firmware in the emulator and walks its screens, saving each to docs/screens/.
// Run with apps/firmware/scripts/emulator-test.sh against a build whose web URL is a local Bubsie
// (BUBSIE_WEB_URL=http://<this machine>:3417 scripts/build.sh).
import assert from "node:assert/strict";
import { test } from "node:test";

import { approve, newFamily } from "./bubsie-api.ts";
import { Device } from "./bubsie-device.ts";

const SCREENS = process.env.BUBSIE_SCREENS ?? "screens";

test("sets up from new: splash, Wi-Fi, time zone, pairing", async () => {
  const family = await newFamily(["Ada", "Theo"]);
  const device = await Device.boot("bubsie", { network: true });
  try {
    await device.waitFor(/screen: splash/, 10);
    await device.run(1.5);
    device.screenshot(SCREENS, "01-splash");
    const [r, g, b] = device.rgb(233, 20);
    assert.ok(
      r > 200 && g > 200 && b > 180,
      `the day background is the web's surface, not ${r},${g},${b}`
    );

    // A new device has no network saved: it scans and lists what is in range.
    await device.waitFor(/screen: wifi-scanning/, 10);
    await device.run(0.3);
    device.screenshot(SCREENS, "02-wifi-scanning");
    await device.waitFor(/wifi: +emulator -?\d+/, 20);
    await device.waitFor(/screen: wifi-list/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "03-wifi-list");

    // The emulator's network is open, so a tap joins it without a password.
    await device.tap(233, 140);
    await device.waitFor(/wifi: joining emulator/, 5);
    await device.waitFor(/wifi: address 10\.0\.2\.\d+/, 20);

    // The API has no time zone, so the device asks once.
    await device.waitFor(/screen: timezone/, 10);
    await device.run(0.5);
    device.screenshot(SCREENS, "04-timezone");
    // Drag the list up a long way (east of UTC), then continue.
    await device.swipe([233, 300], [233, 120], 0.4);
    await device.swipe([233, 300], [233, 120], 0.4);
    await device.run(1);
    device.screenshot(SCREENS, "05-timezone-picked");
    await device.tap(233, 392);
    const zone = (await device.waitFor(/app: time zone (\S+)/, 5))[1];
    assert.notEqual(zone, "UTC");

    // Pairing: a code from the server, shown as a QR code and as XXXX-XXXX.
    await device.waitFor(/screen: pairing/, 30);
    const code = (
      await device.waitFor(/app: pair: code ([A-Z0-9]{8})/, 30)
    )[1]!;
    // The clock comes from SNTP, in the zone just picked.
    await device.waitFor(/app: clock set, \d+:\d\d [ap]m \S+/, 30);
    await device.run(0.8);
    device.screenshot(SCREENS, "06-pairing");
    assert.equal(await approve(code, family.token), true);
    await device.waitFor(/app: pair: approved/, 20);
    await device.run(0.5);
    device.screenshot(SCREENS, "07-paired");
    assert.equal(
      device.board.log.filter((line) => line.includes("panic")).length,
      0
    );
  } finally {
    await device.close();
  }
});
