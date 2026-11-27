// Boots the Bubsie firmware in the emulator and walks its screens, saving each to docs/screens/.
// Runs its own Bubsie on a fresh database (bubsie-servers.ts). Run with scripts/emulator-test.sh
// against a build whose web URL is that Bubsie:
//   BUBSIE_WEB_URL=http://$BUBSIE_HOST:$BUBSIE_WEB_PORT scripts/build.sh
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { approve, gql, newFamily, recentEvents } from "./bubsie-api.ts";
import { Device } from "./bubsie-device.ts";
import { Instance, ports } from "./bubsie-servers.ts";

const SCREENS = process.env.BUBSIE_SCREENS ?? "screens";

let bubsie: Instance;
before(async () => {
  bubsie = await Instance.start({ name: "bubsie_fw_main", ...ports(0) });
});
after(async () => {
  await bubsie?.stop();
});

test("sets up from new, then logs, syncs and recovers like the web station", async () => {
  const api = bubsie.apiUrl;
  const family = await newFamily(["Ada", "Theo"], api);
  const device = await Device.boot({ network: true });
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
    await device.tapLabel("emulator");
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
    await device.seen(/app: clock set, \d+:\d\d [ap]m \S+/, 30);
    await device.run(0.8);
    device.screenshot(SCREENS, "06-pairing");
    assert.equal(await approve(code, family.token, api), true);
    await device.waitFor(/app: pair: approved/, 20);
    const ada = family.babies[0]!;

    // The station: the first baby, the first page (Feed).
    await device.waitFor(/sync: babies: 2/, 20);
    await device.waitFor(/screen: station/, 10);
    await device.waitFor(/sync: events: 0/, 20);
    await device.run(1);
    device.screenshot(SCREENS, "07-station-feed");

    // One tap logs the inferred default: with no history, a left breast feed, as a timer.
    await device.tapLabel("Feed");
    await device.waitFor(
      /sync: log feed \{"method":"breast","side":"left"\}: ok/,
      5
    );
    await device.waitFor(/toast: Feed started · Left \[Undo\]/, 5);
    await device.run(0.6);
    device.screenshot(SCREENS, "08-feed-timer-undo");
    await device.waitFor(/sync: sent create/, 20);
    let events = await recentEvents(ada.id, family.token, api);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.type, "feed");
    assert.equal(events[0]!.endedAt, null);
    assert.deepEqual(JSON.parse(events[0]!.metadata), {
      method: "breast",
      side: "left",
    });

    await device.run(6); // the undo window closes, the timer counts on
    device.screenshot(SCREENS, "09-feed-timer");
    await device.tapLabel("Done");
    await device.waitFor(/sync: stop \S+: ok/, 5);
    await device.waitFor(/toast: Feed saved/, 5);
    await device.waitFor(/sync: sent update/, 20);
    events = await recentEvents(ada.id, family.token, api);
    assert.notEqual(events[0]!.endedAt, null, "the stop reached the server");

    // Next time the other side is offered.
    await device.run(6);
    await device.find("Breast · Right");
    device.screenshot(SCREENS, "10-feed-next-side");

    // Sleep, picked: long-press opens the picker; held, 10 minutes ago.
    await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page sleep/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "11-station-sleep");
    const [sx, sy] = await device.find("Sleep");
    await device.longPress(sx, sy);
    await device.waitFor(/screen: picker/, 5);
    await device.tapLabel("10m");
    await device.waitFor(/screen: picker/, 5);
    await device.tapLabel("Held");
    await device.waitFor(/screen: picker/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "12-sleep-picker");
    await device.tapLabel("Start timer");
    await device.waitFor(/sync: log sleep \{"location":"held"\}: ok/, 5);
    await device.waitFor(/screen: station/, 5);
    await device.run(6);
    device.screenshot(SCREENS, "13-sleep-timer-10m");
    await device.waitFor(/sync: sent create/, 20);
    events = await recentEvents(ada.id, family.token, api);
    const sleep = events.find((e) => e.type === "sleep")!;
    const minutesAgo = (Date.now() - Date.parse(sleep.startedAt)) / 60000;
    assert.ok(
      minutesAgo > 9.5 && minutesAgo < 11,
      `started ${minutesAgo} minutes ago`
    );

    // Discard, then undo the discard: the timer is back.
    await device.tapLabel("Discard");
    await device.waitFor(/toast: Sleep timer discarded · Held \[Undo\]/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "14-sleep-discarded-undo");
    await device.tapLabel("Undo");
    await device.waitFor(/sync: undo/, 5);
    await device.find("Done");
    await device.tapLabel("Done");
    await device.waitFor(/sync: sent update/, 20);

    // Diaper: logged at once; undo takes it back.
    await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page diaper/, 5);
    await device.tapLabel("Diaper");
    await device.waitFor(/toast: Diaper saved · Wet \[Undo\]/, 5);
    await device.tapLabel("Undo");
    await device.waitFor(/sync: undo/, 5);
    await device.tapLabel("Diaper");
    await device.waitFor(/toast: Diaper saved · Wet \[Undo\]/, 5);
    await device.run(6);
    device.screenshot(SCREENS, "15-station-diaper");
    for (
      let i = 0;
      i < 3 &&
      (await recentEvents(ada.id, family.token, api)).filter(
        (e) => e.type === "diaper"
      ).length !== 1;
      i++
    ) {
      await device.run(3);
    }
    assert.equal(
      (await recentEvents(ada.id, family.token, api)).filter(
        (e) => e.type === "diaper"
      ).length,
      1
    );

    // A bottle: picked, timed, then the amount prompt takes its place.
    await device.swipe([60, 233], [400, 233]);
    await device.swipe([60, 233], [400, 233]);
    await device.waitFor(/screen: station page feed/, 5);
    await device.tapLabel("Breast · Right");
    await device.waitFor(/screen: picker/, 5);
    await device.tapLabel("Bottle");
    await device.waitFor(/screen: picker/, 5);
    await device.tapLabel("Start timer");
    await device.waitFor(/sync: log feed \{"method":"bottle"\}: ok/, 5);
    await device.run(3);
    await device.tapLabel("Done");
    await device.waitFor(/sync: stop/, 5);
    await device.find(/^120/);
    await device.run(0.5);
    device.screenshot(SCREENS, "16-bottle-amount");
    await device.tapLabel(/^120/);
    await device.tapLabel("Save");
    await device.waitFor(/sync: amount \S+ 120: ok/, 5);
    await device.waitFor(/toast: Feed saved · .* · Bottle · 120 ml/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "17-bottle-saved");
    for (let i = 0; i < 5; i++) {
      const bottle = (await recentEvents(ada.id, family.token, api)).find((e) =>
        e.metadata.includes("bottle")
      );
      if (bottle && JSON.parse(bottle.metadata).amountMl === 120) break;
      assert.ok(i < 4, "the amount reached the server");
      await device.run(3);
    }

    // Another device logs a sleep that ended an hour ago: the station picks it up on its next refresh.
    await gql(
      "mutation($babyId: String!, $from: String!, $to: String!) { logEvent(babyId: $babyId, type: sleep, startedAt: $from, endedAt: $to, sleepMeta: { location: crib }) { id } }",
      {
        babyId: ada.id,
        from: new Date(Date.now() - 200 * 60_000).toISOString(),
        to: new Date(Date.now() - 60 * 60_000).toISOString(),
      },
      family.token,
      api
    );
    await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page sleep/, 5);
    await device.waitFor(/sync: events: 5/, 90);
    await device.run(1.5);
    device.screenshot(SCREENS, "18-sleep-from-phone");

    // Settings, from the last page.
    await device.swipe([400, 233], [60, 233]);
    await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page settings/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "19-station-settings-page");
    await device.tapLabel("Settings");
    await device.waitFor(/screen: settings/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "20-settings");

    // Day look: night mode Auto -> Always -> Never.
    await device.tapLabel("Night mode");
    await device.waitFor(/screen: settings/, 5);
    await device.tapLabel("Night mode");
    await device.waitFor(/screen: settings/, 5);
    await device.find("Night mode");
    await device.run(0.5);
    device.screenshot(SCREENS, "21-settings-day");

    // Show Pump and Note too.
    await device.tapLabel("Buttons");
    await device.waitFor(/screen: tiles/, 5);
    await device.tapLabel("Pump");
    await device.waitFor(/screen: tiles/, 5);
    await device.tapLabel("Note");
    await device.waitFor(/screen: tiles/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "22-buttons");

    // BOOT goes back to the first page of the station.
    await device.button("boot");
    await device.waitFor(/screen: station/, 5);
    await device.run(1);
    device.screenshot(SCREENS, "23-station-day-feed");

    // Switch baby: tap the name.
    await device.tapLabel("Ada");
    await device.waitFor(/screen: babies/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "24-babies");
    await device.tapLabel("Theo");
    await device.waitFor(/sync: baby /, 5);
    await device.waitFor(/sync: events: 0/, 20);
    await device.find("Theo");
    await device.run(0.5);
    device.screenshot(SCREENS, "25-station-theo");
    const theo = family.babies[1]!;

    // A note for Theo, typed on the keyboard.
    for (let i = 0; i < 4; i++) await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page note/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "26-station-note");
    await device.tapLabel("Note");
    await device.waitFor(/screen: note/, 5);
    await device.typeKeys("qwe");
    await device.run(0.5);
    device.screenshot(SCREENS, "27-note-keyboard");
    await device.tapLabel("key OK");
    const note = (await device.waitFor(/sync: log note (\{.*\}): ok/, 5))[1]!;
    assert.ok(JSON.parse(note).text.length > 0, note);
    await device.waitFor(/sync: sent create/, 20);
    const theoEvents = await recentEvents(theo.id, family.token, api);
    assert.equal(theoEvents.length, 1);
    assert.equal(theoEvents[0]!.type, "note");
    assert.equal(
      (await recentEvents(ada.id, family.token, api)).filter(
        (e) => e.type === "note"
      ).length,
      0
    );

    // An outage: the change is kept, shown as waiting, survives a restart, and goes when the API is back.
    await bubsie.stopApi();
    await device.button("boot");
    await device.waitFor(/screen: station/, 5);
    await device.swipe([400, 233], [60, 233]); // sleep
    await device.swipe([400, 233], [60, 233]); // diaper
    await device.waitFor(/screen: station page diaper/, 5);
    await device.tapLabel("Diaper");
    await device.waitFor(/sync: log diaper .*: ok/, 5);
    await device.waitFor(/sync: not sent \S+ \(will retry\)/, 30);
    await device.run(6);
    for (let i = 0; i < 3; i++) await device.swipe([400, 233], [60, 233]);
    await device.waitFor(/screen: station page settings/, 5);
    await device.run(1.5);
    device.screenshot(SCREENS, "28-offline-waiting");
    await device.tapLabel("Settings");
    await device.waitFor(/screen: settings/, 5);
    await device.tapLabel("Restart");
    await bubsie.startApi();
    await device.waitFor(/sync: restored 1 unsent/, 30);
    await device.waitFor(/screen: station/, 40);
    await device.waitFor(/sync: sent create/, 30);
    assert.equal(
      (await recentEvents(theo.id, family.token, api)).filter(
        (e) => e.type === "diaper"
      ).length,
      1
    );
    await device.run(1);
    device.screenshot(SCREENS, "29-after-restart");

    // Unpair asks first, then the device is back at pairing.
    for (let i = 0; i < 5; i++) await device.swipe([400, 233], [60, 233]);
    await device.tapLabel("Settings");
    await device.waitFor(/screen: settings/, 5);
    await device.tapLabel("Unpair");
    await device.waitFor(/screen: confirm-unpair/, 5);
    await device.run(0.5);
    device.screenshot(SCREENS, "30-confirm-unpair");
    await device.tapLabel(/^Unpair$/);
    await device.waitFor(/app: pair: code/, 30);

    assert.equal(
      device.board.log.filter((line) => line.includes("panic")).length,
      0
    );
  } finally {
    await device.close();
  }
});
