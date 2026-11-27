# Bubsie firmware

Bubsie's station mode on a 1.75" round AMOLED: the Waveshare ESP32-S3-Touch-AMOLED-1.75C
(466×466 CO5300 panel, CST9217 touch, QMI8658 IMU, BOOT and PWR buttons, 8 MB PSRAM, 32 MB flash).

C on ESP-IDF v5.5.5 with LVGL 9.5.0 and Waveshare's board package 3.0.0.

## Build

```sh
pnpm --filter @bubsie/firmware firmware:build    # or scripts/build.sh
```

Builds in Docker with the pinned `espressif/idf:v5.5.5` image and writes `dist/bootloader.bin`
(0x0), `dist/partition-table.bin` (0x8000) and `dist/app.bin` (0x10000).
`BUBSIE_WEB_URL=http://192.168.1.20:3000 scripts/build.sh` makes a build whose factory server is
another Bubsie instance (development, self-hosting).

## Flash

```sh
scripts/flash.sh /dev/cu.usbmodem1101
```

Needs `esptool` on the host (`pip install esptool`).

## Test

```sh
pnpm --filter @bubsie/firmware test               # host unit tests of the pure-C core
AMOLED_EMU=~/src/amoled-175c-emulator pnpm --filter @bubsie/firmware test:emulator
```

The emulator test boots `dist/` in [amoled-175c-emulator](https://github.com/lachieh/amoled-175c-emulator)
headlessly, walks the screens and saves each to `docs/screens/`.

## Assets

`main/assets/` is generated from the web app by `tools/assets` (`npm install && npm run generate`):
colour tokens from `apps/web/src/app/globals.css`, icons from `components/icon-paths.ts`, and the
web's fonts (Plus Jakarta Sans, Instrument Serif; SIL OFL 1.1) converted with `lv_font_conv`.
