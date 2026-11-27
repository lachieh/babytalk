#!/bin/sh
# Boot the built firmware in amoled-175c-emulator and walk its screens headlessly.
#   AMOLED_EMU=~/src/amoled-175c-emulator scripts/emulator-test.sh [test name pattern]
#   BUBSIE_TEST=redirect scripts/emulator-test.sh     test/emulator/redirect.test.ts instead
#   BUBSIE_TEST=wifi scripts/emulator-test.sh         test/emulator/wifi.test.ts instead
# Needs the emulator built (its scripts/fetch-rom.sh and build-emulator.sh, and `pnpm install` in
# web/). The tests import its HeadlessBoard from $AMOLED_EMU and boot the images in
# ${BUBSIE_IMAGES:-dist}. Screens land in ${BUBSIE_SCREENS:-docs/screens}.
set -eu
cd "$(dirname "$0")/.."
: "${AMOLED_EMU:?set AMOLED_EMU to an amoled-175c-emulator checkout}"
BUBSIE_REPO="$PWD/../.." BUBSIE_SCREENS="${BUBSIE_SCREENS:-$PWD/docs/screens}" \
  BUBSIE_IMAGES="$(cd "${BUBSIE_IMAGES:-dist}" && pwd)" \
  node --test ${1:+--test-name-pattern="$1"} "test/emulator/${BUBSIE_TEST:-bubsie}.test.ts"
