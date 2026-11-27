import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { Device } from "./bubsie-device.ts";
import { Instance, ports } from "./bubsie-servers.ts";

const SCREENS = process.env.BUBSIE_SCREENS ?? "screens";
const SECURE = "emulator-wpa2";
const PASSWORD = "emulator-pass";
/** ESP-IDF's disconnect reasons for a wrong WPA2 password. */
const WRONG_PASSWORD_REASONS = [14, 15, 202, 204];

let bubsie: Instance;
before(async () => {
  bubsie = await Instance.start({ name: "bubsie_fw_wifi", ...ports(0) });
});
after(async () => {
  await bubsie?.stop();
});

test("lists every network, says Wrong password, and joins once it is fixed", async () => {
  const device = await Device.boot({ network: true });
  try {
    await device.waitFor(/wifi: scan: 4 networks/, 30);
    for (const line of [
      /wifi: +emulator -40\b/,
      /wifi: +emulator-wpa2 -40 secure/,
      /wifi: +Neighbour -71 secure/,
      /wifi: +Cafe Guest -84\b/,
    ]) {
      assert.match(device.board.serial, line);
    }
    await device.waitFor(/screen: wifi-list/, 5);
    for (const ssid of ["emulator", SECURE, "Neighbour", "Cafe Guest"])
      await device.reach(ssid);
    await device.swipe([233, 150], [233, 400], 0.4);
    await device.run(0.5);
    device.screenshot(SCREENS, "37-wifi-list-four");

    await device.tapLabel("Cafe Guest");
    await device.waitFor(/wifi: joining Cafe Guest/, 5);
    const unreachable = Number(
      (await device.waitFor(/wifi: join failed, reason (\d+)/, 40))[1]
    );
    assert.ok(
      !WRONG_PASSWORD_REASONS.includes(unreachable),
      `reason ${unreachable}`
    );
    await device.waitFor(/ui: notice Couldn't reach that network/, 5);
    await device.waitFor(/screen: wifi-list/, 30);

    await device.tapLabel(SECURE);
    await device.waitFor(/screen: wifi-password/, 5);
    await device.typeKeys(PASSWORD.slice(0, -1));
    await device.tapLabel("key OK");
    await device.waitFor(new RegExp(`wifi: joining ${SECURE}`), 5);
    const reason = Number(
      (await device.waitFor(/wifi: join failed, reason (\d+)/, 30))[1]
    );
    assert.ok(WRONG_PASSWORD_REASONS.includes(reason), `reason ${reason}`);
    await device.waitFor(/ui: notice Wrong password/, 5);
    await device.waitFor(/screen: wifi-password/, 5);
    await device.find("key OK");
    await device.run(0.5);
    device.screenshot(SCREENS, "38-wifi-wrong-password");

    await device.typeKeys(PASSWORD.slice(-1));
    await device.tapLabel("key OK");
    await device.waitFor(new RegExp(`wifi: joining ${SECURE}`), 5);
    await device.waitFor(/wifi: address 10\.0\.2\.\d+/, 30);

    await device.waitFor(/screen: timezone/, 10);
    await device.run(0.5);
    await device.tap(233, 392);
    await device.waitFor(/screen: pairing/, 30);
    await device.waitFor(/app: pair: code ([A-Z0-9]{8})/, 30);
    await device.find(`Server: ${bubsie.host}`);
    await device.run(0.8);
    device.screenshot(SCREENS, "39-wifi-wpa2-pairing");

    await device.board.powerCycle();
    await device.waitFor(new RegExp(`wifi: joining ${SECURE}`), 30);
    await device.waitFor(/wifi: address 10\.0\.2\.\d+/, 30);
    await device.waitFor(/screen: pairing/, 30);
    assert.doesNotMatch(device.board.log.join("\n"), /panic/);
  } finally {
    await device.close();
  }
});
