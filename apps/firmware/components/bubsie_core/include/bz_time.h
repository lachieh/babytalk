#pragma once

#include <stdbool.h>
#include <stddef.h>

#include "bz_event.h"

#define BZ_CLOCK_VALID_AFTER 1704067200000LL /* 2024-01-01 */

bz_ms_t bz_parse_iso(const char *text);
void bz_format_iso(bz_ms_t ms, char out[25]);

void bz_format_elapsed(bz_ms_t ms, char *out, size_t len);
void bz_format_minutes(long minutes, char *out, size_t len);
void bz_format_ago(bz_ms_t ms, char *out, size_t len);
void bz_format_duration(bz_ms_t ms, char *out, size_t len);
void bz_format_clock(bz_ms_t ms, char *out, size_t len);
int bz_local_hour(bz_ms_t ms);

bool bz_is_dark_hour(int hour, int start, int end);

typedef struct {
    const char *name;
    const char *label;
    const char *posix;
} bz_zone_t;

const bz_zone_t *bz_zones(size_t *count);
const bz_zone_t *bz_zone_find(const char *name);
void bz_tz_apply(const char *name);
