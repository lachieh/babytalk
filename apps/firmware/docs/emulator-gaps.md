# Emulator gaps

What the Bubsie firmware needed from [amoled-175c-emulator](https://github.com/lachieh/amoled-175c-emulator)
that it did not do at `9b918ea`. Both are fixed by
[lachieh/amoled-175c-emulator#1](https://github.com/lachieh/amoled-175c-emulator/pull/1). The firmware
never worked around either.

## 1. Only one open Wi-Fi network: no secured network, no wrong password (fixed)

The access point was fixed to an open `emulator` network, so a scan listed one network and the
password screen, WPA2 and a wrong password could not be tested.

A scan now finds `emulator` (open), `emulator-wpa2` (WPA2-PSK, password `emulator-pass`), `Neighbour`
and `Cafe Guest`; `HeadlessBoard.boot(..., { wifi })` sets other networks. A wrong password fails after
about 10 s with disconnect reason 204 (`WIFI_REASON_HANDSHAKE_TIMEOUT`); a real access point may send 15
(`4WAY_HANDSHAKE_TIMEOUT`) instead. The firmware treats 14, 15, 202 and 204 as a wrong password
(`bz_wifi`). `test/emulator/wifi.test.ts` covers the list of four, a network that can't be reached,
a wrong password then the fixed one, and joining again after a power cycle.

## 2. The hardware random number generator repeated on every boot (fixed)

`esp_random()` returned the same bytes on every boot of an image, so event ids (v4 UUIDs) repeated
between runs and the API refused the second run's first event. The emulator now seeds it from host
entropy at every power-on (`rngSeed` fixes it for reproducible runs). The tests no longer clear the
events table between runs, and each now runs its own Bubsie on a fresh database anyway.

## Still open

- `HeadlessBoard` has no way to take the network away and give it back (the relay link is private to
  it). The walkthrough's outage stops the test's own API instead, which the device sees the same way
  (requests fail and are retried), but it cannot test losing the access point itself.
