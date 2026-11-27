#pragma once
#include <stdint.h>
/** A version 4 UUID from 16 random bytes: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx". */
void bz_uuid_format(const uint8_t random[16], char out[37]);
