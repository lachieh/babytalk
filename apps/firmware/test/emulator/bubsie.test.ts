// Boots the Bubsie firmware in the emulator and walks its screens, saving each to docs/screens/.
// Run with apps/firmware/scripts/emulator-test.sh.
import assert from "node:assert/strict";
import { test } from "node:test";

import { Device } from "./bubsie-device.ts";

const SCREENS = process.env.BUBSIE_SCREENS ?? "screens";

test("boots to the branded splash, then sets up Wi-Fi", async () => {
  const device = await Device.boot("bubsie", { network: true });
  try {
    await device.waitFor(/screen: splash/, 10);
    await device.run(1.5);
    device.screenshot(SCREENS, "01-splash");
    // The day background is the web's surface token, not black.
    const [r, g, b] = device.rgb(233, 20);
    assert.ok(r > 200 && g > 200 && b > 180, `background ${r},${g},${b}`);

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
    await device.waitFor(/app: online/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "04-wifi-joined");
    assert.equal(
      device.board.log.filter((line) => line.includes("panic")).length,
      0
    );
  } finally {
    await device.close();
  }
});
