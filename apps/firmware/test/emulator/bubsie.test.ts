// Boots the Bubsie firmware in the emulator and walks its screens, saving each to docs/screens/.
// Run with apps/firmware/scripts/emulator-test.sh.
import assert from "node:assert/strict";
import { test } from "node:test";

import { Device } from "./bubsie-device.ts";

const SCREENS = process.env.BUBSIE_SCREENS ?? "screens";

test("boots to the branded splash", async () => {
  const device = await Device.boot("bubsie");
  try {
    await device.waitFor(/screen: splash/, 10);
    await device.run(1.5);
    device.screenshot(SCREENS, "01-splash");
    // The day background is the web's surface token, not black.
    const [r, g, b] = device.rgb(233, 20);
    assert.ok(r > 200 && g > 200 && b > 180, `background ${r},${g},${b}`);
    assert.equal(
      device.board.log.filter((line) => line.includes("panic")).length,
      0
    );
  } finally {
    await device.close();
  }
});
