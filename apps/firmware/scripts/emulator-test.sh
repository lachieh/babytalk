#!/bin/sh
# Boot the built firmware in amoled-175c-emulator and walk its screens headlessly.
#   AMOLED_EMU=~/src/amoled-175c-emulator scripts/emulator-test.sh [test name pattern]
#   BUBSIE_TEST=redirect scripts/emulator-test.sh     test/emulator/redirect.test.ts instead
# Needs the emulator built (its scripts/fetch-rom.sh and build-emulator.sh, and `pnpm install` in
# web/). Copies dist/ in as the `bubsie` firmware and test/emulator/* into its web/test/, then runs
# test/emulator/${BUBSIE_TEST:-bubsie}.test.ts there. Screens land in docs/screens/.
set -eu
cd "$(dirname "$0")/.."
here="$PWD"
emu="${AMOLED_EMU:?set AMOLED_EMU to an amoled-175c-emulator checkout}"
images="${BUBSIE_IMAGES:-dist}"
mkdir -p "$emu/web/public/firmware/bubsie"
cp "$images/bootloader.bin" "$images/partition-table.bin" "$images/app.bin" "$emu/web/public/firmware/bubsie/"
cp test/emulator/*.ts "$emu/web/test/"
cd "$emu/web"
BUBSIE_REPO="$here/../.." BUBSIE_SCREENS="$here/docs/screens" \
  node --test ${1:+--test-name-pattern="$1"} "test/${BUBSIE_TEST:-bubsie}.test.ts"
