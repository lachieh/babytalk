# Bubsie firmware

Bubsie's station mode on a 1.75" round AMOLED: the Waveshare ESP32-S3-Touch-AMOLED-1.75C
(466×466 CO5300 panel, CST9217 touch, QMI8658 IMU, BOOT and PWR buttons, 8 MB PSRAM, 32 MB flash).
It does what the web app's station page does (`apps/web/src/app/station`): one-tap logging with the
inferred default, a picker for the variant and "minutes ago", timers with Done and Discard, the amount
after a bottle, formula or pump, undo, notes, several babies, and a periodic reload that picks up
other devices' logs. Logging is optimistic and survives restarts and outages.

C on ESP-IDF v5.5.5 with LVGL 9.5.0 and Waveshare's board package 3.0.0.

## Build

```sh
pnpm --filter @bubsie/firmware firmware:build    # or scripts/build.sh
```

Builds in Docker with the pinned `espressif/idf:v5.5.5` image (the emulator's) and writes
`dist/bootloader.bin` (0x0), `dist/partition-table.bin` (0x8000) and `dist/app.bin` (0x10000).

- `BUBSIE_WEB_URL=http://192.168.1.20:3000` builds with another factory server (development,
  self-hosting). The server can also be changed on the device at pairing.
- `BUBSIE_UI_TRACE=1` logs every touch target after each screen change, for the emulator test.
- `BUBSIE_OUT=dir` writes the images somewhere other than `dist/`.

The script is named `firmware:build`, not `build`, so `pnpm build` (and CI) does not pull a 3 GB image.

## Flash

```sh
scripts/flash.sh /dev/cu.usbmodem1101        # pnpm --filter @bubsie/firmware firmware:flash <port>
```

Needs `esptool` on the host (`pip install esptool`); Docker on macOS cannot reach USB serial.

## Test

```sh
pnpm --filter @bubsie/firmware test               # host unit tests of the pure-C core (cc, ASan, UBSan)
```

The emulator test boots a build in [amoled-175c-emulator](https://github.com/lachieh/amoled-175c-emulator),
walks every screen against a local Bubsie, checks what reached the API, and saves each screen to
`docs/screens/`:

```sh
pnpm docker:dev:up                                # Postgres and Mailpit (from the repo root)
# API and web on this machine's LAN address, e.g. API on :4417 and web on :3417 with
# BUBSIE_WEB_API_URL=http://<lan ip>:4417/graphql
BUBSIE_UI_TRACE=1 BUBSIE_WEB_URL=http://<lan ip>:3417 BUBSIE_OUT=dist-dev scripts/build.sh
AMOLED_EMU=~/src/amoled-175c-emulator BUBSIE_IMAGES=dist-dev BUBSIE_API=http://localhost:4417/graphql \
  pnpm --filter @bubsie/firmware test:emulator
```

The emulator needs its own setup first (`scripts/fetch-rom.sh`, `scripts/build-emulator.sh`,
`pnpm install` in `web/`). The test starts its own relay with private addresses allowed, signs a new
person in by magic link through Mailpit, adds two babies and approves the device's code. The
emulator's random numbers repeat on every boot, so clear the events table between runs
(`docs/emulator-gaps.md`). To watch it in the browser instead, register `bubsie` in the emulator's
`web/src/main.ts` `FIRMWARES`, copy the images to `web/public/firmware/bubsie/`, and run
`pnpm relay --allow-private` with `pnpm dev`.

`test/emulator/redirect.test.ts` pairs through one Bubsie to another and checks the sign-out. It runs
its own instances from the built API and web (`pnpm --filter @bubsie/api build`, `pnpm --filter
@bubsie/web build`), each on a fresh database in the dev Postgres: A on :4417/:3417 stands in for
bubsie.app and is the build's web URL, B on :4418/:3418 is self-hosted. The phone side runs in Chrome
through Playwright. It covers the redirect (the device ends up on B, logs land only in B, A issues no
tokens), B already holding the code, a server from before redirects, a rotated JWT secret
(the device refreshes) and a revoked refresh token (the device signs out to pairing on B, once):

```sh
BUBSIE_UI_TRACE=1 BUBSIE_WEB_URL=http://<lan ip>:3417 BUBSIE_OUT=dist-dev scripts/build.sh
git worktree add --detach /tmp/bubsie-old dd52dbd   # optional: an API from before redirects,
                                                    # then `pnpm install` and `pnpm turbo run build --filter=@bubsie/api` there
AMOLED_EMU=~/src/amoled-175c-emulator BUBSIE_IMAGES=dist-dev BUBSIE_HOST=<lan ip> \
  BUBSIE_PG=<postgres container> BUBSIE_OLD_API=/tmp/bubsie-old BUBSIE_TEST=redirect \
  pnpm --filter @bubsie/firmware test:emulator
```

## Architecture

```
components/bubsie_core/   pure C: no ESP-IDF, no LVGL. Built on the host by scripts/test.sh
  bz_event     events as the API carries them (metadata kept as JSON)
  bz_time      ISO 8601, elapsed/ago/duration words, local clock, dark hours, time zones
  bz_gql       GraphQL request bodies and reply parsing/classification (gql-request.ts rules)
  bz_outbox    port of lib/event-outbox.ts: unconfirmed changes, ordered sending, persistence
  bz_rules     variants, inferDefault, one-tap timers, amount prompts and chips, toast/timer words
  bz_station   the station model: log, stop, discard, amount, undo (lib/baby-context.tsx)
  bz_pairing   device-code pairing, including redirects to another server, as a state machine
  bz_uuid      v4 ids, chosen on the device as the web does
  bz_wifi      what a failed join means: a wrong password, or a network that couldn't be reached
main/
  app.c        flow: Wi-Fi -> time zone -> pairing -> station; a worker task for blocking calls
  station.c    the model behind a lock, persisted to the "outbox" NVS partition, and the sync task
  settings.c   NVS: web_url, cached api_url, Wi-Fi, tokens, baby, tiles, time zone, preferences
  buttons.c    BOOT: station home. PWR: screen off/on. Brightness follows night mode
  net/         wifi.c, http.c (TLS via the certificate bundle; http allowed), api.c (refresh once)
  ui/          theme (web tokens), round list, keyboard, toast, and the screens below
  assets/      generated by tools/assets from the web: tokens, icons, Plus Jakarta Sans, Instrument Serif
```

- **Sync.** Every change goes into the outbox and is written to flash before the screen shows it.
  The sync task sends the oldest ready change first, one at a time; a change made while a request is
  in flight follows it. An unanswered request waits with backoff (2 s doubling to 60 s); a refused one
  stays as "not saved" and is offered again in Settings. Events reload every 15 s while a timer runs
  and every 60 s otherwise, and a reload asked for before the last confirmed write is ignored (as on
  the web). Babies reload every 5 minutes.
- **Session.** The API URL is never configured: it comes from `<web_url>/.well-known/config` and is
  cached. A request the server answers as unauthenticated refreshes the token once and retries; a
  refresh the server refuses signs the device out and it asks to pair again.
- **Pairing.** `requestDeviceCode`, then `pollDeviceCode` every 2.5 s. `redirected` with `webUrl` W:
  fetch W's config, `requestDeviceCode(code: C)` on W, `confirmDeviceCodeRedirect(code: C)` on the
  original, save W as `web_url`, poll C on W. `CODE_TAKEN` or a server without the `code` argument
  shows why and starts a fresh code on the original server. A server without the `webUrl` field is
  polled without it.
- **Clock.** SNTP after Wi-Fi; nothing is logged until the clock is set (a timer from 1970 would be
  wrong), and the station says so.
- **Time zone.** The API has none (babies and households carry no zone; the web uses the browser's),
  so setup asks once and Settings can change it. Daily words and night mode use it.

## Screens

| Screen                | Reached from                                 | Shows                                                                                                          |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Splash                | boot                                         | breathing pebble, wordmark, status                                                                             |
| Wi-Fi list / password | first boot, Settings > Wi-Fi, a network gone | networks following the circle; keyboard                                                                        |
| Time zone             | setup, Settings                              | roller of zones                                                                                                |
| Pairing / server      | not paired, Unpair, signed out               | QR of `<web>/auth/approve?code=C`, `XXXX-XXXX`, Server button                                                  |
| Station page          | paired                                       | one per visible type: baby name, big button (tap logs, long press picks), last time, variant pill              |
| Timer                 | a running feed/sleep/pump                    | label, start time, elapsed, hour ring, Done, Discard                                                           |
| Amount                | a finished bottle/formula/pump               | three chips around the last amount, Save, Skip                                                                 |
| Picker                | variant pill, long press                     | variants, Now/5m/10m/15m/30m, Start timer or Log, Already finished                                             |
| Note                  | Note page                                    | keyboard                                                                                                       |
| Babies                | the baby's name (2+ babies)                  | babies                                                                                                         |
| Settings              | last station page                            | baby, buttons, send again, night mode, volume, reduce motion, time zone, Wi-Fi, server, restart, unpair, reset |
| Undo toast            | after a log, stop, amount or discard         | what happened, Undo for 5 s                                                                                    |

## Design decisions

- **One type per page, swiped.** The web's two-column grid does not fit a 466 px circle with
  thumb-sized targets, and a radial menu puts every target at the rim. A page centres one 236 px
  button (about 2.5 cm) where the glass is widest; the variant pill sits below it and the last time
  inside it, so a glance answers "when did she last feed". Settings is the last page.
- **Round lists.** Lists narrow their rows to the circle as they scroll; titles and back buttons
  sit in the top cap. The keyboard sits in the band of the circle that is at least 360 px wide.
- **Night.** Auto dark mode follows the web (8 pm to 7 am), with true black backgrounds for the
  AMOLED and the screen at 30% brightness. Settings offers Always and Never.
- **Motion.** Only the web's breathe pulse (where something is pending), a slight press scale, and
  the hour ring; Reduce motion turns the first two off. No spinners.
- **Drags are not taps.** A press that moves more than 28 px on the big button does not log, so a
  swipe that starts on it cannot log by accident.
- **Unpair/Reset drop unsent changes,** after saying how many, because they belong to the old
  session and the new one may be another household.
