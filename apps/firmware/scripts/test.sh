#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p test/out
cc="${CC:-cc}"
san="-fsanitize=address,undefined -fno-omit-frame-pointer -g"
# cJSON is vendored as published; it is built without our warning flags.
$cc -std=c11 -w $san -c components/bubsie_core/vendor/cjson/cJSON.c -o test/out/cJSON.o
$cc -std=c11 -D_DEFAULT_SOURCE -D_DARWIN_C_SOURCE -Wall -Wextra -Werror -Wno-unused-parameter $san \
  -Icomponents/bubsie_core/include -Icomponents/bubsie_core/vendor/cjson -Itest/host \
  components/bubsie_core/src/*.c test/host/*.c test/out/cJSON.o -o test/out/host-tests -lm
test/out/host-tests
