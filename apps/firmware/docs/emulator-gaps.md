# Emulator gaps

What the Bubsie firmware needs that [amoled-175c-emulator](https://github.com/lachieh/amoled-175c-emulator)
(at `9b918ea`) does not do yet. Each is written so it can be fixed in the emulator; the firmware does
not work around any of them.

## 1. Only one open Wi-Fi network: no secured network, no wrong password

The access point is fixed to `ssid=emulator` with no security (`emulator/src/lib.rs`, `WIFI_SSID`,
`ApConfig::parse("ssid=emulator")`). A scan returns that one network.

Untestable as a result:

- the password screen (`screen: wifi-password`), reached only by picking a secured network;
- joining with WPA2-PSK, and the "That password didn't work" path (station disconnect reason
  `WIFI_REASON_AUTH_FAIL` / `4WAY_HANDSHAKE_TIMEOUT`);
- a list of several networks (sorting by signal, de-duplicating names, scrolling the round list).

Wanted: a way for the page and the Node harness to configure the access point list, for example
`Emulator.boot(..., { wifi: [{ ssid: "emulator" }, { ssid: "Nursery", psk: "goodnight" }, { ssid: "Neighbour", psk: "x", rssi: -80 }] })`,
where a secured network completes the WPA2 4-way handshake only with the right passphrase and
deauthenticates with reason 15 (or 2) otherwise.

## 2. The hardware random number generator repeats on every boot

`esp_fill_random()` returns the same bytes on every boot of the same image. The firmware makes each
event's id with it (a v4 UUID, as the web does with `crypto.randomUUID()`), and the API stores events
under that id. A second run of the emulator test against the same database logs its first event with
the id the first run already used, and the API refuses it ("Event could not be saved": the id belongs
to another person's event).

On the board the RNG is seeded by RF noise while Wi-Fi runs, so this does not happen there. The
firmware does not mix in other entropy to hide it.

Wanted: `RNG_DATA_REG` (0x6003507C on the ESP32-S3) answering from a host source of randomness (or a
seed the harness passes, for reproducible runs).

`test/emulator/redirect.test.ts` gives every run fresh databases, so it is not affected. For
`bubsie.test.ts`, until then, clear the dev database's events between runs:
`docker exec <postgres container> psql -U bubsie -d bubsie -c 'DELETE FROM events;'`.
