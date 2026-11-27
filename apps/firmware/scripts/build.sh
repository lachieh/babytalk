#!/bin/sh
# Build the firmware with ESP-IDF v5.5.5 in Docker (the same pinned image the emulator uses).
#   scripts/build.sh                 release build, web_url defaults to https://bubsie.app
#   BUBSIE_WEB_URL=http://192.168.1.20:3000 scripts/build.sh
#                                    a build whose factory web_url is another instance (dev, self-host)
#   BUBSIE_OUT=path scripts/build.sh  where the images go (default dist/)
# Output: bootloader.bin (0x0), partition-table.bin (0x8000) and app.bin (0x10000) in $BUBSIE_OUT.
set -eu
cd "$(dirname "$0")/.."
image="espressif/idf@sha256:a9231d0697ab8f7517cc072e93b7c83e04907bfbfba80b6440d7dbbf90665cf2"
web_url="${BUBSIE_WEB_URL:-https://bubsie.app}"
out="${BUBSIE_OUT:-dist}"

if [ "$web_url" = "https://bubsie.app" ]; then build=build; else build=build-custom; fi
mkdir -p "$build"
printf 'CONFIG_BUBSIE_DEFAULT_WEB_URL="%s"\n' "$web_url" > "$build/web-url.defaults"
# The overlay changes only the factory URL; drop the cached sdkconfig so it is re-read.
if ! grep -qs "CONFIG_BUBSIE_DEFAULT_WEB_URL=\"$web_url\"" "$build/sdkconfig"; then rm -f "$build/sdkconfig"; fi

docker run --rm -v "$PWD:/project" -w /project -e HOME=/tmp "$image" \
  idf.py -B "$build" -DSDKCONFIG="$build/sdkconfig" \
  -DSDKCONFIG_DEFAULTS="sdkconfig.defaults;$build/web-url.defaults" build

mkdir -p "$out"
cp "$build/bootloader/bootloader.bin" "$out/bootloader.bin"
cp "$build/partition_table/partition-table.bin" "$out/partition-table.bin"
cp "$build/bubsie.bin" "$out/app.bin"
ls -l "$out"
