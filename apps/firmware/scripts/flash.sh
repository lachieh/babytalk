#!/bin/sh
# Flash a built image to a board on USB.
#   scripts/flash.sh /dev/cu.usbmodem1101 [dist]
# Needs esptool (pip install esptool, or the one in an ESP-IDF install). Docker on macOS cannot
# reach USB serial devices, so this runs on the host.
set -eu
cd "$(dirname "$0")/.."
port="${1:?usage: scripts/flash.sh <serial port> [image dir]}"
dir="${2:-dist}"
esptool="$(command -v esptool.py || command -v esptool || true)"
[ -n "$esptool" ] || { echo "esptool not found: pip install esptool" >&2; exit 1; }
"$esptool" --chip esp32s3 --port "$port" --baud 921600 \
  --before default_reset --after hard_reset write_flash \
  --flash_mode dio --flash_freq 80m --flash_size 32MB \
  0x0 "$dir/bootloader.bin" 0x8000 "$dir/partition-table.bin" 0x10000 "$dir/app.bin"
